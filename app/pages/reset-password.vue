<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'

const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const { addToast } = useToast()

const router = useRouter()
const route = useRoute()
const token = computed(() => (route.query.token ?? '').toString())

async function submit() {
  if (!token.value) {
    error.value = 'Missing reset token.'
    return
  }

  if (!password.value || password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }

  loading.value = true
  error.value = null

  try {
    await $fetch('/api/auth/password-reset/confirm', {
      method: 'POST',
      body: {
        token: token.value,
        password: password.value
      }
    })

    addToast({ message: 'Password reset successfully.', variant: 'success' })
    await router.push('/login')
  } catch (err: any) {
    const message = err?.data?.message ?? 'Unable to reset password.'
    error.value = message
    addToast({ message, variant: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 md:px-16">
    <form
      @submit.prevent="submit"
      class="w-full max-w-sm space-y-4 p-6 card"
    >
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold heading">Reset password</h1>
        <p class="text-xs text-gray-500">
          Choose a new password for your account.
        </p>
      </div>

      <input
        v-model="password"
        type="password"
        placeholder="New password"
        class="input"
        required
      />

      <input
        v-model="confirmPassword"
        type="password"
        placeholder="Confirm new password"
        class="input"
        required
      />

      <p v-if="error" class="text-red-600 text-sm">
        {{ error }}
      </p>

      <button
        type="submit"
        :disabled="loading || !token"
        class="w-full btn btn-primary"
      >
        <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
        {{ loading ? 'Resetting...' : 'Reset password' }}
      </button>

      <div class="flex items-center justify-between text-xs">
        <NuxtLink to="/login" class="text-cyan-500 hover:underline">
          Back to login
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
