import { clearStoredAuthSession } from './authStorage'

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