'use client'

import type mapboxgl from 'mapbox-gl'
import { CONFIG } from '@/constants/config'
import { isUserCloseToLocation } from './utils'

type LngLat = [number, number]

interface SpotCameraInput {
  id: number
  center: LngLat
  /** Floor for a focused spot; final zoom = max(current, minZoom). */
  minZoom: number
  padding: mapboxgl.PaddingOptions
  /** Key for the current panel padding; a change (same spot) reframes in place. */
  paddingKey: string
  /** Direct /spot/[id] load may jump straight onto the first spot (no fly-in). */
  allowJump: boolean
}

const SPOT_FLY_MS = 800
const SPOT_PAN_MS = 400
const SPOT_REFRAME_MS = 400
const SPOT_RESTORE_MS = 700
const LOCATION_FLY_MS = 1000
const FOLLOW_MS = 1000
const ZOOM_BUTTON_MS = 300
const HOME_MIN_ZOOM = 12

/**
 * Single owner of the map camera. Every automatic move asks the controller,
 * which arbitrates against one fact: has the user taken the camera over?
 *
 * "Taken over" = any genuine pointer/wheel gesture (detected via `originalEvent`
 * on `movestart` — Mapbox sets it on user interaction but not on our own
 * flyTo/easeTo/jumpTo) or a deliberate button move we tag with `markTakeover()`
 * (zoom buttons, home, cluster expand). Programmatic moves the controller itself
 * makes — spot focus, reframe, restore, the location fly, follow — carry no
 * `originalEvent`, so they never count as takeover.
 *
 * Takeover is tracked as a monotonic `epoch`. An async location request snapshots
 * the epoch when it starts (`beginRecenter`); when the fix lands (`resolveRecenter`)
 * we fly only if the epoch is unchanged — so a fix that resolves after the user has
 * panned, zoomed, opened a card, or pressed home is silently dropped (the dot still
 * appears; the locate button just reads "off-center"). The same `epoch` snapshot at
 * card-open time decides whether closing the card zooms back out or stays put.
 */
export class MapCamera {
  private epoch = 0
  private pendingRecenterEpoch: number | null = null

  private focusSpotId: number | null = null
  private focusPaddingKey = ''
  // What closing an untouched card restores: the visited spot stays centered,
  // and we animate the zoom back to whatever the user had before they opened the
  // first card of the session (null → fall back to the default load zoom). We
  // deliberately do NOT restore the pre-focus *center* — flying back to wherever
  // the user happened to be is disorienting after searching a distant spot.
  private preFocusZoom: number | null = null
  private focusedCenter: LngLat | null = null
  private epochAtFocus = 0
  private firstFocusDone = false

  private readonly handleMoveStart: (event: { originalEvent?: unknown }) => void

  constructor(private readonly map: mapboxgl.Map) {
    // Only genuine user gestures carry a DOM originalEvent; our own camera
    // methods do not. This is the entire takeover signal.
    this.handleMoveStart = (event): void => {
      if (event.originalEvent) this.epoch += 1
    }
    map.on('movestart', this.handleMoveStart)
  }

  destroy(): void {
    this.map.off('movestart', this.handleMoveStart)
  }

  /** Button-driven takeover (zoom ±, home, cluster expand) — no DOM move event. */
  markTakeover(): void {
    this.epoch += 1
  }

  // ── Location recenter (async, epoch-guarded) ──────────────────────────────

  /** Arm an in-flight location request to recenter. Idempotent while pending so
   *  it survives the request's internal retries without resetting the baseline. */
  beginRecenter(): void {
    if (this.pendingRecenterEpoch === null) this.pendingRecenterEpoch = this.epoch
  }

  cancelRecenter(): void {
    this.pendingRecenterEpoch = null
  }

  /**
   * Resolve a location fix. Flies only if a recenter was armed, the user hasn't
   * taken over since it was armed, and we're not already there. Returns whether
   * we flew so the caller can set the locate-button state.
   */
  resolveRecenter(coords: LngLat): 'flew' | 'skipped' {
    const armedEpoch = this.pendingRecenterEpoch
    this.pendingRecenterEpoch = null
    if (armedEpoch === null) return 'skipped' // nothing pending
    if (this.epoch !== armedEpoch) return 'skipped' // user took over mid-request
    if (this.isAt(coords)) return 'skipped' // already centered on the user
    this.flyToLocation(coords)
    // A recenter that flies while a card is focused can only be user-initiated —
    // an auto-fly's pending is cancelled the moment a card opens — so it's a
    // takeover: closing the card then stays put instead of zooming back out.
    if (this.hasSpotFocus) this.markTakeover()
    return 'flew'
  }

  /** Explicit recenter (Locate button) when we already have a fix — always flies. */
  recenterNow(coords: LngLat): void {
    this.pendingRecenterEpoch = null
    this.flyToLocation(coords)
    // A deliberate user camera move, like the zoom and home buttons — counts as
    // a takeover so a card closed afterwards leaves the map here.
    this.markTakeover()
  }

  /** Passive follow on a poll fix while centered — caller gates on state/card. */
  followUser(coords: LngLat): void {
    this.map.easeTo({ center: coords, duration: FOLLOW_MS, essential: true })
  }

  // ── User-driven moves (count as takeover) ─────────────────────────────────

  zoomBy(delta: number): void {
    this.markTakeover()
    this.map.stop()
    this.map.easeTo({
      zoom: this.map.getZoom() + delta,
      duration: ZOOM_BUTTON_MS,
      essential: true,
    })
  }

  flyToHome(coords: LngLat): void {
    this.markTakeover()
    this.cancelRecenter()
    this.map.stop()
    this.map.flyTo({
      center: coords,
      zoom: Math.max(this.map.getZoom(), HOME_MIN_ZOOM),
      duration: LOCATION_FLY_MS,
      essential: true,
    })
  }

  // ── Spot focus (card always wins the camera) ──────────────────────────────

  applySpotCamera(input: SpotCameraInput): void {
    this.cancelRecenter() // a focused card outranks any pending location fly

    const targetZoom = Math.max(this.map.getZoom(), input.minZoom)
    const needsZoomIn = this.map.getZoom() < input.minZoom

    if (input.id !== this.focusSpotId) {
      const isFreshOpen = this.focusSpotId === null
      if (isFreshOpen) {
        // Start of a browsing session: remember the zoom to return to and reset
        // the takeover baseline. A direct link has no prior zoom, so closing
        // falls back to the default load zoom.
        const jump = !this.firstFocusDone && input.allowJump
        this.preFocusZoom = jump ? null : this.map.getZoom()
        this.epochAtFocus = this.epoch
        this.firstFocusDone = true
        this.focusSpotId = input.id
        this.focusedCenter = input.center
        this.focusPaddingKey = input.paddingKey
        this.map.stop()
        if (jump) {
          this.map.jumpTo({
            center: input.center,
            zoom: targetZoom,
            padding: input.padding,
          })
          return
        }
        this.moveToSpot(input.center, targetZoom, input.padding, needsZoomIn)
        return
      }

      // Spot-hop A → B: keep the original zoom + takeover baseline, but track the
      // latest spot so closing zooms out with *it* centered.
      this.firstFocusDone = true
      this.focusSpotId = input.id
      this.focusedCenter = input.center
      this.focusPaddingKey = input.paddingKey
      this.map.stop()
      this.moveToSpot(input.center, targetZoom, input.padding, needsZoomIn)
      return
    }

    // Same spot, padding changed (desktop resize / sheet inset) → reframe in
    // place so the pin stays centered in the uncovered area. Programmatic, so
    // it never counts as user interaction.
    if (input.paddingKey !== this.focusPaddingKey) {
      this.focusPaddingKey = input.paddingKey
      this.map.stop()
      this.map.easeTo({
        center: input.center,
        zoom: targetZoom,
        padding: input.padding,
        duration: SPOT_REFRAME_MS,
        essential: true,
      })
    }
  }

  /**
   * Card closed: keep the visited spot centered and animate the zoom back to what
   * the user had before opening the card (or the default load zoom if there's
   * nothing to restore). If the user took the camera over while the card was
   * open, just shed the panel padding without a visible shift instead.
   */
  endSpotFocus(): void {
    const center = this.focusedCenter
    const zoom = this.preFocusZoom ?? CONFIG.map.defaults.zoom
    const tookOver = this.epoch !== this.epochAtFocus
    this.clearFocusTracking()
    this.focusedCenter = null
    this.preFocusZoom = null

    if (tookOver || !center) {
      this.clearPaddingInPlace()
      return
    }
    this.map.stop()
    this.map.easeTo({
      center,
      zoom,
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      duration: SPOT_RESTORE_MS,
      essential: true,
    })
  }

  /** Reset focus tracking without moving (panel closed without a camera reset).
   *  Deliberately leaves `preFocusZoom`/`focusedCenter`/`epochAtFocus` for
   *  `endSpotFocus` to own. */
  clearFocusTracking(): void {
    this.focusSpotId = null
    this.focusPaddingKey = ''
  }

  get hasSpotFocus(): boolean {
    return this.focusSpotId !== null
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private moveToSpot(
    center: LngLat,
    zoom: number,
    padding: mapboxgl.PaddingOptions,
    needsZoomIn: boolean
  ): void {
    if (needsZoomIn) {
      // Zooming in reads better as a flyTo; a same-zoom pan as an easeTo (less
      // label churn).
      this.map.flyTo({
        center,
        zoom,
        padding,
        duration: SPOT_FLY_MS,
        curve: 1,
        essential: true,
      })
    } else {
      this.map.easeTo({
        center,
        zoom,
        padding,
        duration: SPOT_PAN_MS,
        essential: true,
      })
    }
  }

  private flyToLocation(coords: LngLat): void {
    this.map.stop()
    this.map.flyTo({
      center: coords,
      zoom: this.map.getZoom(),
      duration: LOCATION_FLY_MS,
      curve: 1,
      essential: true,
    })
  }

  private isAt(coords: LngLat): boolean {
    const center = this.map.getCenter()
    return isUserCloseToLocation(coords[1], coords[0], center.lat, center.lng)
  }

  /**
   * Drop the panel padding without moving the visible map: re-center on whatever
   * geo point is at the viewport's pixel center, with zero padding, so the
   * on-screen view is byte-for-byte unchanged.
   */
  private clearPaddingInPlace(): void {
    const padding = this.map.getPadding()
    if (!padding) return
    if (!padding.top && !padding.bottom && !padding.left && !padding.right) return

    const container = this.map.getContainer()
    const visualCenter = this.map.unproject([
      container.clientWidth / 2,
      container.clientHeight / 2,
    ])
    this.map.jumpTo({
      center: visualCenter,
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
    })
  }
}
