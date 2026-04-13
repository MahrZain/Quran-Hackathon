import axios, { type InternalAxiosRequestConfig } from 'axios'

import { getAccessToken } from './authStorage'

const SESSION_HEADER = 'X-Session-ID'
const AUTH_HEADER = 'Authorization'
export const SESSION_STORAGE_KEY = 'asar_session_id'

/** Prefer VITE_API_BASE_URL; dev uses Vite proxy; production build without env uses same origin as the SPA. */
function defaultApiBaseUrl(): string {
  if (import.meta.env.DEV) return '/api/v1'
  if (typeof window !== 'undefined' && window.location?.origin)
    return `${window.location.origin}/api/v1`
  return 'http://127.0.0.1:8000/api/v1'
}

const baseURL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? defaultApiBaseUrl()

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60_000,
})

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers = config.headers ?? {}
  const sid = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEY) : null
  if (sid) {
    config.headers[SESSION_HEADER] = sid
  }
  const token = typeof localStorage !== 'undefined' ? getAccessToken() : null
  if (token) {
    config.headers[AUTH_HEADER] = `Bearer ${token}`
  }
  return config
})
