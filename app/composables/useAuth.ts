export function useAuth() {
  const user = useState<any | null>('auth-user', () => {
    if (process.client) {
      const raw = localStorage.getItem('auth-user')
      if (raw) {
        try {
          return JSON.parse(raw)
        } catch {
          localStorage.removeItem('auth-user')
        }
      }
    }
    return null
  })

  async function fetchUser() {
    try {
      user.value = await $fetch('/api/auth/me')
      if (process.client) {
        localStorage.setItem('auth-user', JSON.stringify(user.value))
      }
    } catch {
      user.value = null
      if (process.client) {
        localStorage.removeItem('auth-user')
      }
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    if (process.client) {
      localStorage.removeItem('auth-user')
    }
    navigateTo('/login')
  }

  return {
    user,
    fetchUser,
    logout
  }
}
