<script setup lang="ts">
import { ref, onMounted } from 'vue'
import sideNav from '~/components/sideNav.vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const sidebarCollapsed = ref(false)
const { data: loans, pending, error } = await useFetch('/api/loans')

if (error.value) {
  console.error('Error fetching loans:', error.value)
}

// Example loans
// const loans = ref([
//   { id: '1', client: 'John Doe', amount: 5000, status: 'DRAFT', due: '2026-02-28' },
//   { id: '2', client: 'Jane Smith', amount: 12000, status: 'ACTIVE', due: '2026-03-10' },
//   { id: '3', client: 'Peter Pan', amount: 8000, status: 'OVERDUE', due: '2026-01-20' },
// ])

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

function createLoan() {
  router.push('/loans/new')
}
</script>

<template>
  <sideNav v-model:collapsed="sidebarCollapsed" />

  <!-- Main section -->
  <section
    class="bg-gray-200 p-6 rounded-2xl shadow transition-all duration-300"
    :class="sidebarCollapsed ? 'ml-16' : 'ml-[20%]'"
  >
    <!-- Welcome message -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-xl font-semibold">Welcome back, User!</h1>

      <!-- Create loan button -->
      <button
        @click="createLoan"
        class="flex items-center gap-2 px-3 py-1 rounded-lg bg-cyan-500 text-white text-sm hover:bg-cyan-600 transition-colors"
      >
        <span class="text-lg font-bold">+</span>
        <span class="hidden sm:inline">New Loan</span>
      </button>
    </div>

    <!-- Loan table header -->
    <div class="grid grid-cols-5 text-xs text-gray-400 mb-2" v-if="loans && loans.length">
      <span>Client</span>
      <span>Amount</span>
      <span>Status</span>
      <span>Due Date</span>
      <span></span>
    </div>

    <!-- Loan table rows -->
    <div
      v-if="loans && loans.length"
      v-for="loan in loans"
      :key="loan.id"
      class="grid grid-cols-5 items-center py-3 border-t border-white/5 text-sm"
    >
      <span>{{ loan.client }}</span>
      <span>N$ {{ loan.amount.toLocaleString() }}</span>
      <span
        :class="[
          'px-2 py-1 rounded-full w-fit text-xs',
          statusColor(loan.status)
        ]"
      >
        {{ loan.status }}
      </span>
      <span>{{ loan.due }}</span>
      <button class="text-xs text-cyan-400 hover:underline">View</button>
    </div>
  </section>
</template>
