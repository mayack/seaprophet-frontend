'use server'

import { getCurrentUser } from '@/api/sargo/actions/auth'
import { isDevModeActive } from '@/lib/userSettings'
import { getErrorMessage } from '@/utils/error'
import { polvoClient } from '../client'
import type { CamHealthState } from '../interfaces/camHealth'
import { withPolvoAuth } from '../withPolvoAuth'

export type CamHealthResponse =
  | { success: true; state: CamHealthState }
  | { success: false; error: string }

/**
 * Dev mode only, checked here as well as in the UI: a run costs a few minutes
 * of polvo's worker and a page load per Camaramar and Surftotal cam.
 */
async function requireDevMode(): Promise<string | null> {
  const user = await getCurrentUser()
  return user && isDevModeActive(user) ? null : 'Dev mode is required'
}

/** Latest camera health report, grouped by provider. */
export async function getCameraHealth(): Promise<CamHealthResponse> {
  const denied = await requireDevMode()
  if (denied) return { success: false, error: denied }
  try {
    const state = await withPolvoAuth((token) =>
      polvoClient.getCamHealth(token)
    )
    return { success: true, state }
  } catch (error) {
    return { success: false, error: getErrorMessage(error) }
  }
}

/** Start a camera health run now. A run already queued or running is reused. */
export async function runCameraHealth(): Promise<CamHealthResponse> {
  const denied = await requireDevMode()
  if (denied) return { success: false, error: denied }
  try {
    const state = await withPolvoAuth((token) =>
      polvoClient.runCamHealth(token)
    )
    return { success: true, state }
  } catch (error) {
    return { success: false, error: getErrorMessage(error) }
  }
}
