import { createClient } from '@insforge/sdk'

// Bulletproof client initialization with fail-safe in-code fallbacks.
// This ensures that even if .env is not loaded due to the server being
// started from the root directory, it will resolve and connect to your live backend.
const LIVE_URL = 'https://hkgpbt93.us-east.insforge.app'
const LIVE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MTY3MDJ9.8cQbjV4a7SqqB6KpwF1TrsURgGbzb0EPSPowJroitBU'

export const insforge = createClient({
  baseUrl: (import.meta.env.VITE_INSFORGE_URL as string) || LIVE_URL,
  anonKey: (import.meta.env.VITE_INSFORGE_ANON_KEY as string) || LIVE_ANON_KEY,
})

export type InsforgeClient = typeof insforge
