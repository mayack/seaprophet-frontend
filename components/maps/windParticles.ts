import type mapboxgl from 'mapbox-gl'
import type { WindFieldMeta } from './windData'

/**
 * Windy-style animated wind particles as a Canvas2D overlay.
 *
 * Particles live in GEOGRAPHIC space (lon/lat) and are advected by the wind
 * field each animation frame, then projected through `map.project`, so they
 * track pans/zooms and work under any projection — including globe, which
 * killed the Mapbox raster-particle attempt.
 *
 * Each particle draws a short tail from its own recent positions, and the
 * canvas is cleared and redrawn from scratch every frame. This replaced the
 * classic "fade the whole canvas a little each frame" trick, which can't be
 * made clean on an 8-bit canvas: once a pixel's alpha drops to ~7/255,
 * keeping 93% of it rounds straight back up, so every path a particle ever
 * took stayed behind at ~3% opacity and built up into scratch-like streaks.
 * It also smeared on pan/zoom, because the painted history was in screen
 * space. Tails are stored in geographic space instead, so they re-project
 * with the map and leave nothing behind.
 *
 * Canvas2D over WebGL is deliberate: a few thousand short polylines per frame
 * is trivial for 2D canvas, there's no GL state to fight Mapbox over, and the
 * whole engine stays debuggable. Segments are batched by colour and fade
 * level, so a frame is a few dozen strokes, not thousands.
 */

const LINE_WIDTH = 1.1
// Tail: one stored position every TRAIL_STEP frames, TRAIL_POINTS of them, so
// a tail spans ~TRAIL_POINTS × TRAIL_STEP frames of travel (about as long as
// the old fading trails looked).
const TRAIL_POINTS = 10
const TRAIL_STEP = 2
// While the camera is moving, every frame would re-project every tail point.
// Only the newest few are re-projected and drawn then; the full tail comes
// back on the first frame after the move.
const MOVING_TRAIL_POINTS = 3
// Lifetime in frames, randomised per particle so respawns don't pulse.
const MIN_LIFE_FRAMES = 60
const MAX_LIFE_FRAMES = 120
// Fade a particle in after it spawns and out before it dies, so neither pops.
const FADE_IN_FRAMES = 8
const FADE_OUT_FRAMES = 15
// Alpha is quantised into this many levels to batch strokes.
const ALPHA_LEVELS = 6
// Target on-screen speed: a fresh ~8 m/s breeze moves ~1.4 px/frame. The
// geographic step per frame is derived from this against the current
// meters-per-pixel, so motion feels equally alive at every zoom.
const TARGET_PX_PER_FRAME_AT_8MS = 1.4
// Below this the field is dead (or a land grid point) and a particle would sit
// still forever, so it respawns. Kept very low on purpose: the source field is
// 1°, and a higher threshold evacuates whole light-wind regions — the calm SE
// corner of Biscay used to render as blank ocean with a hard edge at the coast.
const DEAD_AIR_MS = 0.05
// A 1 m/s particle advances 0.18 px/frame, so an honest tail in calm air is
// a couple of pixels long and invisible against a dark basemap. Tails shorter
// than this are drawn as a dash of this length along the flow; the colour
// ramp still reports the true speed.
const MIN_TAIL_PX = 2
// A single frame's step longer than this is a wrap (antimeridian, globe
// horizon), not motion: respawn rather than draw a line across the screen.
const MAX_STEP_PX = 20
// One particle per this many CSS px² of canvas (≈260 on a 1440×900 viewport).
const PX_PER_PARTICLE = 5000
const MAX_PARTICLES = 6000
// Device-pixel ratio is capped: 3× phones would quadruple fill cost for no
// visible gain on 1px lines.
const MAX_DPR = 2

// Same hue progression as the Windy/Mapbox ramp, keyed by speed (m/s):
// [min speed, r, g, b, alpha at the head of the tail].
const COLOR_STOPS: Array<[number, number, number, number, number]> = [
  [0, 134, 163, 171, 0.85],
  [4, 110, 143, 208, 0.9],
  [7, 15, 147, 167, 0.9],
  [10, 57, 163, 57, 0.9],
  [13, 194, 134, 62, 0.95],
  [16, 200, 66, 13, 0.95],
  [20, 210, 0, 50, 1],
  [24, 175, 80, 136, 1],
  [28, 117, 74, 147, 1],
]

// strokeStyle per (colour, alpha level), built once.
const BUCKET_STYLES: string[] = COLOR_STOPS.flatMap(([, r, g, b, a]) =>
  Array.from(
    { length: ALPHA_LEVELS },
    (_, level) =>
      `rgba(${r},${g},${b},${((a * (level + 1)) / ALPHA_LEVELS).toFixed(3)})`
  )
)

function colorIndex(speed: number): number {
  for (let i = COLOR_STOPS.length - 1; i >= 0; i--) {
    if (speed >= COLOR_STOPS[i][0]) return i
  }
  return 0
}

interface Particle {
  lon: number
  lat: number
  age: number
  life: number
  color: number
  // Tail ring buffer: geographic positions plus their projected screen
  // positions, valid for the camera `epoch` they were projected in.
  tLon: Float64Array
  tLat: Float64Array
  tX: Float32Array
  tY: Float32Array
  count: number
  head: number // index of the newest stored point
  epoch: number
  // Current position on screen (projected in camera `xEpoch`), and the last
  // step's screen direction.
  x: number
  y: number
  xEpoch: number
  dx: number
  dy: number
}

export class WindParticleEngine {
  private map: mapboxgl.Map
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private meta: WindFieldMeta | null = null
  private frame: Uint8Array | null = null
  // Cross-fade state: while blending, samples lerp prevFrame -> frame so a
  // timeline step reshapes the flow smoothly instead of snapping.
  private prevFrame: Uint8Array | null = null
  private blendStart = 0
  private blendDuration = 0
  private particles: Particle[] = []
  private raf = 0
  private width = 0 // CSS px
  private height = 0
  // Bumped on every camera change; cached tail projections from an older
  // epoch are stale.
  private epoch = 0
  private moving = false
  // Segment buffers per (colour, alpha level): x0,y0,x1,y1 runs.
  private buckets: number[][] = BUCKET_STYLES.map(() => [])
  private resizeHandler = (): void => this.resize()
  private moveStartHandler = (): void => {
    this.moving = true
  }
  private moveHandler = (): void => {
    this.epoch++
  }
  private moveEndHandler = (): void => {
    this.moving = false
    this.epoch++
  }

  constructor(map: mapboxgl.Map) {
    this.map = map
    this.canvas = document.createElement('canvas')
    // No z-index: appended last inside the map container it paints above the
    // GL canvas by DOM order, while the app's positioned UI overlays (buttons,
    // scrubber pill), which come later in the DOM, still paint above it.
    this.canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;'
    map.getContainer().appendChild(this.canvas)
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('2d canvas unavailable')
    this.ctx = ctx
    this.resize()
    map.on('resize', this.resizeHandler)
    map.on('movestart', this.moveStartHandler)
    map.on('move', this.moveHandler)
    map.on('moveend', this.moveEndHandler)
    this.loop()
  }

  setField(meta: WindFieldMeta, frame: Uint8Array): void {
    this.meta = meta
    this.frame = frame
    if (this.particles.length === 0) this.seed()
  }

  setFrame(frame: Uint8Array, transitionMs = 0): void {
    if (transitionMs > 0 && this.frame && this.frame !== frame) {
      this.prevFrame = this.frame
      this.blendStart = performance.now()
      this.blendDuration = transitionMs
    } else {
      this.prevFrame = null
    }
    this.frame = frame
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    this.map.off('resize', this.resizeHandler)
    this.map.off('movestart', this.moveStartHandler)
    this.map.off('move', this.moveHandler)
    this.map.off('moveend', this.moveEndHandler)
    this.canvas.remove()
  }

  /** Size the backing store at device resolution so 1px lines stay crisp. */
  private resize(): void {
    const { clientWidth, clientHeight } = this.map.getContainer()
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    this.width = clientWidth
    this.height = clientHeight
    this.canvas.width = Math.round(clientWidth * dpr)
    this.canvas.height = Math.round(clientHeight * dpr)
    // Draw in CSS px; the transform scales to device px.
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.epoch++
    this.seed()
  }

  private particleTarget(): number {
    return Math.min(
      MAX_PARTICLES,
      Math.round((this.width * this.height) / PX_PER_PARTICLE)
    )
  }

  private newParticle(): Particle {
    const p: Particle = {
      lon: 0,
      lat: 0,
      age: 0,
      life: 0,
      color: 0,
      tLon: new Float64Array(TRAIL_POINTS),
      tLat: new Float64Array(TRAIL_POINTS),
      tX: new Float32Array(TRAIL_POINTS),
      tY: new Float32Array(TRAIL_POINTS),
      count: 0,
      head: -1,
      epoch: this.epoch,
      x: 0,
      y: 0,
      xEpoch: this.epoch,
      dx: 0,
      dy: 0,
    }
    this.respawn(p)
    // Stagger ages at seed so the first wave doesn't die all at once.
    p.age = Math.floor(Math.random() * p.life * 0.5)
    return p
  }

  /** Move a particle to a random point in view with a fresh, empty tail. */
  private respawn(p: Particle): void {
    const bounds = this.map.getBounds()
    if (bounds) {
      const sw = bounds.getSouthWest()
      const ne = bounds.getNorthEast()
      p.lon = sw.lng + Math.random() * (ne.lng - sw.lng)
      p.lat = sw.lat + Math.random() * (ne.lat - sw.lat)
    }
    p.age = 0
    p.life =
      MIN_LIFE_FRAMES +
      Math.floor(Math.random() * (MAX_LIFE_FRAMES - MIN_LIFE_FRAMES))
    p.count = 0
    p.head = -1
    p.epoch = this.epoch
    const pt = this.map.project([p.lon, p.lat])
    p.x = pt.x
    p.y = pt.y
    p.xEpoch = this.epoch
    p.dx = 0
    p.dy = 0
  }

  private seed(): void {
    const n = this.particleTarget()
    this.particles = Array.from({ length: n }, () => this.newParticle())
  }

  /** 0..1 progress of the current cross-fade (1 = fully on new frame). */
  private blendT(): number {
    if (!this.prevFrame) return 1
    const t = (performance.now() - this.blendStart) / this.blendDuration
    if (t >= 1) {
      this.prevFrame = null
      return 1
    }
    return t
  }

  /** Bilinear u,v (m/s) from one byte grid at a geographic position. */
  private sampleFrame(
    frame: Uint8Array,
    lon: number,
    lat: number
  ): [number, number] {
    const meta = this.meta
    if (!meta) return [0, 0]
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
      return [
        dq(frame[p], meta.uMin, meta.uMax),
        dq(frame[p + 1], meta.vMin, meta.vMax),
      ]
    }
    const [u00, v00] = at(x0, y0)
    const [u10, v10] = at(x1, y0)
    const [u01, v01] = at(x0, y1)
    const [u11, v11] = at(x1, y1)
    const u =
      (u00 * (1 - fx) + u10 * fx) * (1 - fy) + (u01 * (1 - fx) + u11 * fx) * fy
    const v =
      (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy
    return [u, v]
  }

  /** Time-blended sample across the cross-fade, if one is running. */
  private sample(lon: number, lat: number, t: number): [number, number] {
    if (!this.frame) return [0, 0]
    const [u1, v1] = this.sampleFrame(this.frame, lon, lat)
    if (t >= 1 || !this.prevFrame) return [u1, v1]
    const [u0, v0] = this.sampleFrame(this.prevFrame, lon, lat)
    return [u0 + (u1 - u0) * t, v0 + (v1 - v0) * t]
  }

  /** Advance one particle by one frame. False if it had to respawn. */
  private advance(p: Particle, dt: number, blend: number): boolean {
    const [u, v] = this.sample(p.lon, p.lat, blend)
    const speed = Math.hypot(u, v)
    p.age += 1
    if (p.age > p.life || speed < DEAD_AIR_MS) {
      this.respawn(p)
      return false
    }
    // Last frame's screen position is only comparable if it was projected
    // under the current camera; after a pan/zoom, re-project it first.
    if (p.xEpoch !== this.epoch) {
      const pt = this.map.project([p.lon, p.lat])
      p.x = pt.x
      p.y = pt.y
    }
    const latRad = (p.lat * Math.PI) / 180
    p.lat += (v * dt) / 111320
    p.lon += (u * dt) / (111320 * Math.max(0.1, Math.cos(latRad)))
    p.lat = Math.max(-89.9, Math.min(89.9, p.lat))
    p.color = colorIndex(speed)

    const to = this.map.project([p.lon, p.lat])
    const dx = to.x - p.x
    const dy = to.y - p.y
    if (dx * dx + dy * dy > MAX_STEP_PX * MAX_STEP_PX) {
      this.respawn(p)
      return false
    }
    p.xEpoch = this.epoch
    p.dx = dx
    p.dy = dy
    p.x = to.x
    p.y = to.y

    // Store a tail point every TRAIL_STEP frames.
    if (p.age % TRAIL_STEP === 0) {
      p.head = (p.head + 1) % TRAIL_POINTS
      p.tLon[p.head] = p.lon
      p.tLat[p.head] = p.lat
      p.tX[p.head] = p.x
      p.tY[p.head] = p.y
      p.count = Math.min(p.count + 1, TRAIL_POINTS)
    }
    return true
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop)
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)
    if (!this.meta || !this.frame) return

    const center = this.map.getCenter()
    const metersPerPixel =
      (156543.03 * Math.cos((center.lat * Math.PI) / 180)) /
      Math.pow(2, this.map.getZoom())
    // Seconds of wind advection per animation frame to hit the target speed.
    const dt = (TARGET_PX_PER_FRAME_AT_8MS * metersPerPixel) / 8

    const target = this.particleTarget()
    if (this.particles.length > target) this.particles.length = target
    while (this.particles.length < target)
      this.particles.push(this.newParticle())

    for (const bucket of this.buckets) bucket.length = 0
    const blend = this.blendT()
    for (const p of this.particles) {
      if (!this.advance(p, dt, blend)) continue
      this.collectTail(p)
    }

    ctx.lineWidth = LINE_WIDTH
    ctx.lineCap = 'round'
    for (let b = 0; b < this.buckets.length; b++) {
      const seg = this.buckets[b]
      if (seg.length === 0) continue
      ctx.strokeStyle = BUCKET_STYLES[b]
      ctx.beginPath()
      for (let i = 0; i < seg.length; i += 4) {
        ctx.moveTo(seg[i], seg[i + 1])
        ctx.lineTo(seg[i + 2], seg[i + 3])
      }
      ctx.stroke()
    }
  }

  /** Queue a particle's tail segments into the colour/alpha buckets. */
  private collectTail(p: Particle): void {
    // Fade in after spawn, out before death.
    const life = Math.min(
      1,
      p.age / FADE_IN_FRAMES,
      (p.life - p.age) / FADE_OUT_FRAMES
    )
    if (life <= 0) return

    // Re-project cached tail points when the camera changed. While moving,
    // only the newest few (and they're the only ones drawn), to bound cost.
    const shown = this.moving ? Math.min(p.count, MOVING_TRAIL_POINTS) : p.count
    if (p.epoch !== this.epoch) {
      for (let k = 0; k < shown; k++) {
        const i = (p.head - k + TRAIL_POINTS) % TRAIL_POINTS
        const pt = this.map.project([p.tLon[i], p.tLat[i]])
        p.tX[i] = pt.x
        p.tY[i] = pt.y
      }
      if (!this.moving) p.epoch = this.epoch
    }

    const segments = shown // head→newest stored, then between stored points
    const colorBase = p.color * ALPHA_LEVELS
    let prevX = p.x
    let prevY = p.y
    let tailLen = 0
    for (let k = 0; k < shown; k++) {
      const i = (p.head - k + TRAIL_POINTS) % TRAIL_POINTS
      const x = p.tX[i]
      const y = p.tY[i]
      const dx = x - prevX
      const dy = y - prevY
      const len2 = dx * dx + dy * dy
      // A long hop between stored points is a wrap, not motion.
      if (len2 > MAX_STEP_PX * MAX_STEP_PX * TRAIL_STEP * TRAIL_STEP) break
      if (len2 > 0) {
        tailLen += Math.sqrt(len2)
        // Newest segment brightest, fading towards the end of the tail.
        const fade = (1 - k / (segments + 1)) * life
        this.queue(colorBase, fade, prevX, prevY, x, y)
      }
      prevX = x
      prevY = y
    }

    // Calm air: an honest tail is too short to see, so draw a dash along the
    // flow instead.
    if (tailLen < MIN_TAIL_PX) {
      const stepLen = Math.hypot(p.dx, p.dy)
      if (stepLen > 0) {
        const s = MIN_TAIL_PX / stepLen
        this.queue(colorBase, life, p.x, p.y, p.x - p.dx * s, p.y - p.dy * s)
      }
    }
  }

  private queue(
    colorBase: number,
    fade: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): void {
    if (
      (x0 < 0 && x1 < 0) ||
      (y0 < 0 && y1 < 0) ||
      (x0 > this.width && x1 > this.width) ||
      (y0 > this.height && y1 > this.height)
    )
      return
    const level = Math.ceil(fade * ALPHA_LEVELS) - 1
    if (level < 0) return
    this.buckets[colorBase + Math.min(level, ALPHA_LEVELS - 1)].push(
      x0,
      y0,
      x1,
      y1
    )
  }
}
