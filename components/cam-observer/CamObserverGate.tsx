'use client'

import React from 'react'
import { CamObserverToolbar } from '@/components/cam-observer/CamObserverToolbar'
import { useUser } from '@/contexts/UserContext'
import { isCamObserverVisible } from '@/lib/userSettings'
import type { HourlyForecast } from '@/api/polvo/interfaces/forecast'

interface CamObserverGateProps {
  spotId: number
  spotName: string
  todayDate?: string
  todayHours?: Record<string, HourlyForecast>
}

export function CamObserverGate({
  spotId,
  spotName,
  todayDate,
  todayHours,
}: CamObserverGateProps): React.JSX.Element | null {
  const { userData } = useUser()

  if (!isCamObserverVisible(userData)) {
    return null
  }

  return (
    <CamObserverToolbar
      spotId={spotId}
      spotName={spotName}
      todayDate={todayDate}
      todayHours={todayHours}
    />
  )
}
