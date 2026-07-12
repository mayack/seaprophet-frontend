import type mapboxgl from 'mapbox-gl'
import type { WindFieldMeta } from './windData'

/**
 * Windy-style animated wind particles as a Canvas2D overlay.
 *
 * Particles live in GEOGRAPHIC space (lon/lat) and are advected by the wind
 * field each animation frame; every frame we project them through
 * `map.project`, so they track pans/zooms and work under any projection —
 * including globe, which killed the Mapbox raster-particle attempt. Trails
 * come from the classic fade trick: each frame the whole canvas is kept at
 * ~93% alpha (`destination-in`) before new segments are drawn, so history
 * dissolves smoothly.
 *
 * Canvas2D over WebGL is deliberate: a few thousand line segments per frame
 * is trivial for 2D canvas, there's no GL state to fight Mapbox over, and
 * the whole engine stays debuggable. (earth.nullschool shipped years of the
 * same visual on Canvas2D.)
 */

const FADE_ALPHA = 0.93
const LINE_WIDTH = 1.1
const MAX_AGE_FRAMES = 90
// Target on-screen speed: a fresh ~8 m/s breeze moves ~1.4 px/frame. The
// geographic step per frame is derived from this against the current
// meters-per-pixel, so motion feels equally alive at every zoom.
const TARGET_PX_PER_FRAME_AT_8MS = 1.4
// One particle per this many px² of canvas (≈3.5k on a laptop viewport).
const PX_PER_PARTICLE = 5000
const MAX_PARTICLES = 6000

// Same hue progression as the Windy/Mapbox ramp, keyed by speed (m/s).
const COLOR_STOPS: Array<[number, string]> = [
  [0, 'rgba(134,163,171,0.85)'],
  [4, 'rgba(110,143,208,0.9)'],
  [7, 'rgba(15,147,167,0.9)'],
  [10, 'rgba(57,163,57,0.9)'],
  [13, 'rgba(194,134,62,0.95)'],
  [16, 'rgba(200,66,13,0.95)'],
  [20, 'rgba(210,0,50,1)'],
  [24, 'rgba(175,80,136,1)'],
  [28, 'rgba(117,74,147,1)'],
]

function speedColor(speed: number): string {
  for (let i = COLOR_STOPS.length - 1; i >= 0; i--) {
    if (speed >= COLOR_STOPS[i][0]) return COLOR_STOPS[i][1]
  }
  return COLOR_STOPS[0][1]
}

interface Particle {
  lon: number
  lat: number
  age: number
}

export class WindParticleEngine {
  private map: mapboxgl.Map
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private meta: WindFieldMeta | null = null
  private frame: Uint8Array | null = null
  private particles: Particle[] = []
  private raf = 0
  private resizeHandler: () => void

  constructor(map: mapboxgl.Map) {
    this.map = map
    this.canvas = document.createElement('canvas')
    // No z-index: appended last inside the map container it paints above the
    // GL canvas by DOM order, while the app's positioned UI overlays (buttons,
    // scrubber pill), which come later in the DOM, still paint above it.
    this.canvas.style.cssText =
      'position:absolute;inset:0;pointer-events:none;'
    map.getContainer().appendChild(this.canvas)
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('2d canvas unavailable')
    this.ctx = ctx
    this.resizeHandler = (): void => this.resize()
    this.resize()
    map.on('resize', this.resizeHandler)
    this.loop()
  }

  setField(meta: WindFieldMeta, frame: Uint8Array): void {
    this.meta = meta
    this.frame = frame
    if (this.particles.length === 0) this.seed()
  }

  setFrame(frame: Uint8Array): void {
    this.frame = frame
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    this.map.off('resize', this.resizeHandler)
    this.canvas.remove()
  }

  private resize(): void {
    const { clientWidth, clientHeight } = this.map.getContainer()
    this.canvas.width = clientWidth
    this.canvas.height = clientHeight
    this.seed()
  }

  private particleTarget(): number {
    return Math.min(
      MAX_PARTICLES,
      Math.round((this.canvas.width * this.canvas.height) / PX_PER_PARTICLE)
    )
  }

  private randomInView(): Particle {
    const bounds = this.map.getBounds()
    if (!bounds) return { lon: 0, lat: 0, age: 0 }
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    return {
      lon: sw.lng + Math.random() * (ne.lng - sw.lng),
      lat: sw.lat + Math.random() * (ne.lat - sw.lat),
      // Stagger ages so respawns don't pulse in waves.
      age: Math.floor(Math.random() * MAX_AGE_FRAMES),
    }
  }

  private seed(): void {
    const n = this.particleTarget()
    this.particles = Array.from({ length: n }, () => this.randomInView())
  }

  /** Bilinear u,v (m/s) from the byte grid at a geographic position. */
  private sample(lon: number, lat: number): [number, number] {
    const meta = this.meta
    const frame = this.frame
    if (!meta || !frame) return [0, 0]
    // Wrap longitude into grid space; clamp latitude.
    let x = (((lon - meta.lon0) % 360) + 360) % 360
    let y = (meta.lat0 - lat) / meta.step
    x /= meta.step
    y = Math.max(0, Math.min(meta.height - 1.001, y))
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const x1 = (x0 + 1) % meta.width
    const y1 = Math.min(y0 + 1, meta.height - 1)
    const dq = (b: number, min: number, max: number): number =>
      min + (b / 255) * (max - min)
    const at = (col: number, row: number): [number, number] => {
      const p = (row * meta.width + col) * 2
      return [dq(frame[p], meta.uMin, meta.uMax), dq(frame[p + 1], meta.vMin, meta.vMax)]
    }
    const [u00, v00] = at(x0, y0)
    const [u10, v10] = at(x1, y0)
    const [u01, v01] = at(x0, y1)
    const [u11, v11] = at(x1, y1)
    const u = (u00 * (1 - fx) + u10 * fx) * (1 - fy) + (u01 * (1 - fx) + u11 * fx) * fy
    const v = (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy
    return [u, v]
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop)
    if (!this.meta || !this.frame) return

    const ctx = this.ctx
    // Age the trails: keep FADE_ALPHA of existing paint.
    ctx.globalCompositeOperation = 'destination-in'
    ctx.fillStyle = `rgba(0,0,0,${FADE_ALPHA})`
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.globalCompositeOperation = 'source-over'
    ctx.lineWidth = LINE_WIDTH
    ctx.lineCap = 'round'

    const center = this.map.getCenter()
    const metersPerPixel =
      (156543.03 * Math.cos((center.lat * Math.PI) / 180)) /
      Math.pow(2, this.map.getZoom())
    // Seconds of wind advection per animation frame to hit the target speed.
    const dt = (TARGET_PX_PER_FRAME_AT_8MS * metersPerPixel) / 8

    const target = this.particleTarget()
    if (this.particles.length > target) this.particles.length = target
    while (this.particles.length < target)
      this.particles.push(this.randomInView())

    for (const p of this.particles) {
      const [u, v] = this.sample(p.lon, p.lat)
      const speed = Math.hypot(u, v)
      p.age += 1
      if (p.age > MAX_AGE_FRAMES || speed < 0.3) {
        Object.assign(p, this.randomInView(), { age: 0 })
        continue
      }
      const from = this.map.project([p.lon, p.lat])
      const latRad = (p.lat * Math.PI) / 180
      p.lat += (v * dt) / 111320
      p.lon += (u * dt) / (111320 * Math.max(0.1, Math.cos(latRad)))
      p.lat = Math.max(-89.9, Math.min(89.9, p.lat))
      const to = this.map.project([p.lon, p.lat])
      // Skip segments that jump across the screen (antimeridian wrap, globe
      // horizon) and ones fully off-canvas.
      const dx = to.x - from.x
      const dy = to.y - from.y
      if (dx * dx + dy * dy > 400) {
        Object.assign(p, this.randomInView(), { age: 0 })
        continue
      }
      if (
        (from.x < 0 && to.x < 0) ||
        (from.y < 0 && to.y < 0) ||
        (from.x > this.canvas.width && to.x > this.canvas.width) ||
        (from.y > this.canvas.height && to.y > this.canvas.height)
      )
        continue
      ctx.strokeStyle = speedColor(speed)
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    }
  }
}
