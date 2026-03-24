const rawApiUrl = import.meta.env.VITE_API_URL?.trim()

export const API_URL = rawApiUrl || '/api'