const getStoredUser = () => {
  const rawUser =
    sessionStorage.getItem('tbUser') ||
    localStorage.getItem('tbUser')

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

const getSafeRoleLabel = (user) => {
  const authority = String(user?.authority || '').trim().toUpperCase()
  const tenantAdminEmail = String(import.meta.env.VITE_TB_TENANT_USERNAME || '')
    .trim()
    .toLowerCase()
  const currentEmail = String(user?.email || '').trim().toLowerCase()

  if (authority === 'TENANT_ADMIN') {
    return 'Tenant Administrator'
  }

  if (authority === 'CUSTOMER_ADMIN' || authority === 'CUSTOMER_USER') {
    return 'Customer Administrator'
  }

  if (tenantAdminEmail && currentEmail === tenantAdminEmail) {
    return 'Tenant Administrator'
  }

  return 'Customer Administrator'
}

export const getCurrentUserProfile = () => {
  const user = getStoredUser()

  if (!user) {
    return {
      fullName: 'User',
      roleLabel: 'Customer Administrator'
    }
  }

  return {
    firstName: String(user.firstName || '').trim(),
    lastName: String(user.lastName || '').trim(),
    email: String(user.email || '').trim(),
    phoneNumber: String(user.phoneNumber || '').trim(),
    phoneCountryCode: String(user.phoneCountryCode || '+63').trim(),
    fullName: getSafeFullName(user.firstName, user.lastName, user.email),
    roleLabel: getSafeRoleLabel(user)
  }
}