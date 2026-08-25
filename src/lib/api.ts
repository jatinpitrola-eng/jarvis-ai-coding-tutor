'use client'

const DEVICE_KEY = 'cb_device_id'
const LEARNER_KEY = 'cb_learner_id'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function getDeviceId(): string {
  if (!isBrowser()) return ''
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

/**
 * Ensure a Learner row exists for this device. Returns the learnerId.
 * Caches it in localStorage so we only POST once per device.
 */
export async function getLearnerId(): Promise<string> {
  if (!isBrowser()) return ''
  const existing = localStorage.getItem(LEARNER_KEY)
  if (existing) return existing

  const deviceId = getDeviceId()
  const res = await fetch('/api/learner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  })
  if (!res.ok) {
    // Try GET fallback per the contract
    const getRes = await fetch(
      `/api/learner?deviceId=${encodeURIComponent(deviceId)}`
    )
    if (getRes.ok) {
      const data = await getRes.json()
      if (data?.learnerId) {
        localStorage.setItem(LEARNER_KEY, data.learnerId)
        return data.learnerId
      }
    }
    throw new Error('Failed to create learner')
  }
  const data = await res.json()
  if (!data?.learnerId) {
    throw new Error('Invalid learner response')
  }
  localStorage.setItem(LEARNER_KEY, data.learnerId)
  return data.learnerId
}

/**
 * Fetch wrapper that auto-injects the `x-learner-id` header.
 * On 401-ish responses, it invalidates the cached learner so the next call
 * will regenerate it.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  let learnerId = ''
  try {
    learnerId = await getLearnerId()
  } catch {
    // continue without learner header — backend will create one on the fly
  }
  const headers = new Headers(options.headers || {})
  if (learnerId) headers.set('x-learner-id', learnerId)
  if (
    options.body &&
    !headers.has('Content-Type') &&
    typeof options.body === 'string'
  ) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(path, { ...options, headers })
  if (res.status === 401 || res.status === 403) {
    if (isBrowser()) localStorage.removeItem(LEARNER_KEY)
  }
  return res
}

export { isBrowser }
