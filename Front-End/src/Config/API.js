const rawApiUrl = import.meta.env.VITE_API_URL?.trim()

export const API_URL = rawApiUrl || '/api'
export const API_BASE_URL = rawApiUrl
  ? rawApiUrl.replace(/\/+$/, '')
  : window.location.origin

export const buildApiAssetUrl = (assetPath = '') => {
  const normalizedAssetPath = String(assetPath || '').trim()

  if (!normalizedAssetPath) {
    return ''
  }

  if (/^https?:\/\//i.test(normalizedAssetPath)) {
    return normalizedAssetPath
  }

  return new URL(
    normalizedAssetPath.startsWith('/') ? normalizedAssetPath : `/${normalizedAssetPath}`,
    API_BASE_URL
  ).toString()
}