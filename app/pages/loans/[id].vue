<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import sideNav from '~/components/sideNav.vue'
import { Download, FileText, FileSignature, PencilLine, Trash2, X, Loader2 } from 'lucide-vue-next'
import { createNewLoanWithPreFill } from '~/utils/createNewLoanWithPreFill'
import { useToast } from '~/composables/useToast'

const route = useRoute()
const router = useRouter()
const { addToast } = useToast()
const sidebarCollapsed = ref(true)

const loanId = computed(() => String(route.params.id || ''))

const { data: loan, pending, error, refresh } = await useFetch(() => `/api/loans/${loanId.value}`)

const actionError = ref<string | null>(null)
const actionSuccess = ref<string | null>(null)
const selectedStatus = ref<string>('')
const signedContractFile = ref<File | null>(null)
const updatingStatus = ref(false)
const updatingContract = ref(false)
const deletingLoan = ref(false)
const editingStatus = ref(false)
const updatingQuantity = ref(false)
const emailingContract = ref(false)
const repayableAdjustmentMode = ref<'monthly' | 'custom'>('monthly')
const customReductionAmount = ref<number | null>(null)
const updatingRepayable = ref(false)
const applyingPenalty = ref(false)
const penaltyMonths = ref<number | null>(3)
const extensionMonths = ref<number | null>(1)
const penaltyModalOpen = ref(false)
const applyInstallmentPenalty = ref(false)
const applyPeriodExtension = ref(false)
const applyFullRepayment = ref(false)
const penaltyReasonInstallment = ref('')
const penaltyReasonExtension = ref('')
const penaltyReasonFull = ref('')
const viewTab = ref<'info' | 'history'>('info')
const deleteModalOpen = ref(false)

function closePenaltyModal() {
  clearAndClosePenalties()
}

function closeDeleteModal() {
  deleteModalOpen.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (penaltyModalOpen.value) closePenaltyModal()
  if (deleteModalOpen.value) closeDeleteModal()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

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

function createNewLoanFromClient() {
  if (!loan.value) return
  createNewLoanWithPreFill(router, loan.value)
}

async function increaseQuantity() {
  if (!loan.value) return
  if (loan.value.status !== 'COMPLETED') {
    actionError.value = 'Quantity can only be increased for completed loans'
    addToast({ message: actionError.value, variant: 'error' })
    return
  }
  updatingQuantity.value = true
  actionError.value = null
  actionSuccess.value = null
  try {
    await $fetch(`/api/loans/${loan.value.id}/quantity`, {
      method: 'PATCH',
      body: { quantity: (loan.value.quantity ?? 0) + 1 }
    })
    await refresh()
    actionSuccess.value = 'Quantity updated'
    addToast({ message: 'Loan updated', variant: 'success' })
  } catch (e: any) {
    actionError.value = e?.data?.message ?? 'Failed to update quantity'
    addToast({ message: actionError.value, variant: 'error' })
  } finally {
    updatingQuantity.value = false
  }
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
    addToast({ message: 'Loan updated', variant: 'success' })
  } catch (e: any) {
    actionError.value = e?.data?.message ?? 'Failed to update status'
    addToast({ message: actionError.value, variant: 'error' })
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

async function uploadSignedContract() {
  actionError.value = null
  actionSuccess.value = null

  if (!signedContractFile.value) {
    actionError.value = 'Select a signed contract file to upload'
    return
  }

  updatingContract.value = true
  try {
    const form = new FormData()
    form.append('contract', signedContractFile.value)

    await $fetch(`/api/loans/${loanId.value}/contract`, {
      method: 'POST',
      body: form
    })
    await refresh()
    signedContractFile.value = null
    actionSuccess.value = 'Signed contract uploaded'
    addToast({ message: 'Loan updated', variant: 'success' })
  } catch (e: any) {
    actionError.value = e?.data?.message ?? 'Failed to upload signed contract'
    addToast({ message: actionError.value, variant: 'error' })
  } finally {
    updatingContract.value = false
  }
}

async function deleteLoan() {
  actionError.value = null
  actionSuccess.value = null

  deletingLoan.value = true
  try {
    await $fetch(`/api/loans/${loanId.value}`, { method: 'DELETE' })
    addToast({ message: 'Loan deleted', variant: 'success' })
    router.push('/dashboard')
    deleteModalOpen.value = false
  } catch (e: any) {
    actionError.value = e?.data?.message ?? 'Failed to delete loan'
    addToast({ message: actionError.value, variant: 'error' })
  } finally {
    deletingLoan.value = false
  }
}

async function emailContract() {
  if (!loan.value?.contract) return
  actionError.value = null
  actionSuccess.value = null
  emailingContract.value = true
  try {
    await $fetch(`/api/contracts/${loan.value.contract.id}/email`, { method: 'POST' })
    actionSuccess.value = loan.value.contract.signed
      ? 'Signed contract emailed'
      : 'Unsigned contract emailed'
    addToast({ message: 'Loan updated', variant: 'success' })
  } catch (e: any) {
    actionError.value = e?.data?.message ?? 'Failed to email contract'
    addToast({ message: actionError.value, variant: 'error' })
  } finally {
    emailingContract.value = false
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

const totalRepayable = computed(() => Number(loan.value?.totalAmountRepayable ?? 0))
const remainingAmount = computed(() => Number(loan.value?.remainingAmount ?? totalRepayable.value))
const totalMonthlyInstallment = computed(() => Number(loan.value?.totalMonthlyInstallment ?? 0))
const reductionAmount = computed(() => {
  if (repayableAdjustmentMode.value === 'monthly') return totalMonthlyInstallment.value
  return Math.max(Number(customReductionAmount.value ?? 0), 0)
})
const adjustedRepayable = computed(() => {
  const remaining = remainingAmount.value - reductionAmount.value
  return Math.max(remaining, 0)
})

function formatCurrency(value: number) {
  return `N$ ${value.toLocaleString()}`
}

async function saveRemainingAmount() {
  if (!loan.value) return
  if (loan.value.status !== 'ACTIVE') {
    actionError.value = 'Remaining amount can only be updated for active loans'
    addToast({ message: actionError.value, variant: 'error' })
    return
  }
  actionError.value = null
  actionSuccess.value = null
  updatingRepayable.value = true
  try {
    await $fetch(`/api/loans/${loan.value.id}/repayable`, {
      method: 'PATCH',
      body: { remainingAmount: adjustedRepayable.value }
    })
    await refresh()
    actionSuccess.value = 'Remaining amount updated'
    addToast({ message: 'Loan updated', variant: 'success' })
  } catch (e: any) {
    actionError.value = e?.data?.message ?? 'Failed to update remaining amount'
    addToast({ message: actionError.value, variant: 'error' })
  } finally {
    updatingRepayable.value = false
  }
}

async function applySelectedPenalties() {
  if (!loan.value) return
  actionError.value = null
  actionSuccess.value = null
  applyingPenalty.value = true
  try {
    const requests: Array<Promise<any>> = []

    if (applyInstallmentPenalty.value) {
      requests.push($fetch(`/api/loans/${loan.value.id}/penalties`, {
        method: 'POST',
        body: {
          months: penaltyMonths.value,
          type: 'INSTALLMENT_INCREASE',
          reason: penaltyReasonInstallment.value
        }
      }))
    }

    if (applyPeriodExtension.value) {
      requests.push($fetch(`/api/loans/${loan.value.id}/penalties`, {
        method: 'POST',
        body: {
          months: extensionMonths.value,
          type: 'PERIOD_EXTENSION',
          reason: penaltyReasonExtension.value
        }
      }))
    }

    if (applyFullRepayment.value) {
      requests.push($fetch(`/api/loans/${loan.value.id}/penalties`, {
        method: 'POST',
        body: { type: 'FULL_REPAYMENT_DEMAND', reason: penaltyReasonFull.value }
      }))
    }

    if (!requests.length) {
      actionError.value = 'Select at least one penalty'
      return
    }

    await Promise.all(requests)
    await refresh()
    actionSuccess.value = 'Penalty applied'
    addToast({ message: 'Loan updated', variant: 'success' })
    penaltyModalOpen.value = false
  } catch (e: any) {
    actionError.value = e?.data?.message ?? 'Failed to apply penalty'
    addToast({ message: actionError.value, variant: 'error' })
  } finally {
    applyingPenalty.value = false
  }
}

function clearAndClosePenalties() {
  applyInstallmentPenalty.value = false
  applyPeriodExtension.value = false
  applyFullRepayment.value = false
  penaltyMonths.value = 3
  extensionMonths.value = 1
  penaltyReasonInstallment.value = ''
  penaltyReasonExtension.value = ''
  penaltyReasonFull.value = ''
  penaltyModalOpen.value = false
}
</script>

<template>
  <sideNav 
    v-model:collapsed="sidebarCollapsed"
  />

  <section class="page-shell" :class="sidebarCollapsed ? 'ml-0 md:ml-16' : 'ml-0 md:ml-64'">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
      <h1 class="text-2xl font-semibold heading">Loan Details</h1>
      <div class="flex items-center gap-3">
        <button
          @click="increaseQuantity"
          :disabled="updatingQuantity || loan?.status !== 'COMPLETED'"
          class="btn btn-primary"
        >
          <Loader2 v-if="updatingQuantity" class="w-4 h-4 animate-spin" />
          {{ updatingQuantity ? 'Updating...' : '+ Quantity' }}
        </button>
      </div>
    </div>

    <div class="flex items-center gap-3 mb-4">
      <button
        class="btn btn-outline"
        :class="viewTab === 'info' ? 'border-cyan-500 text-cyan-500' : 'border-gray-300 text-gray-500'"
        @click="viewTab = 'info'"
      >
        Loan Info & Actions
      </button>
      <button
        class="btn btn-outline"
        :class="viewTab === 'history' ? 'border-cyan-500 text-cyan-500' : 'border-gray-300 text-gray-500'"
        @click="viewTab = 'history'"
      >
        Loan History
      </button>
    </div>

    <div v-if="pending" class="text-sm text-gray-400 flex items-center gap-2">
      <Loader2 class="w-4 h-4 animate-spin" />
      Loading loan...
    </div>
    <div v-else-if="error" class="text-sm text-red-400">
      Failed to load loan details.
    </div>

    <div v-else-if="loan && viewTab === 'info'" class="space-y-6">
      <div v-if="actionError" class="text-sm text-red-400">{{ actionError }}</div>
      <div v-if="actionSuccess" class="text-sm text-green-400">{{ actionSuccess }}</div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              class="input"
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
          <p class="text-xs text-gray-400">Quantity</p>
          <p class="text-sm">{{ loan.quantity }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400">Start Date</p>
          <p class="text-sm">{{ formatDate(loan.startDate) }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400">End Date</p>
          <p class="text-sm">{{ formatDate(loan.endDate) }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400">Total Repayable</p>
          <p class="text-sm">{{ formatCurrency(totalRepayable) }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400">Total Monthly Installment</p>
          <p class="text-sm">{{ formatCurrency(totalMonthlyInstallment) }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400">Remaining Amount</p>
          <p class="text-sm">{{ formatCurrency(remainingAmount) }}</p>
        </div>
      </div>

      <div class="border-t border-white/5 pt-4">
        <h2 class="text-sm font-medium mb-2">Reduce Total Repayable</h2>
        <p v-if="loan.status !== 'ACTIVE'" class="text-xs text-gray-400 mb-3">
          Remaining amount can only be reduced when the loan is ACTIVE.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <label class="flex items-center gap-2">
              <input
                type="radio"
                name="repayableAdjustment"
                value="monthly"
                v-model="repayableAdjustmentMode"
                :disabled="loan.status !== 'ACTIVE'"
              />
              <span>Use total monthly installment</span>
            </label>
            <label class="mt-3 flex items-center gap-2">
              <input
                type="radio"
                name="repayableAdjustment"
                value="custom"
                v-model="repayableAdjustmentMode"
                :disabled="loan.status !== 'ACTIVE'"
              />
              <span>Enter custom amount</span>
            </label>
            <div v-if="repayableAdjustmentMode === 'custom'" class="mt-2">
              <input
                type="number"
                min="0"
                step="0.01"
                class="input"
                v-model.number="customReductionAmount"
                placeholder="0.00"
                :disabled="loan.status !== 'ACTIVE'"
              />
            </div>
            <button
              class="mt-3 btn btn-primary"
              :disabled="loan.status !== 'ACTIVE' || updatingRepayable || (repayableAdjustmentMode === 'custom' && (customReductionAmount === null || Number.isNaN(customReductionAmount)))"
              @click="saveRemainingAmount"
            >
              <Loader2 v-if="updatingRepayable" class="w-4 h-4 animate-spin" />
              {{ updatingRepayable ? 'Saving...' : 'Save remaining amount' }}
            </button>
          </div>
          <div>
            <p class="text-xs text-gray-400">Reduction Amount</p>
            <p class="text-sm">{{ formatCurrency(reductionAmount) }}</p>
            <p class="text-xs text-gray-400 mt-3">Adjusted Total Repayable</p>
            <p class="text-sm font-semibold">{{ formatCurrency(adjustedRepayable) }}</p>
          </div>
        </div>
      </div>

      <div class="border-t border-white/5 pt-4">
        <h2 class="text-sm font-medium mb-2">Client</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
        <h2 class="text-sm font-medium mb-2">Penalties</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <button
              v-if="loan.status === 'ACTIVE'"
              class="btn btn-primary"
              @click="penaltyModalOpen = true"
            >
              Manage Penalties
            </button>
            <p v-else class="text-xs text-gray-400">Penalties can only be applied to active loans.</p>
          </div>
        </div>
      </div>

      <div
        v-if="penaltyModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <div class="modal-card w-full max-w-md p-6 text-black">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">Apply Penalties</h2>
            <button class="text-gray-500 hover:text-gray-700" @click="closePenaltyModal">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="space-y-4 text-sm">
            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="applyInstallmentPenalty" />
              <span>5% installment penalty</span>
            </label>
            <div v-if="applyInstallmentPenalty">
              <label class="text-xs text-gray-500">Penalty Months</label>
              <input
                type="number"
                min="1"
                step="1"
                class="input mt-2"
                v-model.number="penaltyMonths"
              />
              <label class="text-xs text-gray-500 mt-2 block">Reason</label>
              <input
                type="text"
                class="input mt-2"
                v-model="penaltyReasonInstallment"
                placeholder="Reason for penalty"
              />
            </div>

            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="applyPeriodExtension" />
              <span>Extend loan period</span>
            </label>
            <div v-if="applyPeriodExtension">
              <label class="text-xs text-gray-500">Extension Months</label>
              <input
                type="number"
                min="1"
                step="1"
                class="input mt-2"
                v-model.number="extensionMonths"
              />
              <label class="text-xs text-gray-500 mt-2 block">Reason</label>
              <input
                type="text"
                class="input mt-2"
                v-model="penaltyReasonExtension"
                placeholder="Reason for extension"
              />
            </div>

            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="applyFullRepayment" />
              <span>Demand full repayment immediately</span>
            </label>
            <div v-if="applyFullRepayment">
              <label class="text-xs text-gray-500 mt-2 block">Reason</label>
              <input
                type="text"
                class="input mt-2"
                v-model="penaltyReasonFull"
                placeholder="Reason for full repayment"
              />
            </div>
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <button
              class="btn btn-outline"
              @click="clearAndClosePenalties"
            >
              Clear & Close
            </button>
            <button
              class="btn btn-primary"
              :disabled="applyingPenalty || (applyInstallmentPenalty && !penaltyMonths) || (applyPeriodExtension && !extensionMonths)"
              @click="applySelectedPenalties"
            >
              <Loader2 v-if="applyingPenalty" class="w-4 h-4 animate-spin" />
              {{ applyingPenalty ? 'Applying...' : 'OK' }}
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
          <p class="text-sm" :class="loan.contract ? '' : 'text-gray-400'">
            <span class="inline-flex items-center gap-2">
              <FileSignature class="w-4 text-cyan-500" />
              <span v-if="loan.contract">
                {{ loan.contract.signed ? 'Signed contract' : 'Unsigned contract' }}
              </span>
              <span v-else>No contract attached</span>
            </span>
          </p>
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
        <div v-if="loan.contract" class="mt-2">
          <button
            class="text-cyan-400 text-xs hover:underline inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="emailingContract"
            @click="emailContract"
          >
            <Loader2 v-if="emailingContract" class="w-3 h-3 animate-spin" />
            {{ emailingContract ? 'Emailing...' : (loan.contract.signed ? 'Email signed contract' : 'Email unsigned contract') }}
          </button>
        </div>
        <div class="mt-3">
          <label class="block text-xs text-gray-400 mb-1">Upload signed contract (PDF)</label>
          <input
            type="file"
            accept="application/pdf"
            class="text-sm"
            @change="e => { signedContractFile = (e.target as HTMLInputElement).files?.[0] ?? null; uploadSignedContract() }"
          />
        </div>
      </div>

      <div class="border-t border-white/5 pt-6 flex">
          <button
          @click="deleteModalOpen = true"
          :disabled="deletingLoan"
          class="btn inline-flex items-center gap-2 bg-red-500 text-white hover:bg-red-600"
        >
          <Loader2 v-if="deletingLoan" class="w-4 h-4 animate-spin" />
          <Trash2 v-else class="w-4" />
          {{ deletingLoan ? 'Deleting...' : 'Delete Loan' }}
        </button>
      </div>
    </div>

    <div v-else-if="loan && viewTab === 'history'" class="space-y-4">
      <div class="border rounded px-3 py-2 bg-white/5">
        <h3 class="text-sm font-semibold mb-2 text-gray-900">Penalty History</h3>
        <div v-if="loan.penalties?.length" class="space-y-2 text-sm">
          <div
            v-for="penalty in loan.penalties"
            :key="penalty.id"
            class="border rounded px-3 py-2 text-xs text-gray-600 bg-white/5"
          >
            <p class="text-gray-200">
              {{
                penalty.type === 'PERIOD_EXTENSION'
                  ? `Period extension - ${penalty.months} months`
                  : penalty.type === 'FULL_REPAYMENT'
                    ? 'Full repayment demand'
                    : `Installment penalty - ${penalty.months} months`
              }}
            </p>
            <p v-if="penalty.type === 'INSTALLMENT_RATE'" class="text-gray-400">
              Rate: {{ penalty.rate }}% - Amount: N$ {{ penalty.penaltyAmount.toLocaleString() }}
            </p>
            <p v-if="penalty.reason" class="text-gray-400">
              Reason: {{ penalty.reason }}
            </p>
            <p class="text-gray-400">
              Applied: {{ formatDate(penalty.createdAt) }}
            </p>
          </div>
        </div>
        <p v-else class="card-muted p-3 text-sm text-gray-500">No penalties applied.</p>
      </div>

      <div v-if="loan.activities?.length" class="space-y-2 text-sm">
        <div
          v-for="activity in loan.activities"
          :key="activity.id"
          class="border rounded px-3 py-2 bg-white/5"
        >
          <div class="flex items-center justify-between">
            <p class="text-gray-200">
              {{ activity.type.replace(/_/g, ' ') }}
            </p>
            <p class="text-xs text-gray-400">{{ formatDate(activity.createdAt) }}</p>
          </div>
          <p v-if="activity.details" class="text-xs text-gray-400 mt-1">
            {{ activity.details }}
          </p>
          <p v-if="activity.performedBy" class="text-xs text-gray-400 mt-1">
            By {{ activity.performedBy.name }} ({{ activity.performedBy.email }})
          </p>
        </div>
      </div>
      <p v-else class="card-muted p-3 text-sm text-gray-500">No activity history found.</p>
    </div>
  </section>

  <div
    v-if="deleteModalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
  >
    <div class="modal-card w-full max-w-md p-6 text-black">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Delete Loan</h2>
        <button class="text-gray-500 hover:text-gray-700" @click="closeDeleteModal">
          <X class="w-4 h-4" />
        </button>
      </div>
      <p class="text-sm text-gray-600">Are you sure you want to delete this loan? This cannot be undone.</p>
      <div class="mt-4 flex justify-end gap-2">
        <button class="px-3 py-2 text-sm rounded border" @click="closeDeleteModal">
          Cancel
        </button>
        <button
          class="px-3 py-2 text-sm rounded bg-red-500 text-white disabled:bg-red-200 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="deletingLoan"
          @click="deleteLoan"
        >
          <Loader2 v-if="deletingLoan" class="w-4 h-4 animate-spin" />
          {{ deletingLoan ? 'Deleting...' : 'OK' }}
        </button>
      </div>
    </div>
  </div>
</template>
