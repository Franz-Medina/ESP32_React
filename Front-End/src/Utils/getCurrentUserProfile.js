import { getStoredAuthUser } from './authStorage'

const getStoredUser = () => {
  const rawUser = getStoredAuthUser()

  if (!rawUser) {
    return null
  }

  try {
    return JSON.parse(rawUser)
  } catch {
    return null
  }
}

const getSafeFullName = (firstName, lastName, email) => {
  const fullName = [firstName, lastName]
    .filter(Boolean)
    .join(' ')
    .trim()

  return fullName || email || 'User'
}

const normalizeRoleLabel = (value = '') => {
  const normalizedValue = String(value).trim().toLowerCase()

  if (
    normalizedValue === 'administrator' ||
    normalizedValue === 'tenant administrator' ||
    normalizedValue === 'tenant_admin' ||
    normalizedValue === 'tenant admin'
  ) {
    return 'Administrator'
  }

  if (
    normalizedValue === 'user' ||
    normalizedValue === 'customer administrator' ||
    normalizedValue === 'customer_admin' ||
    normalizedValue === 'customer admin' ||
    normalizedValue === 'customer user' ||
    normalizedValue === 'customer_user'
  ) {
    return 'User'
  }

  return ''
}

const getSafeRoleLabel = (user) => {
  const explicitRoleLabel = normalizeRoleLabel(user?.roleLabel || user?.role)

  if (explicitRoleLabel) {
    return explicitRoleLabel
  }

  const authority = String(user?.authority || '').trim().toUpperCase()

  if (authority === 'TENANT_ADMIN') {
    return 'Administrator'
  }

  if (authority === 'CUSTOMER_ADMIN' || authority === 'CUSTOMER_USER') {
    return 'User'
  }

  return 'User'
}

export const isAdministratorRole = (roleLabel = '') =>
  normalizeRoleLabel(roleLabel) === 'Administrator'

export const getCurrentUserProfile = () => {
  const user = getStoredUser()

  if (!user) {
    return {
      fullName: 'User',
      roleLabel: 'User'
    }
  }

  return {
    firstName: String(user.firstName || '').trim(),
    lastName: String(user.lastName || '').trim(),
    email: String(user.email || '').trim(),
    phoneNumber: String(user.phoneNumber || '').trim(),
    phoneCountryCode: String(user.phoneCountryCode || '+63').trim(),
    profilePictureUrl: String(user.profilePictureUrl || '').trim(),
    fullName: getSafeFullName(user.firstName, user.lastName, user.email),
    roleLabel: getSafeRoleLabel(user)
  }
}