<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  Home,
  List,
  PlusCircle,
  Users,
  Settings,
  LogOut,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next'

const props = defineProps<{
  collapsed?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:collapsed', value: boolean): void
}>()

const { logout, user } = useAuth()
const route = useRoute()
const isAdmin = computed(() => user.value?.role === 'ADMIN')

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

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<template>
  <div
    v-if="!internalCollapsed"
    class="fixed inset-0 bg-black/50 z-40 md:hidden"
    @click="toggle"
  />
  <aside
    :class="[
      'fixed h-screen bg-[#0b0b0b] text-white flex flex-col p-4 transition-all duration-300 shadow-xl z-50',
      internalCollapsed ? 'w-16' : 'w-64'
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
      <RouterLink to="/dashboard" class="nav-item" :class="{ 'nav-item-active': isActive('/dashboard') }">
        <Home size="18" class="shrink-0" />
        <span v-if="!internalCollapsed">Dashboard</span>
      </RouterLink>

      <RouterLink to="/loans" class="nav-item" :class="{ 'nav-item-active': isActive('/loans') }">
        <List size="18" class="shrink-0" />
        <span v-if="!internalCollapsed">Loans</span>
      </RouterLink>

      <RouterLink v-if="isAdmin" to="/metrics" class="nav-item" :class="{ 'nav-item-active': isActive('/metrics') }">
        <BarChart3 size="18" class="shrink-0" />
        <span v-if="!internalCollapsed">Metrics</span>
      </RouterLink>

      <RouterLink to="/CreateLoan" class="nav-item" :class="{ 'nav-item-active': isActive('/CreateLoan') }">
        <PlusCircle size="18" class="shrink-0" />
        <span v-if="!internalCollapsed">Create Loan</span>
      </RouterLink>

      <RouterLink to="/clients" class="nav-item" :class="{ 'nav-item-active': isActive('/clients') }">
        <Users size="18" class="shrink-0" />
        <span v-if="!internalCollapsed">Clients</span>
      </RouterLink>
    </nav>

    <!-- Bottom Nav -->
    <div class="mt-auto flex flex-col gap-2">
      <RouterLink to="/settings" class="nav-item" :class="{ 'nav-item-active': isActive('/settings') }">
        <Settings size="18" class="shrink-0" />
        <span v-if="!internalCollapsed">Settings</span>
      </RouterLink>

      <button
        type="button"
        class="nav-item text-red-400 hover:text-red-300"
        @click="logout"
      >
        <LogOut size="18" class="shrink-0" />
        <span v-if="!internalCollapsed">Logout</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.nav-item {
  @apply flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
         text-sm text-gray-300 hover:bg-white/10 hover:text-white
         transition-colors;
}

.nav-item-active {
  @apply bg-white/10 text-white;
}

/* Center icons when collapsed */
aside.w-16 .nav-item {
  @apply justify-center;
}
</style>
