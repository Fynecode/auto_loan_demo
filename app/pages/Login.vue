<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const { fetchUser } = useAuth()

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
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <form
      @submit.prevent="submit"
      class="w-full max-w-sm space-y-4 p-6 border rounded"
    >
      <h1 class="text-xl font-semibold">Sign in</h1>

      <input
        v-model="email"
        type="email"
        placeholder="Email"
        class="w-full border p-2 rounded"
        required
      />

      <input
        v-model="password"
        type="password"
        placeholder="Password"
        class="w-full border p-2 rounded"
        required
      />

      <p v-if="error" class="text-red-600 text-sm">
        {{ error }}
      </p>

      <button
        type="submit"
        :disabled="loading"
        class="w-full bg-black text-white py-2 rounded"
      >
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </div>
</template>
