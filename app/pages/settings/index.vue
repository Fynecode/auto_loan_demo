<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import sideNav from '~/components/sideNav.vue'
import { Loader2, PencilLine, Trash2, UserPlus, X } from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { listPreviewMetas, removePreviewMeta } from '../utils/contractPreviewCache'

const sidebarCollapsed = ref(true)
const { addToast } = useToast()

const { user: me, fetchUser } = useAuth()
const profileLoading = ref(false)
const profileError = ref(false)
const isAdmin = computed(() => me.value?.role === 'ADMIN')
const selectedSection = ref<'profile' | 'users' | 'template'>('profile')

const showEditSelf = ref(false)
const selfForm = ref({ name: '', email: '' })

const editingUser = ref<any | null>(null)
const userForm = ref({ name: '', email: '', role: 'STAFF' })
const deletingUserId = ref<string | null>(null)
const showCreateUser = ref(false)
const creatingUser = ref(false)
const createForm = ref({ name: '', email: '', role: 'STAFF', password: '' })

function closeEditSelf() {
  showEditSelf.value = false
}

function closeEditUser() {
  editingUser.value = null
}

function closeCreateUser() {
  showCreateUser.value = false
}

function closeDeleteUser() {
  deletingUserId.value = null
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (showEditSelf.value) closeEditSelf()
  if (editingUser.value) closeEditUser()
  if (showCreateUser.value) closeCreateUser()
  if (deletingUserId.value) closeDeleteUser()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

const { data: users, pending: usersPending, error: usersError, refresh: refreshUsers } = await useFetch('/api/settings/users', {
  immediate: false,
  server: false
})

const visibleUsers = computed(() => {
  const currentId = me.value?.id
  const list = users.value ?? []
  if (!currentId) return list
  return list.filter((user: any) => user.id !== currentId)
})

watch(me, (value) => {
  if (!value) return
  selfForm.value = {
    name: (value as any).name ?? '',
    email: (value as any).email ?? ''
  }
  if (value.role === 'ADMIN') {
    refreshUsers()
  }
}, { immediate: true })

watch(isAdmin, (value) => {
  if (value) {
    refreshUsers()
  }
}, { immediate: true })

const templatePreviewUrl = computed(() => '/api/settings/contract-template/preview')
const previewLoaded = ref(false)
const previewHtml = ref('')
const previewError = ref('')
const templateUploading = ref(false)
const templateFile = ref<File | null>(null)
const templateInputRef = ref<HTMLInputElement | null>(null)
const requiredTemplatePlaceholders = [
  'clientNumber',
  'agreementNumber',
  'idNumber',
  'employmentNumber',
  'clientName',
  'loanAmount',
  'loanPeriod',
  'interestRate',
  'principalDebt',
  'totalRepayable',
  'monthlyInstallment',
  'bankName',
  'accountNumber',
  'branchCode',
  'logoUrl',
  'amount',
  'period',
  'rate',
  'levy',
  'bank',
  'accountNo',
  'finCharges',
  'amountRepay',
  'baseFee',
  'deduction',
  'totalFee'
]
const logoUrl = ref('')
const logoUploading = ref(false)
const logoFile = ref<File | null>(null)
const logoInputRef = ref<HTMLInputElement | null>(null)
const cleanupLoading = ref(false)

async function loadTemplatePreview() {
  previewLoaded.value = false
  previewError.value = ''
  try {
    previewHtml.value = await $fetch(templatePreviewUrl.value, { responseType: 'text' })
  } catch (err: any) {
    previewError.value = err?.data?.message || 'Failed to load preview.'
    previewHtml.value = ''
  } finally {
    previewLoaded.value = true
  }
}

function onTemplateSelected(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target?.files?.length) {
    templateFile.value = null
    return
  }
  templateFile.value = target.files[0]
}

function triggerTemplatePicker() {
  templateInputRef.value?.click()
}

async function uploadTemplate() {
  if (!templateFile.value) return
  try {
    templateUploading.value = true
    const formData = new FormData()
    formData.append('template', templateFile.value)
    await $fetch('/api/settings/contract-template', {
      method: 'POST',
      body: formData
    })
    templateFile.value = null
    addToast({ message: 'Template uploaded', variant: 'success' })
    await loadTemplatePreview()
  } catch (err: any) {
    addToast({ message: err?.data?.message || 'Failed to upload template', variant: 'error' })
  } finally {
    templateUploading.value = false
  }
}

async function loadLogo() {
  try {
    const res = await $fetch<{ logoUrl: string }>('/api/settings/logo')
    logoUrl.value = res?.logoUrl || ''
  } catch {
    logoUrl.value = ''
  }
}

function onLogoSelected(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target?.files?.length) {
    logoFile.value = null
    return
  }
  logoFile.value = target.files[0]
}

function triggerLogoPicker() {
  logoInputRef.value?.click()
}

async function uploadLogo() {
  if (!logoFile.value) return
  try {
    logoUploading.value = true
    const formData = new FormData()
    formData.append('logo', logoFile.value)
    const res = await $fetch<{ logoUrl: string }>('/api/settings/logo', {
      method: 'POST',
      body: formData
    })
    logoUrl.value = res?.logoUrl || ''
    logoFile.value = null
    addToast({ message: 'Logo uploaded', variant: 'success' })
    await loadTemplatePreview()
  } catch (err: any) {
    addToast({ message: err?.data?.message || 'Failed to upload logo', variant: 'error' })
  } finally {
    logoUploading.value = false
  }
}

async function deleteLogo() {
  try {
    await $fetch('/api/settings/logo', { method: 'DELETE' })
    logoUrl.value = ''
    addToast({ message: 'Logo removed', variant: 'success' })
    await loadTemplatePreview()
  } catch (err: any) {
    addToast({ message: err?.data?.message || 'Failed to remove logo', variant: 'error' })
  }
}

async function cleanupCachedPreviews() {
  if (!isAdmin.value) return
  cleanupLoading.value = true
  try {
    const previews = listPreviewMetas()
    if (!previews.length) {
      addToast({ message: 'No cached previews found', variant: 'success' })
      return
    }
    await $fetch('/api/settings/contract-previews/cleanup', {
      method: 'POST',
      body: { previews }
    })
    previews.forEach((preview) => removePreviewMeta(preview.reference))
    addToast({ message: 'Cached previews cleaned up', variant: 'success' })
  } catch (err: any) {
    addToast({ message: err?.data?.message || 'Failed to clean cached previews', variant: 'error' })
  } finally {
    cleanupLoading.value = false
  }
}

watch(templatePreviewUrl, () => {
  previewLoaded.value = false
})

watch(selectedSection, (value) => {
  if (value === 'template') {
    loadTemplatePreview()
    loadLogo()
  }
})

onMounted(async () => {
  if (!me.value) {
    profileLoading.value = true
    profileError.value = false
    try {
      await fetchUser()
    } catch {
      profileError.value = true
    } finally {
      profileLoading.value = false
    }
  }
})

function openEditUser(user: any) {
  editingUser.value = user
  userForm.value = {
    name: user.name ?? '',
    email: user.email ?? '',
    role: user.role ?? 'STAFF'
  }
}

async function saveSelf() {
  try {
    await $fetch('/api/auth/me', {
      method: 'PATCH',
      body: { name: selfForm.value.name, email: selfForm.value.email }
    })
    await fetchUser()
    showEditSelf.value = false
    addToast({ message: 'Profile updated', variant: 'success' })
  } catch (err: any) {
    addToast({ message: err?.data?.message || 'Failed to update profile', variant: 'error' })
  }
}

async function saveUser() {
  if (!editingUser.value) return
  try {
    await $fetch(`/api/settings/users/${editingUser.value.id}`, {
      method: 'PATCH',
      body: { ...userForm.value }
    })
    await refreshUsers()
    editingUser.value = null
    addToast({ message: 'User updated', variant: 'success' })
  } catch (err: any) {
    addToast({ message: err?.data?.message || 'Failed to update user', variant: 'error' })
  }
}

async function createUser() {
  try {
    creatingUser.value = true
    await $fetch('/api/settings/users', {
      method: 'POST',
      body: { ...createForm.value }
    })
    await refreshUsers()
    showCreateUser.value = false
    createForm.value = { name: '', email: '', role: 'STAFF', password: '' }
    addToast({ message: 'User created', variant: 'success' })
  } catch (err: any) {
    addToast({ message: err?.data?.message || 'Failed to create user', variant: 'error' })
  } finally {
    creatingUser.value = false
  }
}

async function deleteUser() {
  if (!deletingUserId.value) return
  try {
    await $fetch(`/api/settings/users/${deletingUserId.value}`, { method: 'DELETE' })
    await refreshUsers()
    addToast({ message: 'User deleted', variant: 'success' })
  } catch (err: any) {
    addToast({ message: err?.data?.message || 'Failed to delete user', variant: 'error' })
  } finally {
    deletingUserId.value = null
  }
}

</script>

<template>
  <sideNav v-model:collapsed="sidebarCollapsed" />

  <section
    class="page-shell"
    :class="sidebarCollapsed ? '' : 'md:pl-64'"
  >
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold heading">Settings</h1>
    </div>

    <div v-if="isAdmin" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <button
        class="card p-4 text-left hover:border-cyan-500 transition hover-lift fade-in"
        @click="selectedSection = 'profile'"
      >
        <p class="text-xs text-gray-400">Profile</p>
        <p class="text-sm font-semibold">Edit your profile</p>
      </button>

      <button
        class="card p-4 text-left hover:border-cyan-500 transition hover-lift fade-in"
        @click="selectedSection = 'users'"
      >
        <p class="text-xs text-gray-400">Users</p>
        <p class="text-sm font-semibold">Manage users</p>
      </button>

      <button
        class="card p-4 text-left hover:border-cyan-500 transition hover-lift fade-in"
        @click="selectedSection = 'template'"
      >
        <p class="text-xs text-gray-400">Templates</p>
        <p class="text-sm font-semibold">Contract template</p>
      </button>
    </div>

    <div v-if="selectedSection === 'profile'" class="card p-4 max-w-xl">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-semibold">Your Profile</h2>
        <button class="btn btn-ghost text-xs" @click="showEditSelf = true">
          Edit
        </button>
      </div>

      <div v-if="profileLoading" class="text-sm text-gray-400 flex items-center gap-2">
        <Loader2 class="w-4 h-4 animate-spin" />
        Loading profile...
      </div>

      <div v-else-if="profileError" class="text-sm text-red-500">
        Failed to load profile.
      </div>

      <div v-else class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-500">Name</span>
          <span>{{ (me as any)?.name ?? '-' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Email</span>
          <span>{{ me?.email ?? '-' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Role</span>
          <span>{{ me?.role ?? '-' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Created</span>
          <span>{{ me?.createdAt ? new Date(me.createdAt).toLocaleDateString() : '-' }}</span>
        </div>
      </div>

      <div v-if="isAdmin" class="mt-6 border-t border-[color:var(--border)] pt-4">
        <h3 class="text-sm font-semibold mb-2">Contract Preview Cleanup</h3>
        <p class="text-xs text-gray-500 mb-3">
          Remove cached preview PDFs created during unfinished loan creation.
        </p>
        <button
          class="btn btn-outline text-xs"
          :disabled="cleanupLoading"
          @click="cleanupCachedPreviews"
        >
          <Loader2 v-if="cleanupLoading" class="w-4 h-4 animate-spin mr-2" />
          Clean cached previews
        </button>
      </div>
    </div>

    <div v-if="isAdmin && selectedSection === 'users'" class="mt-6">
      <div class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold">Users</h2>
          <button
            class="btn btn-ghost text-xs inline-flex items-center gap-1"
            @click="showCreateUser = true"
          >
            <UserPlus class="w-4 h-4" />
            Create user
          </button>
        </div>
        <div v-if="usersPending" class="text-sm text-gray-400 flex items-center gap-2">
          <Loader2 class="w-4 h-4 animate-spin" />
          Loading users...
        </div>
        <div v-else class="space-y-2 text-sm">
          <div v-if="usersError" class="text-xs text-red-400">
            Failed to load users.
          </div>
          <div v-else-if="!visibleUsers.length" class="card-muted p-3 text-xs text-gray-500">
            No users found.
          </div>
          <div
            v-for="user in visibleUsers"
            :key="user.id"
            class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-[color:var(--border)] rounded-lg px-3 py-2 bg-white/70"
          >
            <div>
              <p class="font-medium">{{ user.name ?? 'No name' }}</p>
              <p class="text-xs text-gray-400">{{ user.email }} • {{ user.role }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button class="btn btn-ghost text-xs" @click="openEditUser(user)">
                <PencilLine class="w-4 h-4" />
              </button>
              <button
                class="btn text-xs text-red-500 hover:text-red-600"
                @click="deletingUserId = user.id"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedSection === 'template'" class="mt-6">
      <div class="card p-4 w-full">
        <h2 class="text-sm font-semibold mb-3">Contract Template</h2>
        <p class="text-xs text-gray-500 mb-4">
          Upload a single HTML file. Inline your CSS in the template for reliable PDF output.
        </p>

        <div class="flex flex-col md:flex-row md:items-center gap-3 mb-6">
          <div class="flex flex-1 flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".html"
              class="text-xs hidden"
              ref="templateInputRef"
              @change="onTemplateSelected"
            />
            <button class="btn btn-outline text-xs" @click="triggerTemplatePicker">
              Choose HTML
            </button>
            <button
              class="btn btn-primary text-xs"
              :disabled="templateUploading || !templateFile"
              @click="uploadTemplate"
            >
              <Loader2 v-if="templateUploading" class="w-4 h-4 animate-spin mr-2" />
              Upload template
            </button>
            <span v-if="templateFile" class="text-xs text-gray-500">{{ templateFile.name }}</span>
          </div>
          <div class="w-full md:w-56 flex md:justify-end">
            <div class="text-xs text-gray-500">
              <span class="font-medium text-gray-600">Required placeholders:</span>
              <span class="ml-1" :title="requiredTemplatePlaceholders.join(', ')">
                Hover to view list
              </span>
            </div>
          </div>
        </div>

        <div class="border-t border-[color:var(--border)] pt-5">
          <h3 class="text-sm font-semibold mb-3">Contract Branding</h3>
          <p class="text-xs text-gray-500 mb-4">
            Upload a logo to appear on generated contracts. Allowed: SVG, PNG, JPG, ICO.
          </p>

          <div class="flex flex-col md:flex-row md:items-center gap-3 mb-4">
            <input
              type="file"
              accept=".svg,.png,.jpg,.jpeg,.ico"
              class="text-xs hidden"
              ref="logoInputRef"
              @change="onLogoSelected"
            />
            <button
              class="btn btn-outline text-xs"
              @click="triggerLogoPicker"
            >
              Choose file
            </button>
            <button
              class="btn btn-primary text-xs"
              :disabled="logoUploading || !logoFile"
              @click="uploadLogo"
            >
              <Loader2 v-if="logoUploading" class="w-4 h-4 animate-spin mr-2" />
              {{ logoUrl ? 'Update logo' : 'Upload logo' }}
            </button>
            <span v-if="logoFile" class="text-xs text-gray-500">{{ logoFile.name }}</span>
          </div>

          <div v-if="logoUrl" class="mb-6">
            <p class="text-xs text-gray-500 mb-2">Current logo</p>
            <div class="flex flex-col md:flex-row md:items-center gap-3">
              <div class="w-40 h-20 border border-[color:var(--border)] rounded-lg bg-white flex items-center justify-center overflow-hidden">
              <img :src="logoUrl" alt="Contract logo" class="max-h-full max-w-full object-contain" />
              </div>
              <div class="flex items-center gap-2">
                <button class="btn btn-outline text-xs" @click="triggerLogoPicker">
                  Update
                </button>
                <button class="btn text-xs text-red-500 hover:text-red-600" @click="deleteLogo">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <h3 class="text-sm font-semibold mb-3">Contract Preview</h3>
        <p class="text-xs text-gray-500 mb-3">
          Preview the active HTML template below.
        </p>

        <div v-if="templatePreviewUrl" class="mt-4 border border-[color:var(--border)] rounded-2xl overflow-hidden relative">
          <div
            v-if="!previewLoaded"
            class="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-gray-500"
          >
            <Loader2 class="w-4 h-4 animate-spin mr-2" />
            Loading preview...
          </div>
          <div
            v-else-if="previewError"
            class="absolute inset-0 flex items-center justify-center bg-white/80 text-xs text-red-500 px-4 text-center"
          >
            {{ previewError }}
          </div>
          <iframe
            :srcdoc="previewHtml"
            class="w-full h-[70vh]"
            title="Contract template preview"
            sandbox=""
          />
        </div>
      </div>
    </div>

    <!-- Edit self modal -->
    <div v-if="showEditSelf" class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="modal-card w-full max-w-md p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Edit Profile</h3>
          <button class="text-gray-500 hover:text-gray-700" @click="closeEditSelf">
            <X class="w-4 h-4" />
          </button>
        </div>
        <input v-model="selfForm.name" class="input" placeholder="Name" />
        <input v-model="selfForm.email" class="input" placeholder="Email" />
        <div class="flex justify-end gap-2">
          <button class="btn btn-outline text-xs" @click="closeEditSelf">Cancel</button>
          <button class="btn btn-primary text-xs" @click="saveSelf">Save</button>
        </div>
      </div>
    </div>

    <!-- Edit user modal -->
    <div v-if="editingUser" class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="modal-card w-full max-w-md p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Edit User</h3>
          <button class="text-gray-500 hover:text-gray-700" @click="closeEditUser">
            <X class="w-4 h-4" />
          </button>
        </div>
        <input v-model="userForm.name" class="input" placeholder="Name" />
        <input v-model="userForm.email" class="input" placeholder="Email" />
        <select v-model="userForm.role" class="input">
          <option value="ADMIN">ADMIN</option>
          <option value="STAFF">STAFF</option>
        </select>
        <div class="flex justify-end gap-2">
          <button class="btn btn-outline text-xs" @click="closeEditUser">Cancel</button>
          <button class="btn btn-primary text-xs" @click="saveUser">Save</button>
        </div>
      </div>
    </div>

    <!-- Create user modal -->
    <div v-if="showCreateUser" class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="modal-card w-full max-w-md p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Create User</h3>
          <button class="text-gray-500 hover:text-gray-700" @click="closeCreateUser">
            <X class="w-4 h-4" />
          </button>
        </div>
        <input v-model="createForm.name" class="input" placeholder="Name" />
        <input v-model="createForm.email" class="input" placeholder="Email" />
        <input
          v-model="createForm.password"
          type="password"
          class="input"
          placeholder="Temporary password"
        />
        <select v-model="createForm.role" class="input">
          <option value="ADMIN">ADMIN</option>
          <option value="STAFF">STAFF</option>
        </select>
        <div class="flex justify-end gap-2">
          <button class="btn btn-outline text-xs" @click="closeCreateUser">Cancel</button>
          <button
            class="btn btn-primary text-xs"
            :disabled="creatingUser"
            @click="createUser"
          >
            <Loader2 v-if="creatingUser" class="w-4 h-4 animate-spin" />
            Create
          </button>
        </div>
      </div>
    </div>

    <!-- Delete user confirm -->
    <div v-if="deletingUserId" class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="modal-card w-full max-w-md p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Delete User</h3>
          <button class="text-gray-500 hover:text-gray-700" @click="closeDeleteUser">
            <X class="w-4 h-4" />
          </button>
        </div>
        <p class="text-xs text-gray-500">Are you sure you want to delete this user?</p>
        <div class="flex justify-end gap-2">
          <button class="btn btn-outline text-xs" @click="closeDeleteUser">Cancel</button>
          <button class="btn text-xs bg-red-500 text-white hover:bg-red-600" @click="deleteUser">OK</button>
        </div>
      </div>
    </div>
  </section>
</template>
