<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'

const email = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const sent = ref(false)
const { addToast } = useToast()

const router = useRouter()

async function submit() {
  if (!email.value) return
  loading.value = true
  error.value = null

  try {
    await $fetch('/api/auth/password-reset/request', {
      method: 'POST',
      body: {
        email: email.value
      }
    })
    sent.value = true
    addToast({ message: 'Password reset link sent.', variant: 'success' })
  } catch (err: any) {
    const message = err?.data?.message ?? 'Unable to send reset link.'
    error.value = message
    addToast({ message, variant: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page-shell-no-nav flex items-center justify-center">
    <form
      @submit.prevent="submit"
      class="w-full max-w-sm space-y-4 p-6 card"
    >
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold heading">Forgot password</h1>
        <p class="text-xs text-gray-500">
          Enter your email and we will send a password reset link.
        </p>
      </div>

      <input
        v-model="email"
        type="email"
        placeholder="Email"
        class="input"
        required
      />

      <p v-if="error" class="text-red-600 text-sm">
        {{ error }}
      </p>

      <p v-if="sent" class="text-green-600 text-sm">
        Check your inbox for the reset link.
      </p>

      <button
        type="submit"
        :disabled="loading"
        class="w-full btn btn-primary"
      >
        <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
        {{ loading ? 'Sending...' : 'Send reset link' }}
      </button>

      <div class="flex items-center justify-between text-xs">
        <NuxtLink to="/login" class="text-cyan-500 hover:underline">
          Back to login
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
