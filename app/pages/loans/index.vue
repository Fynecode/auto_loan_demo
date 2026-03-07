<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import sideNav from '~/components/sideNav.vue'
import { useRouter } from 'vue-router'
import { Loader2, X } from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'

const router = useRouter()
const { addToast } = useToast()
const { user } = useAuth()
const isAdmin = computed(() => user.value?.role === 'ADMIN')

const sidebarCollapsed = ref(true)
const sort = ref<'newest' | 'oldest'>('newest')
const status = ref<'all' | 'active' | 'completed' | 'drafted' | 'pending' | 'cancelled'>('all')
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

const assigningLoan = ref<any | null>(null)
const assignees = ref<Array<{ id: string; name: string; email: string }>>([])
const staff = ref<Array<{ id: string; name: string; email: string }>>([])
const availableStaff = computed(() => {
  const assigned = new Set(assignees.value.map((s) => s.id))
  return staff.value.filter((s) => !assigned.has(s.id))
})
const assigneesLoading = ref(false)
const assigneesError = ref<string | null>(null)

function closeAssignModal() {
  assigningLoan.value = null
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && assigningLoan.value) {
    closeAssignModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

async function openAssignModal(loan: any) {
  assigningLoan.value = loan
  assigneesLoading.value = true
  assigneesError.value = null
  try {
    const data = await $fetch(`/api/loans/${loan.id}/assignees`)
    assignees.value = data.assignees || []
    staff.value = data.staff || []
  } catch (e: any) {
    assigneesError.value = e?.data?.message ?? 'Failed to load assignees'
  } finally {
    assigneesLoading.value = false
  }
}

async function assignStaff(userId: string) {
  if (!assigningLoan.value) return
  try {
    await $fetch(`/api/loans/${assigningLoan.value.id}/assignees`, {
      method: 'POST',
      body: { userId }
    })
    await openAssignModal(assigningLoan.value)
    addToast({ message: 'Staff assigned', variant: 'success' })
  } catch (e: any) {
    addToast({ message: e?.data?.message ?? 'Failed to assign staff', variant: 'error' })
  }
}

async function unassignStaff(userId: string) {
  if (!assigningLoan.value) return
  try {
    await $fetch(`/api/loans/${assigningLoan.value.id}/assignees`, {
      method: 'DELETE',
      body: { userId }
    })
    await openAssignModal(assigningLoan.value)
    addToast({ message: 'Staff unassigned', variant: 'success' })
  } catch (e: any) {
    addToast({ message: e?.data?.message ?? 'Failed to unassign staff', variant: 'error' })
  }
}
</script>

<template>
  <sideNav v-model:collapsed="sidebarCollapsed" />

  <section
    class="page-shell"
    :class="sidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64'"
  >
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold heading">Loans</h1>
    </div>

    <div v-if="pending" class="text-sm text-gray-400 flex items-center gap-2 py-3">
      <Loader2 class="w-4 h-4 animate-spin" />
      Loading loans...
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-4 mb-4">
      <div class="flex items-center gap-2">
        <label class="text-xs text-gray-400">Search</label>
        <input
          v-model="search"
          type="text"
          placeholder="Name, email, reference..."
          class="input"
        />
      </div>
      <div class="flex items-center gap-2">
        <label class="text-xs text-gray-400">Sort</label>
        <select v-model="sort" class="input">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-xs text-gray-400">Status</label>
        <select v-model="status" class="input">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="drafted">Drafted</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
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
          <button
            v-if="isAdmin"
            class="btn btn-ghost text-xs"
            @click="openAssignModal(loan)"
          >
            Assign
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="!pending" class="card-muted p-6 text-sm text-gray-500">
      {{ isAdmin ? 'No loans found for the selected filters.' : 'No loans assigned to you yet.' }}
    </div>

    <div v-if="loans" class="flex items-center justify-between mt-6 text-sm">
      <span class="text-gray-400">
        Page {{ loans.page }} of {{ loans.totalPages }} • {{ loans.total }} total
      </span>
      <div class="flex items-center gap-2">
        <button
          @click="prevPage"
          :disabled="loans.page <= 1"
          class="btn btn-outline"
        >
          Prev
        </button>
        <button
          @click="nextPage"
          :disabled="loans.page >= loans.totalPages"
          class="btn btn-outline"
        >
          Next
        </button>
      </div>
    </div>
  </section>

  <div v-if="assigningLoan" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="modal-card w-full max-w-lg p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold">Assign Staff</h3>
        <button class="text-gray-500 hover:text-gray-700" @click="closeAssignModal">
          <X class="w-4 h-4" />
        </button>
      </div>

      <div v-if="assigneesLoading" class="text-xs text-gray-400 flex items-center gap-2">
        <Loader2 class="w-4 h-4 animate-spin" />
        Loading assignments...
      </div>
      <div v-else-if="assigneesError" class="text-xs text-red-400">{{ assigneesError }}</div>

      <div v-else class="space-y-4 text-sm">
        <div>
          <p class="text-xs text-gray-500 mb-1">Assigned staff</p>
          <div v-if="!assignees.length" class="text-xs text-gray-400">No staff assigned.</div>
          <div v-else class="space-y-2">
            <div
              v-for="staffer in assignees"
              :key="staffer.id"
              class="flex items-center justify-between border rounded px-3 py-2"
            >
              <div>
                <p class="font-medium">{{ staffer.name || 'Unnamed' }}</p>
                <p class="text-xs text-gray-400">{{ staffer.email }}</p>
              </div>
              <button
                class="text-xs text-red-500 hover:underline"
                @click="unassignStaff(staffer.id)"
              >
                Unassign
              </button>
            </div>
          </div>
        </div>

        <div>
          <p class="text-xs text-gray-500 mb-1">Available staff</p>
          <div v-if="!staff.length" class="text-xs text-gray-400">No staff available.</div>
          <div v-else class="space-y-2">
            <div
              v-for="staffer in availableStaff"
              :key="staffer.id"
              class="flex items-center justify-between border rounded px-3 py-2"
            >
              <div>
                <p class="font-medium">{{ staffer.name || 'Unnamed' }}</p>
                <p class="text-xs text-gray-400">{{ staffer.email }}</p>
              </div>
              <button
                class="text-xs text-cyan-500 hover:underline"
                @click="assignStaff(staffer.id)"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
