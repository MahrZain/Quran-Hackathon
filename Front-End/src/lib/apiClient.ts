import axios, { type InternalAxiosRequestConfig } from 'axios'

import { getAccessToken } from './authStorage'

const SESSION_HEADER = 'X-Session-ID'
const AUTH_HEADER = 'Authorization'
export const SESSION_STORAGE_KEY = 'asar_session_id'

/** Prefer VITE_API_BASE_URL; in dev, same-origin `/api/v1` uses Vite proxy (vite.config.ts). */
const baseURL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  (import.meta.env.DEV ? '/api/v1' : 'http://127.0.0.1:8000/api/v1')

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
