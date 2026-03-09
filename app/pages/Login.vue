<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Eye, EyeOff, Loader2 } from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const { fetchUser } = useAuth()
const { addToast } = useToast()

const router = useRouter()

async function submit() {
  loading.value = true
  error.value = null

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value
      }
    })

    await fetchUser()

    // cookie is set server-side
    await router.push('/dashboard')
  } catch (err: any) {
    error.value = err?.data?.message ?? 'Invalid credentials'
  } finally {
    loading.value = false
  }
}

const seeding = ref(false)
async function seedDemoUsers() {
  seeding.value = true
  try {
    await $fetch('/api/admin/seed', { method: 'POST' })
    addToast({ message: 'Demo users created. You can sign in now.', variant: 'success' })
  } catch (err: any) {
    addToast({ message: err?.data?.message ?? 'Unable to seed demo users.', variant: 'error' })
  } finally {
    seeding.value = false
  }
}
</script>

<template>
  <div class="page-shell-no-nav flex items-center justify-center">
    <form
      @submit.prevent="submit"
      class="card w-full max-w-sm space-y-4 p-6"
    >
      <h1 class="text-xl font-semibold heading">Sign in</h1>
      <div class="card-muted p-3 text-xs text-gray-600">
        <p class="font-medium text-gray-700">Demo access</p>
        <p>Admin: admin@greenline.local</p>
        <p>Staff: staff@greenline.local</p>
        <p>Password: use the assigned demo password.</p>
      </div>

      <input
        v-model="email"
        type="email"
        placeholder="Email"
        class="input"
        required
      />

      <div class="relative">
        <input
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Password"
          class="input pr-10"
          required
        />
        <button
          type="button"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          @click="showPassword = !showPassword"
        >
          <EyeOff v-if="showPassword" class="w-4 h-4" />
          <Eye v-else class="w-4 h-4" />
        </button>
      </div>

      <p v-if="error" class="text-red-600 text-sm">
        {{ error }}
      </p>

      <button
        type="submit"
        :disabled="loading"
        class="btn btn-primary w-full"
      >
        <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>

      <div class="flex items-center justify-between text-xs">
        <NuxtLink to="/forgot-password" class="text-cyan-500 hover:underline">
          Forgot password?
        </NuxtLink>
      </div>

      <button
        type="button"
        :disabled="seeding"
        class="btn btn-outline w-full"
        @click="seedDemoUsers"
      >
        <Loader2 v-if="seeding" class="w-4 h-4 animate-spin" />
        {{ seeding ? 'Creating demo users...' : 'Create demo users' }}
      </button>
    </form>
  </div>
</template>
