<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import sideNav from '~/components/sideNav.vue'

const sidebarCollapsed = ref(true)
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
</template>
