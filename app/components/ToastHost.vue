<script setup lang="ts">
import { useToast } from '~/composables/useToast'

const { toasts, removeToast } = useToast()

function variantClass(variant: string) {
  if (variant === 'success') return 'border-green-200 bg-green-50 text-green-700'
  if (variant === 'error') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-cyan-200 bg-cyan-50 text-cyan-700'
}
</script>

<template>
  <div class="fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="rounded-lg border px-3 py-2 text-sm shadow"
      :class="variantClass(toast.variant)"
    >
      <div class="flex items-start justify-between gap-2">
        <div>
          <p v-if="toast.title" class="font-semibold">{{ toast.title }}</p>
          <p class="text-xs opacity-90">{{ toast.message }}</p>
        </div>
        <button
          class="text-xs opacity-60 hover:opacity-100"
          type="button"
          @click="removeToast(toast.id)"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>
