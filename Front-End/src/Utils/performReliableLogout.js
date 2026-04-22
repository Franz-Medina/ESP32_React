import { API_URL } from '../Config/API'
import { clearStoredAuthSession, getStoredAuthToken } from './authStorage'

export const performReliableLogout = async (onLogout) => {
  const token = getStoredAuthToken()

  if (token) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 1200)

    try {
      await fetch(`${API_URL}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          actionType: 'logout',
        }),
        signal: controller.signal,
      })
    } catch (error) {
      console.error('LOGOUT ACTIVITY LOG ERROR:', error)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  clearStoredAuthSession()

  if (typeof onLogout === 'function') {
    onLogout()
  }

  const redirectUrl = new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString()

  window.setTimeout(() => {
    window.location.replace(redirectUrl)
  }, 0)
}