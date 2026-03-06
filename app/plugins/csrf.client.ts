export default defineNuxtPlugin(() => {
  const csrf = useCookie<string | null>('csrf_token')

  const clientFetch = $fetch.create({
    onRequest({ options }) {
      const headers = new Headers(options.headers || {})
      if (csrf.value) {
        headers.set('x-csrf-token', csrf.value)
      }
      options.headers = headers
    }
  })

  // Override global $fetch on client to include CSRF header
  ;(globalThis as any).$fetch = clientFetch
})
