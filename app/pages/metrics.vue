<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import sideNav from '~/components/sideNav.vue'
import { Loader2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import VueApexCharts from 'vue3-apexcharts'

const router = useRouter()
const { user } = useAuth()
const isAdmin = computed(() => user.value?.role === 'ADMIN')
const sidebarCollapsed = ref(true)

const rangePreset = ref<'month' | 'year' | 'custom'>('month')
const rangeLength = ref(6)
const customStart = ref('')
const customEnd = ref('')
const histogramMode = ref<'time' | 'principal' | 'installment'>('time')
const penaltyTypeFilter = ref<'all' | 'INSTALLMENT_INCREASE' | 'PERIOD_EXTENSION' | 'FULL_REPAYMENT_DEMAND'>('all')

const metricsQuery = computed(() => ({
  range: rangePreset.value,
  rangeLength: rangeLength.value,
  histogram: histogramMode.value,
  penaltyType: penaltyTypeFilter.value,
  ...(rangePreset.value === 'custom' && customStart.value && customEnd.value
    ? { startDate: customStart.value, endDate: customEnd.value }
    : {})
}))

const { data: metrics, pending, refresh } = await useFetch('/api/dashboard/metrics', {
  immediate: false,
  server: false,
  query: metricsQuery
})

const lineCategories = computed(() => metrics.value?.revenueSeries?.categories ?? [])
const lineSeries = computed(() => [
  { name: 'Received', data: metrics.value?.revenueSeries?.received ?? [] },
  { name: 'Expected', data: metrics.value?.revenueSeries?.expected ?? [] }
])

const lineOptions = computed(() => ({
  chart: {
    type: 'line',
    toolbar: { show: false },
    animations: { enabled: true }
  },
  stroke: { curve: 'smooth', width: 3 },
  grid: { strokeDashArray: 4 },
  colors: ['#0ea5a4', '#0f172a'],
  xaxis: { categories: lineCategories.value },
  yaxis: {
    labels: {
      formatter: (val: number) => `N$ ${Math.round(val).toLocaleString()}`
    }
  },
  tooltip: { shared: true }
}))

const histogramCategories = computed(() => metrics.value?.penaltySeries?.categories ?? [])
const histogramSeries = computed(() => [
  { name: 'Installment Increase', data: metrics.value?.penaltySeries?.series?.INSTALLMENT_INCREASE ?? [] },
  { name: 'Period Extension', data: metrics.value?.penaltySeries?.series?.PERIOD_EXTENSION ?? [] },
  { name: 'Full Repayment Demand', data: metrics.value?.penaltySeries?.series?.FULL_REPAYMENT_DEMAND ?? [] }
])

const histogramOptions = computed(() => ({
  chart: {
    type: 'line',
    toolbar: { show: false },
    animations: { enabled: true }
  },
  stroke: { curve: 'smooth', width: 3 },
  grid: { strokeDashArray: 4 },
  colors: ['#0f766e', '#1d4ed8', '#f97316'],
  xaxis: { categories: histogramCategories.value },
  yaxis: { labels: { formatter: (val: number) => `${Math.round(val)}` } },
  tooltip: { shared: true }
}))

watch(
  isAdmin,
  (value) => {
    if (value) refresh()
  },
  { immediate: true }
)
</script>

<template>
  <sideNav v-model:collapsed="sidebarCollapsed" />

  <section class="page-shell" :class="sidebarCollapsed ? '' : 'md:pl-64'">
    <div class="flex items-center justify-between mb-6 fade-in">
      <h1 class="text-2xl font-semibold heading">Metrics</h1>
      <p class="text-xs text-gray-500">Revenue & risk insights</p>
    </div>

    <div v-if="!isAdmin" class="card-muted p-6 text-sm text-gray-500">
      Metrics are only available to administrators.
    </div>

    <div v-else>
      <div v-if="pending" class="text-sm text-gray-400 flex items-center gap-2 py-3">
        <Loader2 class="w-4 h-4 animate-spin" />
        Loading metrics...
      </div>

      <div v-else class="space-y-6">
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div class="card p-4 hover-lift fade-in">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h2 class="text-sm font-semibold">Revenue vs Potential</h2>
                <p class="text-xs text-gray-400">Loans received vs expected</p>
              </div>
              <div class="flex items-center gap-2">
                <select v-model="rangePreset" class="input text-xs">
                  <option value="month">Last 6 months</option>
                  <option value="year">This year</option>
                  <option value="custom">Custom range</option>
                </select>
                <div v-if="rangePreset === 'custom'" class="flex items-center gap-2">
                  <input
                    v-model="customStart"
                    type="date"
                    class="input text-xs"
                  />
                  <input
                    v-model="customEnd"
                    type="date"
                    class="input text-xs"
                  />
                </div>
              </div>
            </div>
            <ClientOnly>
              <div v-if="!lineCategories.length" class="card-muted p-4 text-sm text-gray-500">
                No revenue data for the selected range.
              </div>
              <VueApexCharts v-else height="280" :options="lineOptions" :series="lineSeries" />
            </ClientOnly>
          </div>

          <div class="card p-4 hover-lift fade-in" style="animation-delay: 60ms">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h2 class="text-sm font-semibold">Penalty Distribution</h2>
                <p class="text-xs text-gray-400">Trends by time or amount</p>
              </div>
              <select v-model="histogramMode" class="input text-xs">
                <option value="time">Over time</option>
                <option value="principal">Principal range</option>
                <option value="installment">Installment range</option>
              </select>
            </div>
            <ClientOnly>
              <div v-if="!histogramCategories.length" class="card-muted p-4 text-sm text-gray-500">
                No penalty data for the selected range.
              </div>
              <VueApexCharts v-else height="280" :options="histogramOptions" :series="histogramSeries" />
            </ClientOnly>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="card p-4 hover-lift fade-in">
            <p class="text-xs text-gray-400">Active Loans</p>
            <p class="text-xl font-semibold">{{ metrics?.activeLoans ?? 0 }}</p>
          </div>
          <div class="card p-4 hover-lift fade-in" style="animation-delay: 40ms">
            <p class="text-xs text-gray-400">Overdue Loans</p>
            <p class="text-xl font-semibold">{{ metrics?.overdueLoans ?? 0 }}</p>
          </div>
          <div class="card p-4 hover-lift fade-in" style="animation-delay: 80ms">
            <p class="text-xs text-gray-400">Total Outstanding</p>
            <p class="text-xl font-semibold">N$ {{ (metrics?.totalOutstanding ?? 0).toLocaleString() }}</p>
          </div>
          <div class="card p-4 hover-lift fade-in" style="animation-delay: 120ms">
            <p class="text-xs text-gray-400">Overdue Amount</p>
            <p class="text-xl font-semibold">N$ {{ (metrics?.overdueAmount ?? 0).toLocaleString() }}</p>
          </div>
        </div>

        <div class="card p-4 fade-in" style="animation-delay: 200ms">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold">Recent Penalties (30 days)</h2>
            <div class="flex items-center gap-2">
              <p class="text-xs text-gray-400">
                {{ metrics?.recentPenalties?.count ?? 0 }} penalties • N$ {{ (metrics?.recentPenalties?.amount ?? 0).toLocaleString() }}
              </p>
              <select v-model="penaltyTypeFilter" class="input text-xs">
                <option value="all">All types</option>
                <option value="INSTALLMENT_INCREASE">Installment Increase</option>
                <option value="PERIOD_EXTENSION">Period Extension</option>
                <option value="FULL_REPAYMENT_DEMAND">Full Repayment Demand</option>
              </select>
            </div>
          </div>
          <div>
            <div v-if="metrics?.recentPenaltiesList?.length" class="mt-3 space-y-2 text-sm">
              <div
                v-for="penalty in metrics.recentPenaltiesList"
                :key="penalty.id"
                class="flex items-center justify-between border border-[color:var(--border)] rounded px-3 py-2 cursor-pointer hover:border-cyan-500 hover-lift"
                @click="router.push(`/loans/${penalty.loanId}`)"
              >
                <div>
                  <div class="flex items-center gap-2">
                    <p class="font-medium">{{ penalty.loanReference }}</p>
                    <span
                      class="text-[10px] px-2 py-0.5 rounded-full border"
                      :class="{
                        'bg-teal-50 text-teal-700 border-teal-200': penalty.type === 'INSTALLMENT_INCREASE',
                        'bg-blue-50 text-blue-700 border-blue-200': penalty.type === 'PERIOD_EXTENSION',
                        'bg-orange-50 text-orange-700 border-orange-200': penalty.type === 'FULL_REPAYMENT_DEMAND'
                      }"
                    >
                      {{ penalty.type.replace(/_/g, ' ') }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-400">
                    {{ penalty.months }} months • {{ penalty.rate }}%
                  </p>
                  <p v-if="penalty.reason" class="text-xs text-gray-400">
                    Reason: {{ penalty.reason }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-sm">N$ {{ penalty.penaltyAmount.toLocaleString() }}</p>
                  <p class="text-xs text-gray-400">{{ penalty.createdAt.split('T')[0] }}</p>
                </div>
              </div>
            </div>
            <p v-else class="card-muted p-3 text-sm text-gray-500 mt-3">No penalties in the last 30 days.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
