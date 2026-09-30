export type AuthUser = {
  id: string
  name?: string | null
  company?: string | null
  avatarUrl?: string | null
  email: string
  isAdmin: boolean
  createdAt?: string | null
}

export type AuthTokens = {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
const ACCESS_TOKEN_KEY = "botforge_access_token"
const REFRESH_TOKEN_KEY = "botforge_refresh_token"
const USER_KEY = "botforge_user"

function getStorage() {
  if (typeof window === "undefined") {
    return null
  }
  return window.localStorage
}

export function getAccessToken(): string | null {
  const storage = getStorage()
  return storage ? storage.getItem(ACCESS_TOKEN_KEY) : null
}

export function getRefreshToken(): string | null {
  const storage = getStorage()
  return storage ? storage.getItem(REFRESH_TOKEN_KEY) : null
}

export function getStoredUser(): AuthUser | null {
  const storage = getStorage()
  if (!storage) return null
  const raw = storage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function setAuthSession(tokens: AuthTokens, user: AuthUser): void {
  const storage = getStorage()
  if (!storage) return
  storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  storage.setItem(USER_KEY, JSON.stringify(user))
}

export function setStoredUser(user: AuthUser): void {
  const storage = getStorage()
  if (!storage) return
  storage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuthSession(): void {
  const storage = getStorage()
  if (!storage) return
  storage.removeItem(ACCESS_TOKEN_KEY)
  storage.removeItem(REFRESH_TOKEN_KEY)
  storage.removeItem(USER_KEY)
}

export async function apiRequest<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const executeRequest = async (token: string | null) => {
    const headers = new Headers(init.headers || {})
    const hasFormDataBody = typeof FormData !== "undefined" && init.body instanceof FormData
    if (!headers.has("Content-Type") && init.body && !hasFormDataBody) {
      headers.set("Content-Type", "application/json")
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }

    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    })
  }

  let response = await executeRequest(getAccessToken())

  if (response.status === 401 && path !== "/api/auth/refresh") {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      response = await executeRequest(getAccessToken())
    }
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.error || payload?.message || "Request failed"
    throw new Error(message)
  }

  return payload as T
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    return false
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    })

    if (!response.ok) {
      clearAuthSession()
      return false
    }

    const payload = (await response.json().catch(() => null)) as
      | { success: boolean; tokens?: AuthTokens }
      | null

    if (!payload?.tokens) {
      return false
    }

    const storage = getStorage()
    if (!storage) return false
    storage.setItem(ACCESS_TOKEN_KEY, payload.tokens.accessToken)
    storage.setItem(REFRESH_TOKEN_KEY, payload.tokens.refreshToken)
    return true
  } catch {
    clearAuthSession()
    return false
  }
}
