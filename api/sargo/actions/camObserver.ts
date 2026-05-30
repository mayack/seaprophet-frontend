'use server'

import { sargoClient } from '../client'
import type { SubmitCamObserverReportInput } from '../interfaces/camObserver'

export async function submitCamObserverReport(
  input: SubmitCamObserverReportInput
) {
  try {
    const result = await sargoClient.submitCamObserverReport(input)
    return { success: true as const, ...result }
  } catch (error) {
    console.error('Failed to submit cam observer report:', error)
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to submit cam observer report',
    }
  }
}
