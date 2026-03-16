<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import sideNav from '~/components/sideNav.vue'
import { PencilLine, X, Loader2 } from 'lucide-vue-next'
import { hasEmptyFields, isValidEmail, isValidNamibianID, isValidNamibianPhone } from '~/utils/loanValidation'
import { useToast } from '~/composables/useToast'

const sidebarCollapsed = ref(true)
const { addToast } = useToast()
const sort = ref<'newest' | 'oldest'>('newest')
const search = ref('')
const page = ref(1)
const pageSize = 15
const editingClient = ref<any | null>(null)
const savingClient = ref(false)
const editError = ref<string | null>(null)
const editForm = ref({
  fullName: '',
  email: '',
  phone: '',
  empNumber: '',
  idNumber: ''
})

watch([sort, search], () => {
  page.value = 1
})

const query = computed(() => ({
  sort: sort.value,
  search: search.value,
  page: page.value,
  pageSize
}))

const { data: clients, pending, error, refresh } = await useFetch('/api/clients', {
  query
})

if (error.value) {
  console.error('Error fetching clients:', error.value)
}

function prevPage() {
  if (!clients.value) return
  page.value = Math.max(1, page.value - 1)
}

function nextPage() {
  if (!clients.value) return
  page.value = Math.min(clients.value.totalPages, page.value + 1)
}

function openEditClient(client: any) {
  editingClient.value = client
  editError.value = null
  editForm.value = {
    fullName: client.fullName ?? '',
    email: client.email ?? '',
    phone: client.phone && client.phone !== '-' ? client.phone : '',
    empNumber: client.empNumber ?? '',
    idNumber: client.idNumber ?? ''
  }
}

function closeEditClient() {
  editingClient.value = null
  editError.value = null
}

async function saveClient() {
  if (!editingClient.value) return
  const payload = {
    fullName: editForm.value.fullName.trim(),
    email: editForm.value.email.trim(),
    phone: editForm.value.phone.trim(),
    empNumber: editForm.value.empNumber.trim(),
    idNumber: editForm.value.idNumber.trim()
  }

  if (hasEmptyFields(payload)) {
    editError.value = 'Please fill all fields'
    return
  }

  if (!isValidEmail(payload.email)) {
    editError.value = 'Invalid email address'
    return
  }

  if (!isValidNamibianID(payload.idNumber)) {
    editError.value = 'Invalid Namibian ID number'
    return
  }

  if (!isValidNamibianPhone(payload.phone)) {
    editError.value = 'Invalid Namibian phone number'
    return
  }

  savingClient.value = true
  editError.value = null
  try {
    await $fetch(`/api/clients/${editingClient.value.id}`, {
      method: 'PATCH',
      body: payload
    })
    await refresh()
    addToast({ message: 'Client updated', variant: 'success' })
    editingClient.value = null
  } catch (err: any) {
    editError.value = err?.data?.message ?? 'Failed to update client'
  } finally {
    savingClient.value = false
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (editingClient.value) closeEditClient()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <sideNav v-model:collapsed="sidebarCollapsed" />

  <section
    class="page-shell"
    :class="sidebarCollapsed ? '' : 'md:pl-64'"
  >
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold heading">Clients</h1>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-4 mb-4">
      <div class="flex items-center gap-2">
        <label class="text-xs text-gray-400">Search</label>
        <input
          v-model="search"
          type="text"
          placeholder="Name, email, phone..."
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
    </div>

    <!-- Client table header -->
    <div class="hidden md:grid md:grid-cols-5 table-head mb-2" v-if="clients && clients.items.length">
      <span>Full Name</span>
      <span>Email</span>
      <span>Phone</span>
      <span class="md:col-span-2 text-right">Actions</span>
    </div>

    <!-- Client table rows -->
    <div
      v-if="clients && clients.items.length"
      v-for="client in clients.items"
      :key="client.id"
      class="card p-3 mb-3 flex flex-col gap-2 text-sm hover-lift md:mb-0 md:rounded-none md:border-0 md:bg-transparent md:shadow-none md:p-0 md:grid md:grid-cols-5 md:items-center md:gap-0 md:border-t md:border-white/5 md:py-3"
    >
      <div>
        <p class="text-xs text-gray-400 md:hidden">Full Name</p>
        <span>{{ client.fullName }}</span>
      </div>
      <div>
        <p class="text-xs text-gray-400 md:hidden">Email</p>
        <span>{{ client.email }}</span>
      </div>
      <div>
        <p class="text-xs text-gray-400 md:hidden">Phone</p>
        <span>{{ client.phone }}</span>
      </div>
      <div class="flex items-center gap-2 md:justify-end md:col-span-2">
        <button class="btn btn-ghost text-xs inline-flex items-center gap-1" @click="openEditClient(client)">
          <PencilLine class="w-4 h-4" />
          Edit
        </button>
      </div>
    </div>

    <div v-else-if="!pending" class="card-muted p-6 text-sm text-gray-500">
      No clients found.
    </div>

    <div v-if="clients" class="flex items-center justify-between mt-6 text-sm">
      <span class="text-gray-400">
        Page {{ clients.page }} of {{ clients.totalPages }} • {{ clients.total }} total
      </span>
      <div class="flex items-center gap-2">
        <button
          @click="prevPage"
          :disabled="clients.page <= 1"
          class="btn btn-outline"
        >
          Prev
        </button>
        <button
          @click="nextPage"
          :disabled="clients.page >= clients.totalPages"
          class="btn btn-outline"
        >
          Next
        </button>
      </div>
    </div>
  </section>

  <div v-if="editingClient" class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="modal-card w-full max-w-md p-4 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Edit Client</h3>
        <button class="text-gray-500 hover:text-gray-700" @click="closeEditClient">
          <X class="w-4 h-4" />
        </button>
      </div>
      <p v-if="editError" class="text-red-400 text-sm">{{ editError }}</p>
      <div>
        <label class="text-xs text-gray-500">Full Name</label>
        <input v-model="editForm.fullName" class="input mt-1" :class="editError ? 'border-red-300' : ''" placeholder="Full name" />
      </div>
      <div>
        <label class="text-xs text-gray-500">Email</label>
        <input v-model="editForm.email" class="input mt-1" :class="editError ? 'border-red-300' : ''" placeholder="Email" />
      </div>
      <div>
        <label class="text-xs text-gray-500">Phone</label>
        <input v-model="editForm.phone" class="input mt-1" :class="editError ? 'border-red-300' : ''" placeholder="Phone" />
      </div>
      <div>
        <label class="text-xs text-gray-500">Employment No.</label>
        <input v-model="editForm.empNumber" class="input mt-1" :class="editError ? 'border-red-300' : ''" placeholder="Employment number" />
      </div>
      <div>
        <label class="text-xs text-gray-500">ID Number</label>
        <input v-model="editForm.idNumber" class="input mt-1" :class="editError ? 'border-red-300' : ''" placeholder="ID number" />
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button class="btn btn-outline text-xs" @click="closeEditClient">Cancel</button>
        <button class="btn btn-primary text-xs" :disabled="savingClient" @click="saveClient">
          <Loader2 v-if="savingClient" class="w-4 h-4 animate-spin" />
          {{ savingClient ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>
