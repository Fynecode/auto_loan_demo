<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import sideNav from '~/components/sideNav.vue'
import { Loader2, PencilLine, Trash2, Upload, UserPlus, X } from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'

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

const {
  data: templateData,
  error: templateError,
  refresh: refreshTemplate
} = await useFetch('/api/settings/contract-template', {
  immediate: true,
  server: false
})

const { data: users, pending: usersPending, error: usersError, refresh: refreshUsers } = await useFetch('/api/settings/users', {
  immediate: false,
  server: false
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
  refreshTemplate()
}, { immediate: true })

const templateFile = ref<File | null>(null)
const uploadingTemplate = ref(false)
const templatePreviewUrl = computed(() => {
  if (!templateData.value?.fileUrl) return ''
  return '/api/settings/contract-template/preview'
})
const previewLoaded = ref(false)

watch(templatePreviewUrl, () => {
  previewLoaded.value = false
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

async function uploadTemplate() {
  if (!templateFile.value) {
    addToast({ message: 'Select a DOCX file first', variant: 'error' })
    return
  }

  uploadingTemplate.value = true
  try {
    const form = new FormData()
    form.append('template', templateFile.value)
    const result = await $fetch('/api/settings/contract-template', {
      method: 'POST',
      body: form
    })
    await refreshTemplate()
    templateFile.value = null
    addToast({ message: 'Contract template updated', variant: 'success' })
  } catch (err: any) {
    addToast({ message: err?.data?.message || 'Failed to upload template', variant: 'error' })
  } finally {
    uploadingTemplate.value = false
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
        <p class="text-sm font-semibold">Upload contract template</p>
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
          <div v-else-if="!users?.length" class="card-muted p-3 text-xs text-gray-500">
            No users found.
          </div>
          <div
            v-for="user in users"
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
        <p class="text-xs text-gray-500 mb-3">Upload a DOCX template to use for contract generation.</p>
        <div class="flex flex-col gap-2">
          <label class="text-xs text-gray-500">Upload DOCX template</label>
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            @change="(e: any) => (templateFile = e.target.files?.[0] ?? null)"
            class="input text-xs"
            :disabled="!isAdmin"
          />
        </div>
        <div class="mt-2 text-xs text-gray-500">
          <div v-if="templateFile">
            <span class="block truncate" :title="templateFile.name">
              Selected: {{ templateFile.name }} ({{ Math.round(templateFile.size / 1024) }} KB)
            </span>
          </div>
          <div v-else-if="templateData?.fileUrl" class="flex flex-col gap-1">
            <span>
              Uploaded:
              {{ templateData.createdAt ? new Date(templateData.createdAt).toLocaleString() : 'Unknown' }}
            </span>
          </div>
          <div v-else-if="templateError" class="text-red-400">
            Failed to load template.
          </div>
          <div v-else class="card-muted p-3 text-xs text-gray-500">
            No active template uploaded yet.
          </div>
        </div>
        <button
          v-if="isAdmin"
          class="mt-3 btn btn-primary text-xs"
          :disabled="uploadingTemplate"
          @click="uploadTemplate"
        >
          <Loader2 v-if="uploadingTemplate" class="w-4 h-4 animate-spin" />
          <Upload v-else class="w-4 h-4" />
          {{ uploadingTemplate ? 'Uploading...' : 'Upload Template' }}
        </button>

        <div v-if="templatePreviewUrl" class="mt-4 border border-[color:var(--border)] rounded-2xl overflow-hidden relative">
          <div
            v-if="!previewLoaded"
            class="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-gray-500"
          >
            <Loader2 class="w-4 h-4 animate-spin mr-2" />
            Loading preview...
          </div>
          <iframe
            :src="templatePreviewUrl"
            class="w-full h-[70vh]"
            title="Contract template preview"
            @load="previewLoaded = true"
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
