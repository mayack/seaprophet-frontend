'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { getCameraHealth, runCameraHealth } from '@/api/polvo/actions/camHealth'
import type {
  CamHealthCheck,
  CamHealthProvider,
  CamHealthStage,
  CamHealthState,
} from '@/api/polvo/interfaces/camHealth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { recoverFromDeploySkew } from '@/lib/recoverFromDeploySkew'
import { cn } from '@/lib/utils'

/** How often to re-read while a run is queued or in progress (a run takes ~3 min). */
const POLL_MS = 5000

const STAGE_LABEL: Record<CamHealthStage, string> = {
  resolve: 'Page',
  playlist: 'Playlist',
  variant: 'Variant',
  segment: 'Segment',
  cors: 'CORS',
}

const SESSION_LABEL = {
  alive: 'alive',
  expired: 'expired',
  none: 'missing',
} as const

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size)
      return relative.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

function duration(ms: number): string {
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  return minutes ? `${minutes}m ${total % 60}s` : `${total}s`
}

function StatusDot({
  tone,
}: {
  tone: 'ok' | 'partial' | 'down'
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'size-2 shrink-0 rounded-full',
        tone === 'ok' && 'bg-green-600',
        tone === 'partial' && 'bg-yellow-600',
        tone === 'down' && 'bg-red-600'
      )}
    />
  )
}

const toneOf = (ok: number, total: number): 'ok' | 'partial' | 'down' =>
  ok === total ? 'ok' : ok === 0 ? 'down' : 'partial'

/** "Razo", or "Razo (2)" when a spot has several unnamed cams in the list. */
function camLabels(cams: CamHealthCheck[]): Map<string, string> {
  const counts = new Map<string, number>()
  for (const cam of cams)
    counts.set(cam.spotName, (counts.get(cam.spotName) ?? 0) + 1)
  const seen = new Map<string, number>()
  return new Map(
    cams.map((cam) => {
      if (cam.camName) return [cam.id, `${cam.spotName} · ${cam.camName}`]
      if ((counts.get(cam.spotName) ?? 0) < 2) return [cam.id, cam.spotName]
      const n = (seen.get(cam.spotName) ?? 0) + 1
      seen.set(cam.spotName, n)
      return [cam.id, `${cam.spotName} (${n})`]
    })
  )
}

function ProviderRow({
  provider,
  cams,
}: {
  provider: CamHealthProvider
  cams: CamHealthCheck[]
}): React.JSX.Element {
  const labels = camLabels(cams)
  const failing = cams.filter((cam) => !cam.ok)
  const working = cams.filter((cam) => cam.ok)

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 hover:bg-foreground/3 [&::-webkit-details-marker]:hidden">
        <StatusDot tone={toneOf(provider.ok, provider.total)} />
        <span className="min-w-0 flex-1 truncate">{provider.label}</span>
        <span className="text-muted-foreground tabular-nums">
          {provider.ok}/{provider.total}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="flex flex-col gap-3 pr-3 pb-3 pl-8">
        {failing.map((cam) => (
          <div key={cam.id} className="min-w-0">
            <div className="flex items-center gap-2">
              <a
                href={cam.target}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate font-medium hover:underline"
              >
                {labels.get(cam.id)}
              </a>
              {cam.stage ? (
                <Badge variant="destructive">{STAGE_LABEL[cam.stage]}</Badge>
              ) : null}
            </div>
            <p className="text-xs break-words text-muted-foreground">
              {cam.error}
              {' · '}
              {cam.lastOkAt
                ? `last worked ${timeAgo(cam.lastOkAt)}`
                : 'not seen working yet'}
              {cam.checkedAt ? ` · checked ${timeAgo(cam.checkedAt)}` : null}
            </p>
          </div>
        ))}
        {working.length ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Working:</span>{' '}
            {working.map((cam) => labels.get(cam.id)).join(', ')}
          </p>
        ) : null}
      </div>
    </details>
  )
}

/**
 * Dev-mode "Cameras" settings tab: polvo checks each cam in sargo at 10:00 and
 * 15:00 in its spot's local time, and this shows each cam's latest result per
 * provider, with a button to check every cam now.
 *
 * `active` is whether the tab is showing. Settings keeps every tab mounted, so
 * this only fetches (and polls) while it is actually visible.
 */
export function CameraHealthPanel({
  active,
}: {
  active: boolean
}): React.JSX.Element {
  const [state, setState] = useState<CamHealthState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    try {
      const result = await getCameraHealth()
      if (result.success) {
        setState(result.state)
        setError(null)
      } else {
        setError(result.error)
      }
    } catch (err) {
      if (recoverFromDeploySkew(err)) return
      setError(
        err instanceof Error ? err.message : 'Could not load camera health'
      )
    }
  }, [])

  // Deferred a frame so the effect body never sets state synchronously (the
  // rAF pattern used elsewhere in the app). Re-reads each time the tab opens.
  useEffect(() => {
    if (!active) return
    const raf = requestAnimationFrame(() => void load())
    return (): void => cancelAnimationFrame(raf)
  }, [active, load])

  const pending = !!state && (state.running || state.queued)
  useEffect(() => {
    if (!active || !pending) return
    const timer = setInterval(() => void load(), POLL_MS)
    return (): void => clearInterval(timer)
  }, [active, pending, load])

  const handleRun = useCallback(async (): Promise<void> => {
    setRequesting(true)
    try {
      const result = await runCameraHealth()
      if (result.success) setState(result.state)
      else setError(result.error)
    } catch (err) {
      if (!recoverFromDeploySkew(err)) {
        setError(err instanceof Error ? err.message : 'Could not start a check')
      }
    } finally {
      setRequesting(false)
    }
  }, [])

  if (!state) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {error ? (
          <>
            <span className="text-destructive">{error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </>
        ) : (
          <>
            <Spinner />
            Loading camera health…
          </>
        )}
      </div>
    )
  }

  const { report } = state
  const okCount = report?.cams.filter((cam) => cam.ok).length ?? 0

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium">
            {report
              ? `${okCount} of ${report.cams.length} cameras working`
              : 'No check has run yet'}
          </div>
          {report ? (
            <div className="text-muted-foreground">
              Last check {timeAgo(report.finishedAt)} ({report.trigger}
              {report.checked !== undefined
                ? `, ${report.checked} ${report.checked === 1 ? 'cam' : 'cams'}`
                : ''}
              ) · took {duration(report.durationMs)}
            </div>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || requesting}
          onClick={() => void handleRun()}
        >
          {pending || requesting ? (
            <>
              <Spinner />
              {state.running ? 'Checking…' : 'Queued…'}
            </>
          ) : (
            'Check now'
          )}
        </Button>
      </div>

      {error ? <p className="text-destructive">{error}</p> : null}
      {report?.error ? (
        <p className="text-destructive">{report.error}</p>
      ) : null}

      {report?.sessions.length ? (
        <div className="flex flex-col gap-1.5">
          {report.sessions.map(({ site, session }) => (
            <div key={site} className="flex items-center gap-3">
              <StatusDot tone={session === 'alive' ? 'ok' : 'down'} />
              <span className="capitalize">{site} login</span>
              <span className="text-muted-foreground">
                {SESSION_LABEL[session]}
              </span>
              {session !== 'alive' ? (
                <span className="text-xs text-muted-foreground">
                  — run <code>npm run session:bootstrap</code> in
                  seaprophet-polvo
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {report?.providers.length ? (
        <div className="flex flex-col divide-y overflow-hidden rounded-lg border">
          {report.providers.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              cams={report.cams.filter((cam) => cam.provider === provider.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
