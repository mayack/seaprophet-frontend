import { unstable_cache } from 'next/cache'
import { getErrorMessage } from '@/utils/error'
import { polvoClient } from './client'
import {
  NowConditions,
  NowConditionsParams,
  NowConditionsActionResponse,
} from './interfaces/now'
import { withPolvoAuth } from './withPolvoAuth'

// Server-only (called by the /api/now route), not a Server Action. Same
// caching approach as `getForecast`: cached by params, not by the token-keyed
// fetch; the backend additionally micro-caches the summary for 5 min.
const cachedNowConditions = unstable_cache(
  (params: NowConditionsParams): Promise<NowConditions[]> =>
    withPolvoAuth((token) => polvoClient.getNowConditions(params, token)),
  ['polvo-now-conditions'],
  { revalidate: 240 }
)

export async function getNowConditions(
  params: NowConditionsParams
): Promise<NowConditionsActionResponse> {
  const timestamp = new Date().toISOString()

  try {
    const data = await cachedNowConditions({
      surfUnits: params.surfUnits,
      windUnits: params.windUnits,
      periodStatistic: params.periodStatistic,
    })

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
