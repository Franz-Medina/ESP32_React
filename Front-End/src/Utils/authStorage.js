const PRIMARY_AUTH_KEYS = {
  token: 'authToken',
  user: 'authUser'
}

const LEGACY_AUTH_KEYS = {
  token: 'tbToken',
  user: 'tbUser',
  refreshToken: 'tbRefreshToken'
}

export const getStoredAuthToken = () =>
  sessionStorage.getItem(PRIMARY_AUTH_KEYS.token) ||
  localStorage.getItem(PRIMARY_AUTH_KEYS.token) ||
  sessionStorage.getItem(LEGACY_AUTH_KEYS.token) ||
  localStorage.getItem(LEGACY_AUTH_KEYS.token) ||
  ''

export const getStoredAuthUser = () =>
  sessionStorage.getItem(PRIMARY_AUTH_KEYS.user) ||
  localStorage.getItem(PRIMARY_AUTH_KEYS.user) ||
  sessionStorage.getItem(LEGACY_AUTH_KEYS.user) ||
  localStorage.getItem(LEGACY_AUTH_KEYS.user) ||
  ''

export const hasPersistentAuthSession = () =>
  Boolean(
    localStorage.getItem(PRIMARY_AUTH_KEYS.token) ||
    localStorage.getItem(LEGACY_AUTH_KEYS.token)
  )

export const setStoredAuthSession = ({ token, user, rememberMe }) => {
  const targetStorage = rememberMe ? localStorage : sessionStorage
  const otherStorage = rememberMe ? sessionStorage : localStorage

  targetStorage.setItem(PRIMARY_AUTH_KEYS.token, token)
  targetStorage.setItem(PRIMARY_AUTH_KEYS.user, JSON.stringify(user))

  otherStorage.removeItem(PRIMARY_AUTH_KEYS.token)
  otherStorage.removeItem(PRIMARY_AUTH_KEYS.user)

  sessionStorage.removeItem(LEGACY_AUTH_KEYS.token)
  sessionStorage.removeItem(LEGACY_AUTH_KEYS.user)
  sessionStorage.removeItem(LEGACY_AUTH_KEYS.refreshToken)

  localStorage.removeItem(LEGACY_AUTH_KEYS.token)
  localStorage.removeItem(LEGACY_AUTH_KEYS.user)
  localStorage.removeItem(LEGACY_AUTH_KEYS.refreshToken)
}

export const clearStoredAuthSession = () => {
  const storages = [sessionStorage, localStorage]

  storages.forEach((storage) => {
    storage.removeItem(PRIMARY_AUTH_KEYS.token)
    storage.removeItem(PRIMARY_AUTH_KEYS.user)
    storage.removeItem(LEGACY_AUTH_KEYS.token)
    storage.removeItem(LEGACY_AUTH_KEYS.user)
    storage.removeItem(LEGACY_AUTH_KEYS.refreshToken)
  })
}