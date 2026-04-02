const AUTH_STORAGE_KEYS = ['tbToken', 'tbRefreshToken', 'tbUser']

export const clearStoredAuthSession = () => {
  AUTH_STORAGE_KEYS.forEach((key) => {
    sessionStorage.removeItem(key)
    localStorage.removeItem(key)
  })
}

export const performReliableLogout = (onLogout) => {
  clearStoredAuthSession()

  if (typeof onLogout === 'function') {
    onLogout()
  }

  const redirectUrl = new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString()

  window.setTimeout(() => {
    window.location.replace(redirectUrl)
  }, 0)
}