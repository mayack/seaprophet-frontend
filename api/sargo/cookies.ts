import { cookies } from 'next/headers'
import { CONFIG } from '@/constants/config'
import { normalizeUserSettings } from '@/lib/userSettings'
import type { User } from './interfaces/user'

// The shape persisted in the TOKEN_SARGO_OPTIONS cookie — the fast-path
// snapshot getCurrentUser() reads on every render. Keep it in lockstep with
// what getCurrentUser() expects so no field silently disappears on a write.
export type SargoOptions = Pick<
  User,
  'id' | 'username' | 'email' | 'settings' | 'calibrationReporter'
>

/** Parse the cached user snapshot, or null if absent/corrupt. */
export async function readSargoOptions(): Promise<Partial<SargoOptions> | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(CONFIG.api.tokens.sargoOptions.key)?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as Partial<SargoOptions>
  } catch (error) {
    console.error('Failed to parse sargoOptions cookie:', error)
    return null
  }
}

function serialize(data: Partial<SargoOptions>): string {
  return JSON.stringify({
    id: data.id,
    username: data.username,
    email: data.email,
    settings: normalizeUserSettings(data.settings),
    calibrationReporter: !!data.calibrationReporter,
  })
}

// Best-effort: getCurrentUser() runs in Server Components where Next.js
// forbids cookie writes. Callers that are server actions still get the write;
// render-time callers fall through harmlessly.
async function setCookie(value: string): Promise<void> {
  try {
    const cookieStore = await cookies()
    cookieStore.set({
      name: CONFIG.api.tokens.sargoOptions.key,
      value,
      ...CONFIG.api.tokens.sargoOptions.options,
    })
  } catch {
    // Server Component context — cookie write not allowed, that's fine.
  }
}

/** Overwrite the cached snapshot wholesale (sign-in, full refresh). */
export async function writeSargoOptions(
  data: Partial<SargoOptions>
): Promise<void> {
  await setCookie(serialize(data))
}

/**
 * Merge a patch onto the existing snapshot, then persist. Mutations that only
 * know part of the user (a new username, new settings, new favorites) use this
 * so untouched fields — notably `calibrationReporter` — survive the write.
 */
export async function mergeSargoOptions(
  patch: Partial<SargoOptions>
): Promise<void> {
  const existing = (await readSargoOptions()) ?? {}
  await setCookie(serialize({ ...existing, ...patch }))
}
