<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import sideNav from '~/components/sideNav.vue'

const sidebarCollapsed = ref(false)
const sort = ref<'newest' | 'oldest'>('newest')
const search = ref('')
const page = ref(1)
const pageSize = 15

watch([sort, search], () => {
  page.value = 1
})

const query = computed(() => ({
  sort: sort.value,
  search: search.value,
  page: page.value,
  pageSize
}))

const { data: clients, pending, error } = await useFetch('/api/clients', {
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
</script>

<template>
  <sideNav v-model:collapsed="sidebarCollapsed" />

  <section
    class="p-6 transition-all duration-300"
    :class="sidebarCollapsed ? 'ml-16' : 'ml-[20%]'"
  >
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-semibold">Clients</h1>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-4 mb-4">
      <div class="flex items-center gap-2">
        <label class="text-xs text-gray-400">Search</label>
        <input
          v-model="search"
          type="text"
          placeholder="Name, email, phone..."
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
    </div>

    <!-- Client table header -->
    <div class="grid grid-cols-5 text-xs text-gray-400 mb-2" v-if="clients && clients.items.length">
      <span>Full Name</span>
      <span>Email</span>
      <span>Phone</span>
    </div>

    <!-- Client table rows -->
    <div
      v-if="clients && clients.items.length"
      v-for="client in clients.items"
      :key="client.id"
      class="grid grid-cols-5 items-center py-3 border-t border-white/5 text-sm"
    >
      <span>{{ client.fullName }}</span>
      <span>{{ client.email }}</span>
      <span>{{ client.phone }}</span>
    </div>

    <div v-else-if="!pending" class="text-sm text-gray-400 border border-dashed rounded p-6">
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
          class="px-3 py-1 rounded border text-sm disabled:text-gray-300"
        >
          Prev
        </button>
        <button
          @click="nextPage"
          :disabled="clients.page >= clients.totalPages"
          class="px-3 py-1 rounded border text-sm disabled:text-gray-300"
        >
          Next
        </button>
      </div>
    </div>
  </section>
</template>
