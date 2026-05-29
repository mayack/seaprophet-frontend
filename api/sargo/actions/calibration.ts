'use server'

import { sargoClient } from '../client'
import type { SubmitCalibrationObservationInput } from '../interfaces/calibration'

export async function submitCalibrationObservation(
  input: SubmitCalibrationObservationInput
) {
  try {
    const result = await sargoClient.submitCalibrationObservation(input)
    return { success: true as const, ...result }
  } catch (error) {
    console.error('Failed to submit calibration observation:', error)
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to submit calibration observation',
    }
  }
}
