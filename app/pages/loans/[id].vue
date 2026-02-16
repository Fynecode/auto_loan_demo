<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import sideNav from '~/components/sideNav.vue'
import { Download, FileText, FileSignature, PencilLine, Trash2, X } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const sidebarCollapsed = ref(false)

const loanId = computed(() => String(route.params.id || ''))

const { data: loan, pending, error, refresh } = await useFetch(() => `/api/loans/${loanId.value}`)

const actionError = ref<string | null>(null)
const actionSuccess = ref<string | null>(null)
const selectedStatus = ref<string>('')
const contractFile = ref<File | null>(null)
const updatingStatus = ref(false)
const updatingContract = ref(false)
const deletingLoan = ref(false)
const editingStatus = ref(false)
const editingContract = ref(false)

const allowedTransitions: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['OVERDUE', 'COMPLETED'],
  OVERDUE: ['COMPLETED'],
  DEFAULTED: [],
  COMPLETED: [],
  CANCELLED: []
}

const nextStatusOptions = computed(() => {
  const status = loan.value?.status
  if (!status) return []
  return allowedTransitions[status] ?? []
})

function backToDashboard() {
  router.push('/dashboard')
}

function createNewLoanFromClient() {
  if (!loan.value?.client) return
  router.push({
    path: '/createloan',
    query: {
      fullName: loan.value.client.firstName ?? '',
      email: loan.value.client.email ?? '',
      idNumber: loan.value.client.idNumber ?? '',
      empNumber: loan.value.client.empNumber ?? '',
      phone: loan.value.client.phone ?? ''
    }
  })
}

async function updateStatus() {
  actionError.value = null
  actionSuccess.value = null

  if (!selectedStatus.value) {
    actionError.value = 'Select a status to continue'
    return
  }

  updatingStatus.value = true
  try {
    await $fetch(`/api/loans/${loanId.value}/transition`, {
      method: 'POST',
      body: { nextStatus: selectedStatus.value }
    })
    await refresh()
    selectedStatus.value = ''
    editingStatus.value = false
    actionSuccess.value = 'Status updated'
  } catch (e: any) {
    actionError.value = e?.data?.message ?? 'Failed to update status'
    editingStatus.value = false
  } finally {
    updatingStatus.value = false
  }
}

function toggleStatusEdit() {
  if (!loan.value) return
  if (!nextStatusOptions.value.length) return
  editingStatus.value = !editingStatus.value
  selectedStatus.value = ''
}

function toggleContractEdit() {
  editingContract.value = !editingContract.value
  contractFile.value = null
}

async function updateContract() {
  actionError.value = null
  actionSuccess.value = null

  if (!contractFile.value) {
    actionError.value = 'Select a contract file to upload'
    return
  }

  updatingContract.value = true
  try {
    const form = new FormData()
    form.append('contract', contractFile.value)

    await $fetch(`/api/loans/${loanId.value}/contract`, {
      method: 'POST',
      body: form
    })
    await refresh()
    contractFile.value = null
    editingContract.value = false
    actionSuccess.value = 'Contract updated'
  } catch (e: any) {
    actionError.value = e?.data?.message ?? 'Failed to update contract'
    editingContract.value = false
  } finally {
    updatingContract.value = false
  }
}

async function deleteLoan() {
  actionError.value = null
  actionSuccess.value = null

  if (!confirm('Delete this loan? This cannot be undone.')) return

  deletingLoan.value = true
  try {
    await $fetch(`/api/loans/${loanId.value}`, { method: 'DELETE' })
    router.push('/dashboard')
  } catch (e: any) {
    actionError.value = e?.data?.message ?? 'Failed to delete loan'
  } finally {
    deletingLoan.value = false
  }
}

function formatDate(value: string | null) {
  if (!value) return '--'
  const date = new Date(value)
  return isNaN(date.getTime()) ? '--' : date.toISOString().split('T')[0]
}

function getDownloadName(url: string, fallbackBase: string) {
  const cleanUrl = url.split('?')[0]
  const lastSegment = cleanUrl.split('/').pop() || ''
  const ext = lastSegment.includes('.') ? lastSegment.split('.').pop() || '' : ''
  const safeExt = ext && ext.length <= 5 ? `.${ext}` : '.pdf'
  return `${fallbackBase}${safeExt}`
}
</script>

<template>
  <sideNav 
    v-model:collapsed="sidebarCollapsed"
  />

  <section class="p-6 transition-all duration-300" :class="sidebarCollapsed ? 'ml-16' : 'ml-[20%]'">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-semibold">Loan Details</h1>
      <button
        @click="backToDashboard"
        class="text-sm text-cyan-500 hover:underline"
      >
        Back to dashboard
      </button>
    </div>

    <div v-if="pending" class="text-sm text-gray-400">Loading loan…</div>
    <div v-else-if="error" class="text-sm text-red-400">
      Failed to load loan details.
    </div>

    <div v-else-if="loan" class="space-y-6">
      <div v-if="actionError" class="text-sm text-red-400">{{ actionError }}</div>
      <div v-if="actionSuccess" class="text-sm text-green-400">{{ actionSuccess }}</div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-xs text-gray-400">Reference</p>
          <p class="text-sm">{{ loan.reference }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400">Status</p>
          <div class="mt-1 flex items-center gap-2">
            <select
              v-if="editingStatus"
              v-model="selectedStatus"
              class="w-full border rounded px-3 py-2 text-sm"
              @change="updateStatus"
            >
              <option value="">Select status</option>
              <option v-for="status in nextStatusOptions" :key="status" :value="status">
                {{ status }}
              </option>
            </select>
            <p v-else class="text-sm">{{ loan.status }}</p>
            <button
              @click="toggleStatusEdit"
              :disabled="!nextStatusOptions.length"
              class="text-xs text-cyan-500 hover:underline disabled:text-gray-300"
            >
              <X v-if="editingStatus" class="w-4 text-red-400" />
              <PencilLine v-else class="w-4 text-cyan-500" />
            </button>
          </div>
        </div>
        <div>
          <p class="text-xs text-gray-400">Principal</p>
          <p class="text-sm">N$ {{ loan.principal.toLocaleString() }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400">Interest Rate</p>
          <p class="text-sm">{{ loan.interestRate }}%</p>
        </div>
        <div>
          <p class="text-xs text-gray-400">Duration</p>
          <p class="text-sm">{{ loan.durationMonths }} months</p>
        </div>
        <div>
          <p class="text-xs text-gray-400">Start Date</p>
          <p class="text-sm">{{ formatDate(loan.startDate) }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400">End Date</p>
          <p class="text-sm">{{ formatDate(loan.endDate) }}</p>
        </div>
      </div>

      <div class="border-t border-white/5 pt-4">
        <h2 class="text-sm font-medium mb-2">Client</h2>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-xs text-gray-400">Name</p>
            <p>{{ loan.client.firstName }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400">Employment No.</p>
            <p>{{ loan.client.empNumber }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400">Email</p>
            <p>{{ loan.client.email }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400">Phone</p>
            <p>{{ loan.client.phone || '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400">ID Number</p>
            <p>{{ loan.client.idNumber || '—' }}</p>
          </div>
          <div>
            <button
              @click="createNewLoanFromClient"
              class="mt-2 text-xs text-cyan-500 hover:underline"
            >
              Create New Loan
            </button>
          </div>
          
        </div>
      </div>

      <div class="border-t border-white/5 pt-4">
        <h2 class="text-sm font-medium mb-2">Documents</h2>
        <div v-if="loan.documents.length" class="space-y-2 text-sm">
          <div v-for="doc in loan.documents" :key="doc.id" class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <FileText class="w-4 text-cyan-500" />
                <p>{{ doc.type }}</p>
              </div>
              <p class="text-xs text-gray-400">{{ formatDate(doc.uploadedAt) }}</p>
            </div>
            <a
              :href="`/api/documents/${doc.id}/download`"
              class="text-cyan-400 text-xs hover:underline"
              :download="getDownloadName(doc.fileUrl, `document-${doc.id}`)"
            >
              <span class="inline-flex items-center gap-1">
                <Download class="w-4" />
                Download
              </span>
            </a>
          </div>
        </div>
        <p v-else class="text-sm text-gray-400">No documents uploaded.</p>
      </div>

      <div class="border-t border-white/5 pt-4">
        <h2 class="text-sm font-medium mb-2">Contract</h2>
        <div class="mt-1 flex items-center gap-2">
            <input
              v-if="editingContract"
              type="file"
              accept="application/pdf"
              class="w-[50%] text-sm"
              @change="e => { contractFile = (e.target as HTMLInputElement).files?.[0] ?? null; updateContract() }"
            />
            <p v-else class="text-sm" :class="loan.contract? '': 'text-gray-400'">
              <span class="inline-flex items-center gap-2">
                <FileSignature class="w-4 text-cyan-500" />
                {{ loan.contract ? 'Contract attached' : 'No contract attached' }}
              </span>
            </p>
            <button
              @click="toggleContractEdit"
              class="text-xs text-cyan-500 hover:underline"
            >
              <X v-if="editingContract" class="w-4 text-red-400" />
              <PencilLine v-else class="w-4 text-cyan-500" />
            </button>
          </div>
        <div v-if="loan.contract" class="mt-2">
          <a
            :href="`/api/contracts/${loan.contract.id}/download`"
            class="text-cyan-400 text-xs hover:underline"
            :download="getDownloadName(loan.contract.fileUrl, `contract-${loan.id}`)"
          >
            <span class="inline-flex items-center gap-1">
              <Download class="w-4" />
              Download Contract
            </span>
          </a>
        </div>
      </div>

      <div class="border-t border-white/5 pt-6 flex">
        <button
          @click="deleteLoan"
          :disabled="deletingLoan"
          class="px-3 py-2 text-sm rounded bg-red-500 text-white disabled:bg-red-200 inline-flex items-center gap-2"
        >
          <Trash2 class="w-4" />
          {{ deletingLoan ? 'Deleting...' : 'Delete Loan' }}
        </button>
      </div>
    </div>
  </section>
</template>


