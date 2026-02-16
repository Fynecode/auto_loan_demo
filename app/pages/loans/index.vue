<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import sideNav from '~/components/sideNav.vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const sidebarCollapsed = ref(false)
const sort = ref<'newest' | 'oldest'>('newest')
const status = ref<'all' | 'completed' | 'drafted' | 'pending' | 'cancelled'>('all')
const page = ref(1)
const search = ref('')
const pageSize = 15

watch([sort, status, search], () => {
  page.value = 1
})

const query = computed(() => ({
  sort: sort.value,
  status: status.value,
  search: search.value,
  page: page.value,
  pageSize
}))

const { data: loans, pending, error } = await useFetch('/api/loans', {
  query
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

function prevPage() {
  if (!loans.value) return
  page.value = Math.max(1, page.value - 1)
}

function nextPage() {
  if (!loans.value) return
  page.value = Math.min(loans.value.totalPages, page.value + 1)
}
</script>

<template>
  <sideNav v-model:collapsed="sidebarCollapsed" />

  <section
    class="p-6 transition-all duration-300"
    :class="sidebarCollapsed ? 'ml-16' : 'ml-[20%]'"
  >
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-semibold">Loans</h1>
      <button
        @click="router.push('/createloan')"
        class="flex items-center gap-2 px-3 py-1 rounded-lg bg-cyan-500 text-white text-sm hover:bg-cyan-600 transition-colors"
      >
        <span class="text-lg font-bold">+</span>
        <span class="hidden sm:inline">New Loan</span>
      </button>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-4 mb-4">
      <div class="flex items-center gap-2">
        <label class="text-xs text-gray-400">Search</label>
        <input
          v-model="search"
          type="text"
          placeholder="Name, email, reference..."
          class="border rounded px-2 py-1 text-sm"
        />
      </div>
      <div class="flex items-center gap-2">
        <label class="text-xs text-gray-400">Sort</label>
        <select v-model="sort" class="border rounded px-2 py-1 text-sm">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-xs text-gray-400">Status</label>
        <select v-model="status" class="border rounded px-2 py-1 text-sm">
          <option value="all">All</option>
          <option value="completed">Completed</option>
          <option value="drafted">Drafted</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>

    <!-- Loan table header -->
    <div class="grid grid-cols-5 text-xs text-gray-400 mb-2" v-if="loans && loans.items.length">
      <span>Client</span>
      <span>Amount</span>
      <span>Status</span>
      <span>Due Date</span>
      <span></span>
    </div>

    <!-- Loan table rows -->
    <div
      v-if="loans && loans.items.length"
      v-for="loan in loans.items"
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
      <span>{{ loan.due || '-' }}</span>
      <button
        class="text-xs text-cyan-400 hover:underline"
        @click="router.push(`/loans/${loan.id}`)"
      >
        View
      </button>
    </div>

    <div v-else-if="!pending" class="text-sm text-gray-400 border border-dashed rounded p-6">
      No loans found for the selected filters.
    </div>

    <div v-if="loans" class="flex items-center justify-between mt-6 text-sm">
      <span class="text-gray-400">
        Page {{ loans.page }} of {{ loans.totalPages }} • {{ loans.total }} total
      </span>
      <div class="flex items-center gap-2">
        <button
          @click="prevPage"
          :disabled="loans.page <= 1"
          class="px-3 py-1 rounded border text-sm disabled:text-gray-300"
        >
          Prev
        </button>
        <button
          @click="nextPage"
          :disabled="loans.page >= loans.totalPages"
          class="px-3 py-1 rounded border text-sm disabled:text-gray-300"
        >
          Next
        </button>
      </div>
    </div>
  </section>
</template>
