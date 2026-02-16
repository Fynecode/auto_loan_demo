<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Home,
  List,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next'

const props = defineProps<{
  collapsed?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:collapsed', value: boolean): void
}>()

// internal state
const internalCollapsed = ref(props.collapsed ?? false)

// keep internal state in sync with parent prop
watch(
  () => props.collapsed,
  (val) => {
    if (val !== undefined) internalCollapsed.value = val
  }
)

function toggle() {
  internalCollapsed.value = !internalCollapsed.value
  emit('update:collapsed', internalCollapsed.value)
}
</script>

<template>
  <aside
    :class="[
      'fixed h-screen bg-[#0b0b0b] text-white flex flex-col p-4 transition-all duration-300',
      internalCollapsed ? 'w-16' : 'w-[20%]'
    ]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <span v-if="!internalCollapsed" class="text-xl font-semibold whitespace-nowrap">
        Loan System
      </span>

      <button @click="toggle" class="p-1 rounded hover:bg-white/10">
        <ChevronLeft v-if="!internalCollapsed" size="18" />
        <ChevronRight v-else size="18" />
      </button>
    </div>

    <!-- Main Nav -->
    <nav class="flex flex-col gap-2">
      <RouterLink to="/dashboard" class="nav-item">
        <Home size="18" class="shrink-0" />
        <span v-if="!internalCollapsed">Dashboard</span>
      </RouterLink>

      <RouterLink to="/loans" class="nav-item">
        <List size="18" class="shrink-0" />
        <span v-if="!internalCollapsed">Loans</span>
      </RouterLink>

      <RouterLink to="/clients" class="nav-item">
        <Users size="18" class="shrink-0" />
        <span v-if="!internalCollapsed">Clients</span>
      </RouterLink>
    </nav>

    <!-- Bottom Nav -->
    <div class="mt-auto flex flex-col gap-2">
      <a class="nav-item">
        <Settings size="18" class="shrink-0" />
        <span v-if="!internalCollapsed">Settings</span>
      </a>

      <a class="nav-item text-red-400 hover:text-red-300">
        <LogOut size="18" class="shrink-0" />
        <span v-if="!internalCollapsed">Logout</span>
      </a>
    </div>
  </aside>
</template>

<style scoped>
.nav-item {
  @apply flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
         text-sm text-gray-300 hover:bg-white/10 hover:text-white
         transition-colors;
}

/* Center icons when collapsed */
aside.w-16 .nav-item {
  @apply justify-center;
}
</style>
