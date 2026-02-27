<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import sideNav from '~/components/sideNav.vue'
import { useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'

const router = useRouter()
const { user } = useAuth()
const isAdmin = computed(() => user.value?.role === 'ADMIN')

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

const { data: metrics, pending: metricsPending, refresh: refreshMetrics } = await useFetch('/api/dashboard/metrics', {
  immediate: false,
  server: false
})

watch(
  isAdmin,
  (value) => {
    if (value) refreshMetrics()
  },
  { immediate: true }
)

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
    class="pt-16 p-4 md:pt-6 md:p-6 transition-all duration-300"
    :class="sidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-[20%]'"
  >
    <!-- Welcome message -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-xl font-semibold">Welcome back, User!</h1>
    </div>

    <div v-if="isAdmin" class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="border rounded-lg p-4">
        <p class="text-xs text-gray-400">Active Loans</p>
        <p class="text-xl font-semibold">{{ metrics?.activeLoans ?? 0 }}</p>
      </div>
      <div class="border rounded-lg p-4">
        <p class="text-xs text-gray-400">Overdue Loans</p>
        <p class="text-xl font-semibold">{{ metrics?.overdueLoans ?? 0 }}</p>
      </div>
      <div class="border rounded-lg p-4">
        <p class="text-xs text-gray-400">Total Outstanding</p>
        <p class="text-xl font-semibold">N$ {{ (metrics?.totalOutstanding ?? 0).toLocaleString() }}</p>
      </div>
      <div class="border rounded-lg p-4">
        <p class="text-xs text-gray-400">Overdue Amount</p>
        <p class="text-xl font-semibold">N$ {{ (metrics?.overdueAmount ?? 0).toLocaleString() }}</p>
      </div>
      <div class="border rounded-lg p-4 md:col-span-2">
        <p class="text-xs text-gray-400">Received vs Expected</p>
        <p class="text-sm text-gray-600">
          N$ {{ (metrics?.totalPaid ?? 0).toLocaleString() }} /
          N$ {{ (metrics?.totalExpected ?? 0).toLocaleString() }}
        </p>
      </div>
    </div>

    <div v-if="isAdmin" class="border rounded-lg p-4 mb-6">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold">Recent Penalties (30 days)</h2>
        <p class="text-xs text-gray-400">
          {{ metrics?.recentPenalties?.count ?? 0 }} penalties • N$ {{ (metrics?.recentPenalties?.amount ?? 0).toLocaleString() }}
        </p>
      </div>
      <div v-if="metricsPending" class="text-sm text-gray-400 flex items-center gap-2 py-3">
        <Loader2 class="w-4 h-4 animate-spin" />
        Loading metrics...
      </div>
      <div v-else>
        <div v-if="metrics?.recentPenaltiesList?.length" class="mt-3 space-y-2 text-sm">
          <div
            v-for="penalty in metrics.recentPenaltiesList"
            :key="penalty.id"
            class="flex items-center justify-between border rounded px-3 py-2 cursor-pointer hover:border-cyan-500"
            @click="router.push(`/loans/${penalty.loanId}`)"
          >
            <div>
              <p class="font-medium">{{ penalty.loanReference }}</p>
              <p class="text-xs text-gray-400">
                {{ penalty.type.replace(/_/g, ' ') }} • {{ penalty.months }} months • {{ penalty.rate }}%
              </p>
            </div>
            <div class="text-right">
              <p class="text-sm">N$ {{ penalty.penaltyAmount.toLocaleString() }}</p>
              <p class="text-xs text-gray-400">{{ penalty.createdAt.split('T')[0] }}</p>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-gray-400 mt-3">No penalties in the last 30 days.</p>
      </div>
    </div>

    <div v-if="pending" class="text-sm text-gray-400 flex items-center gap-2 py-3">
      <Loader2 class="w-4 h-4 animate-spin" />
      Loading loans...
    </div>

    <div v-if="loans && loans.items.length" class="overflow-x-auto">
      <!-- Loan table header -->
      <div class="grid grid-cols-4 md:grid-cols-6 text-xs text-gray-400 mb-2 min-w-[520px] md:min-w-[640px]">
        <span>Client</span>
        <span>Amount</span>
        <span class="hidden md:block">Quantity</span>
        <span>Status</span>
        <span class="hidden md:block">Due Date</span>
        <span></span>
      </div>

      <!-- Loan table rows -->
      <div
        v-for="loan in loans.items"
        :key="loan.id"
        class="grid grid-cols-4 md:grid-cols-6 items-center py-3 border-t border-white/5 text-sm min-w-[520px] md:min-w-[640px]"
      >
        <span>{{ loan.client }}</span>
        <span>N$ {{ loan.amount.toLocaleString() }}</span>
        <span class="hidden md:block">{{ loan.quantity }}</span>
        <span
          :class="[
            'px-2 py-1 rounded-full w-fit text-xs',
            statusColor(loan.status)
          ]"
        >
          {{ loan.status }}
        </span>
        <span class="hidden md:block">{{ loan.due }}</span>
        <button
          class="text-xs text-cyan-400 hover:underline"
          @click="router.push(`/loans/${loan.id}`)"
        >
          View
        </button>
      </div>
    </div>
  </section>
</template>
