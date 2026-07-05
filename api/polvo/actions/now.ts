'use server'

import { getErrorMessage } from '@/utils/error'
import { polvoClient } from '../client'
import {
  NowConditionsParams,
  NowConditionsActionResponse,
} from '../interfaces/now'
import { withPolvoAuth } from './withPolvoAuth'

// Same shape/caching philosophy as `getForecast`: the client fetch uses
// `next: { revalidate: 240 }`, so the Next.js Data Cache dedupes across
// requests; the backend additionally micro-caches the summary for 5 min.
export async function getNowConditions(
  params: NowConditionsParams
): Promise<NowConditionsActionResponse> {
  const timestamp = new Date().toISOString()

  try {
    const data = await withPolvoAuth((token) =>
      polvoClient.getNowConditions(params, token)
    )

    return {
      data,
      error: null,
      meta: { timestamp, source: 'polvo', success: true },
    }
  } catch (error) {
    return {
      data: null,
      error: getErrorMessage(error),
      meta: { timestamp, source: 'polvo', success: false },
    }
  }
}
