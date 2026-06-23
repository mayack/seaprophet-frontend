'use client'

import { User } from '@/api/sargo/interfaces/user'
import { CONFIG } from '@/constants/config'
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from 'react'

type UserWithLocation = User & { latitude?: number; longitude?: number }

interface UserContextType {
  userData: UserWithLocation
  // Merge a partial update onto the current user. Always use this instead of a
  // wholesale replace so location/id/calibrationReporter survive a settings or
  // favorites update.
  updateUser: (patch: Partial<UserWithLocation>) => void
  requestLocation: (
    highAccuracy?: boolean,
    forceFresh?: boolean
  ) => Promise<
    | { latitude: number; longitude: number }
    // `busy` = another request already holds the geolocation lock (contention),
    // distinct from a real failure so callers can ignore it rather than count it.
    | {
        error: 'permission' | 'unavailable' | 'timeout' | 'unsupported' | 'busy'
      }
  >
  // Drop the user's location everywhere — clears the in-memory coords and the
  // sessionStorage cache. Called when geolocation permission is denied/revoked
  // so nothing (map dot, distances) keeps showing a stale position.
  clearLocation: () => void
  // "Limp mode": location acquisition is failing (retries exhausted, or repeated
  // poll failures). The locate button goes red and polling slows but keeps
  // trying. Set from the map's retry flow and from the poll below; cleared by any
  // success.
  locationDegraded: boolean
  markLocationDegraded: (degraded: boolean) => void
}

interface StoredLocation {
  latitude: number
  longitude: number
  timestamp: number
}

const UserContext = createContext<UserContextType | undefined>(undefined)

const LOCATION_CACHE_KEY = CONFIG.api.tokens.geolocation.token
const LOCATION_CACHE_MAX_AGE = CONFIG.api.tokens.geolocation.maxAge

function getStoredLocation(): {
  latitude?: number
  longitude?: number
  timestamp?: number
} {
  if (typeof window === 'undefined') return {}

  try {
    const stored = sessionStorage.getItem(LOCATION_CACHE_KEY)
    if (stored) {
      const location = JSON.parse(stored) as StoredLocation
      if (Date.now() - location.timestamp < LOCATION_CACHE_MAX_AGE) {
        return location
      }
      sessionStorage.removeItem(LOCATION_CACHE_KEY)
    }
  } catch (error) {
    console.error('Error reading location cache:', error)
    sessionStorage.removeItem(LOCATION_CACHE_KEY)
  }

  return {}
}

function parseGeolocationError(
  error: unknown
): 'permission' | 'unavailable' | 'timeout' {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as GeolocationPositionError).code === 'number'
  ) {
    switch ((error as GeolocationPositionError).code) {
      case 1:
        return 'permission'
      case 2:
        return 'unavailable'
      case 3:
        return 'timeout'
    }
  }

  if (error instanceof Error && error.message.includes('timed out')) {
    return 'timeout'
  }

  return 'unavailable'
}

export function UserProvider({
  initialUserData,
  children,
}: {
  initialUserData: User
  children: ReactNode
}) {
  const storedLocation = getStoredLocation()

  const [userData, setUserData] = useState<UserWithLocation>(() => ({
    ...initialUserData,
    latitude: storedLocation.latitude,
    longitude: storedLocation.longitude,
  }))

  const updateUser = useCallback((patch: Partial<UserWithLocation>) => {
    setUserData((prev) => ({ ...prev, ...patch }))
  }, [])

  // Synchronous in-flight guard so concurrent callers of `requestLocation`
  // observe the active request without waiting for a state flush.
  const isLocatingRef = useRef(false)
  const [lastLocationUpdate, setLastLocationUpdate] = useState<number | null>(
    storedLocation.timestamp || null
  )

  const storeLocation = useCallback((latitude: number, longitude: number) => {
    const timestamp = Date.now()
    try {
      const locationData: StoredLocation = { latitude, longitude, timestamp }
      sessionStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(locationData))
      setLastLocationUpdate(timestamp)
    } catch (error) {
      console.error('Error storing location:', error)
    }
  }, [])

  const requestLocation = useCallback(
    async (highAccuracy: boolean = false, forceFresh: boolean = false) => {
      // `forceFresh` bypasses every cache (our sessionStorage entry AND the OS
      // `maximumAge` below) so the caller gets a genuinely current fix — used by
      // the location poll and the locate button.
      if (!forceFresh) {
        // Read the cache from sessionStorage (always fresh) rather than closed-over
        // state, which would go stale since this callback is memoized at mount.
        // getStoredLocation() already drops entries past LOCATION_CACHE_MAX_AGE.
        const cached = getStoredLocation()
        if (cached.latitude !== undefined && cached.longitude !== undefined) {
          setUserData((prev) => ({
            ...prev,
            latitude: cached.latitude,
            longitude: cached.longitude,
          }))
          setLastLocationUpdate(cached.timestamp ?? Date.now())
          return { latitude: cached.latitude, longitude: cached.longitude }
        }
      }

      if (!navigator.geolocation) {
        return { error: 'unsupported' as const }
      }

      // Synchronous guard against concurrent calls. Reported as `busy` (not a
      // failure) so a background poll colliding with a manual retry — or vice
      // versa — never counts against either one's failure budget.
      if (isLocatingRef.current) return { error: 'busy' as const }
      isLocatingRef.current = true

      const { timeouts } = CONFIG.map.location
      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            const timeout = highAccuracy
              ? timeouts.highAccuracy
              : timeouts.standard
            const timeoutId = setTimeout(() => {
              reject(new Error('Location request timed out'))
            }, timeout + 2000)

            navigator.geolocation.getCurrentPosition(
              (pos) => {
                clearTimeout(timeoutId)
                resolve(pos)
              },
              (err) => {
                clearTimeout(timeoutId)
                reject(err)
              },
              {
                enableHighAccuracy: highAccuracy,
                timeout,
                // `forceFresh` bypasses our sessionStorage cache (above) but still
                // lets the OS return a recent fix — much faster than a cold
                // acquisition, and it stops the locate button from timing out
                // when a usable position already exists.
                maximumAge: forceFresh
                  ? timeouts.maxAge.fresh
                  : highAccuracy
                    ? timeouts.maxAge.highAccuracy
                    : timeouts.maxAge.standard,
              }
            )
          }
        )

        const { latitude, longitude } = position.coords

        setUserData((prev) => ({ ...prev, latitude, longitude }))
        storeLocation(latitude, longitude)
        isLocatingRef.current = false

        return { latitude, longitude }
      } catch (error) {
        // No logging here: transient geolocation failures are expected (the OS
        // logs its own `kCLErrorLocationUnknown` anyway) and limp mode is the
        // real signal. Callers decide what a failure means.
        const kind = parseGeolocationError(error)
        isLocatingRef.current = false
        return { error: kind }
      }
    },
    [storeLocation]
  )

  const clearLocation = useCallback(() => {
    setUserData((prev) =>
      prev.latitude == null && prev.longitude == null
        ? prev
        : { ...prev, latitude: undefined, longitude: undefined }
    )
    setLastLocationUpdate(null)
    try {
      sessionStorage.removeItem(LOCATION_CACHE_KEY)
    } catch (error) {
      console.error('Error clearing location cache:', error)
    }
  }, [])

  // Clear expired location on mount. Deferred a frame so state isn't set
  // synchronously inside the effect body.
  useEffect(() => {
    if (
      !lastLocationUpdate ||
      Date.now() - lastLocationUpdate < LOCATION_CACHE_MAX_AGE
    ) {
      return
    }
    const raf = requestAnimationFrame(() => {
      setUserData((prev) => ({
        ...prev,
        latitude: undefined,
        longitude: undefined,
      }))
      setLastLocationUpdate(null)
      sessionStorage.removeItem(LOCATION_CACHE_KEY)
    })
    return (): void => cancelAnimationFrame(raf)
  }, [lastLocationUpdate])

  // Keep the location reasonably fresh without continuous `watchPosition`
  // tracking: poll a fresh fix on an interval while the tab is visible. Gated
  // on already having a fix (`hasLocationRef`) so it never triggers an
  // unsolicited permission prompt — except in limp mode, where it keeps trying
  // to recover. Pauses while the tab is hidden, fetches immediately on resume
  // (so reopening a backgrounded tab updates the dot), slows down while
  // degraded, and stops permanently if permission is revoked.
  const hasLocationRef = useRef(false)
  // Sticky: have we held a fix at any point this session? Limp-mode recovery
  // only makes sense for a fix we *lost* — a device that never located (desktop,
  // location off, VM) can't recover by retrying, so it must stay out of the poll.
  const everHadFixRef = useRef(false)
  useEffect(() => {
    const has =
      userData.latitude !== undefined && userData.longitude !== undefined
    hasLocationRef.current = has
    if (has) everHadFixRef.current = true
  }, [userData.latitude, userData.longitude])

  // Opt-out switch (Settings → Location): when off, no requests, no polling, no
  // dot — even with browser permission granted. Defaults to on.
  const locationTrackingEnabled =
    userData.settings?.locationTrackingEnabled !== false

  // Limp mode: location acquisition is failing. Flipped here by repeated poll
  // failures, and by the map's retry flow via markLocationDegraded. Any success
  // (poll or manual) clears it.
  const [locationDegraded, setLocationDegraded] = useState(false)
  const pollFailuresRef = useRef(0)
  // Bounds recovery polling once degraded (reset on each entry into limp mode).
  const degradedAttemptsRef = useRef(0)
  const markLocationDegraded = useCallback((degraded: boolean): void => {
    if (degraded) degradedAttemptsRef.current = 0
    else pollFailuresRef.current = 0
    setLocationDegraded(degraded)
  }, [])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return

    // Opted out: drop any fix (removes the dot reactively) and don't track.
    // Deferred a frame so state isn't set synchronously in the effect body.
    if (!locationTrackingEnabled) {
      const raf = requestAnimationFrame(() => clearLocation())
      return (): void => cancelAnimationFrame(raf)
    }

    // The first fix on enable is driven by the map (useMapbox), which also owns
    // the locate-button loading/error states — so we don't request here.
    const {
      pollFailureLimpThreshold,
      pollIntervalMs,
      pollIntervalDegradedMs,
      pollDegradedRecoveryAttempts,
    } = CONFIG.map.location
    let permissionDenied = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    const stop = (): void => {
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const tick = async (): Promise<void> => {
      if (permissionDenied || document.hidden) return
      // Normally polling waits until we already have a fix (so it can't trigger
      // an unsolicited prompt). In limp mode we keep trying to re-acquire even
      // without one — but only to recover a fix we actually had. A device that
      // never located can't recover by retrying, so it stays gated out.
      if (
        !hasLocationRef.current &&
        (!locationDegraded || !everHadFixRef.current)
      )
        return

      const result = await requestLocation(false, true)
      if (!('error' in result)) {
        pollFailuresRef.current = 0
        if (locationDegraded) markLocationDegraded(false) // recovered
        return
      }
      // Contention with a manual request — not a failure; just skip this tick.
      if (result.error === 'busy') return
      if (result.error === 'permission') {
        permissionDenied = true
        stop()
        return
      }
      // Already limping: bounded recovery. After a handful of failed attempts,
      // stop the interval — stay visually degraded (button red); a manual locate
      // or a tab refocus re-arms a fresh batch.
      if (locationDegraded) {
        degradedAttemptsRef.current += 1
        if (degradedAttemptsRef.current >= pollDegradedRecoveryAttempts) stop()
        return
      }
      // Real failure (timeout / unavailable / unsupported): count toward limp.
      pollFailuresRef.current += 1
      if (pollFailuresRef.current >= pollFailureLimpThreshold) {
        markLocationDegraded(true)
      }
    }

    const start = (): void => {
      if (intervalId === null) {
        intervalId = setInterval(
          () => void tick(),
          locationDegraded ? pollIntervalDegradedMs : pollIntervalMs
        )
      }
    }

    const handleVisibility = (): void => {
      if (document.hidden) {
        stop()
      } else {
        // Re-engaging the tab grants degraded recovery a fresh batch of attempts.
        degradedAttemptsRef.current = 0
        void tick()
        start()
      }
    }

    // iOS restores backgrounded tabs from the bfcache without re-running this
    // module; `pageshow` with `persisted` is the only reliable "we're back"
    // signal there, so refresh on it too.
    const handlePageShow = (event: PageTransitionEvent): void => {
      if (event.persisted && !document.hidden) {
        degradedAttemptsRef.current = 0
        void tick()
        start()
      }
    }

    // Refresh immediately on (re)mount so a returning user sees their current
    // position right away rather than the cached seed until the first interval.
    void tick()
    start()
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pageshow', handlePageShow)
    return (): void => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pageshow', handlePageShow)
    }
    // Re-runs when degraded flips so the interval switches rate (and the gate
    // opens) — markLocationDegraded is stable.
  }, [
    requestLocation,
    locationTrackingEnabled,
    clearLocation,
    locationDegraded,
    markLocationDegraded,
  ])

  // Memoize so consumers don't re-render on every parent render with a
  // brand-new object identity. `setUserData` is a setState fn (stable);
  // `requestLocation` is already a stable useCallback.
  const contextValue = useMemo<UserContextType>(
    () => ({
      userData,
      updateUser,
      requestLocation,
      clearLocation,
      locationDegraded,
      markLocationDegraded,
    }),
    [
      userData,
      updateUser,
      requestLocation,
      clearLocation,
      locationDegraded,
      markLocationDegraded,
    ]
  )

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within UserProvider')
  return context
}
