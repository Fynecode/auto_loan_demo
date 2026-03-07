<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import sideNav from '~/components/sideNav.vue'
import { useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'

const router = useRouter()
const { user } = useAuth()
const isAdmin = computed(() => user.value?.role === 'ADMIN')
const displayName = computed(() => user.value?.name?.trim() || user.value?.email || 'User')

console.log(user.value)

const sidebarCollapsed = ref(true)
const pageSize = 15

const { data: loans, pending, error } = await useFetch('/api/loans', {
  query: {
    sort: 'newest',
    status: 'all',
    page: 1,
    pageSize
  }
})

if (error.value) {
  console.error('Error fetching loans:', error.value)
}

function statusColor(status: string) {
  switch (status) {
    case 'DRAFT': return 'bg-orange-200 text-orange-800'
    case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-800'
    case 'ACTIVE': return 'bg-cyan-100 text-cyan-800'
    case 'OVERDUE': return 'bg-red-100 text-red-800'
    case 'COMPLETED': return 'bg-green-100 text-green-800'
    case 'CANCELLED': return 'bg-gray-300 text-gray-900'
    case 'DEFAULTED': return 'bg-red-200 text-red-900'
    default: return ''
  }
}

</script>

<template>
  <sideNav v-model:collapsed="sidebarCollapsed" />

  <!-- Main section -->
  <section
    class="page-shell"
    :class="sidebarCollapsed ? '' : 'md:pl-64'"
  >
    <!-- Welcome message -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-xl font-semibold">Welcome back, {{ displayName }}!</h1>
    </div>

    <div v-if="isAdmin" class="mb-6 w-[30%]">
      <div
        class="border rounded-lg p-4 hover:border-cyan-500 cursor-pointer transition-colors"
        @click="router.push('/metrics')"
      >
        <p class="text-sm font-semibold">View metrics</p>
      </div>
    </div>

    <div v-if="pending" class="text-sm text-gray-400 flex items-center gap-2 py-3">
      <Loader2 class="w-4 h-4 animate-spin" />
      Loading loans...
    </div>

    <div v-if="loans && loans.items.length">
      <!-- Loan table header -->
      <div class="hidden md:grid md:grid-cols-6 table-head mb-2">
        <span>Client</span>
        <span>Amount</span>
        <span class="hidden md:block">Quantity</span>
        <span>Status</span>
        <span class="hidden md:block">Due Date</span>
        <span>Actions</span>
      </div>

      <!-- Loan table rows -->
      <div
        v-for="loan in loans.items"
        :key="loan.id"
        class="card p-3 mb-3 flex flex-col gap-2 text-sm hover-lift md:mb-0 md:rounded-none md:border-0 md:bg-transparent md:shadow-none md:p-0 md:grid md:grid-cols-6 md:items-center md:gap-0 md:border-t md:border-white/5 md:py-3"
      >
        <div>
          <p class="text-xs text-gray-400 md:hidden">Client</p>
          <span>{{ loan.client }}</span>
        </div>
        <div>
          <p class="text-xs text-gray-400 md:hidden">Amount</p>
          <span>N$ {{ loan.amount.toLocaleString() }}</span>
        </div>
        <div class="md:block">
          <p class="text-xs text-gray-400 md:hidden">Quantity</p>
          <span>{{ loan.quantity }}</span>
        </div>
        <div>
          <p class="text-xs text-gray-400 md:hidden">Status</p>
          <span
            :class="[
              'px-2 py-1 rounded-full w-fit text-xs inline-flex',
              statusColor(loan.status)
            ]"
          >
            {{ loan.status }}
          </span>
        </div>
        <div class="md:block">
          <p class="text-xs text-gray-400 md:hidden">Due Date</p>
          <span>{{ loan.due || '-' }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="btn btn-ghost text-xs"
            @click="router.push(`/loans/${loan.id}`)"
          >
            View
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="!pending" class="card-muted p-6 text-sm text-gray-500">
      No loans found.
    </div>
  </section>
</template>
