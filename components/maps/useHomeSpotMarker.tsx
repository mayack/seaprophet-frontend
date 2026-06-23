'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import mapboxgl from 'mapbox-gl'
import {
  HomeSpotIcon,
  HomeSpotPopover,
  type PopoverAnchor,
} from '@/components/common/HomeSpotPopover'
import {
  ensureHomeSpotLayer,
  updateHomeSpotPosition,
  setHomeSpotLayerVisible,
  removeHomeSpotLayer,
  HOME_SPOT_LAYER_ID,
} from './homeMarkerLayer'
import { spotPinDisplayRadiusPx } from './spotLayerIcons'

/** Edit mode bumps the drag marker a bit larger than a matching spot pin. */
const HOME_MARKER_EDIT_SCALE = 1.25
/** Extra "picked up" scale while pressing/dragging. */
const HOME_MARKER_LIFT_SCALE = 1.35
/** Grow-in starts at the resting glyph's size (= edit size ÷ EDIT_SCALE). */
const HOME_MARKER_ENTER_FROM = 1 / HOME_MARKER_EDIT_SCALE

interface UseHomeSpotMarkerOptions {
  map: mapboxgl.Map | null
  isLoaded: boolean
  /** Resolved home coordinates (stored spot or Peniche fallback). */
  longitude: number
  latitude: number
  /** Display name shown in the popover. */
  name: string
  /** True while set-home mode is active — swaps in the draggable marker. */
  isEditing: boolean
  /** Launch set-home mode from the marker's popover. */
  onRequestEdit: () => void
}

interface UseHomeSpotMarkerReturn {
  /** Latest dragged position while editing (seeded to home coords on enter). */
  editPositionRef: React.RefObject<{ lng: number; lat: number } | null>
  /** Overlay to render in the React tree: the drag marker + the popover. */
  overlay: React.ReactNode
}

/**
 * Renders the home spot as a GL symbol layer slotted beneath the user-location
 * dot and the spot/cluster layers (HTML markers can't go below the canvas).
 * While editing it swaps to a draggable HTML marker (everything else is hidden
 * then, so z-order is moot and we get native dragging). The popover is anchored
 * to the layer's projected screen position since the glyph has no DOM node.
 */
export function useHomeSpotMarker({
  map,
  isLoaded,
  longitude,
  latitude,
  name,
  isEditing,
  onRequestEdit,
}: UseHomeSpotMarkerOptions): UseHomeSpotMarkerReturn {
  const editPositionRef = useRef<{ lng: number; lat: number } | null>(null)
  const [editMarkerEl, setEditMarkerEl] = useState<HTMLDivElement | null>(null)

  const [popoverOpen, setPopoverOpen] = useState(false)
  const [popoverAnchor, setPopoverAnchor] = useState<PopoverAnchor | null>(null)

  // Current coords/edit flag in refs so map event handlers stay stable.
  const coordsRef = useRef({ longitude, latitude })
  const isEditingRef = useRef(isEditing)
  useEffect(() => {
    coordsRef.current = { longitude, latitude }
  }, [longitude, latitude])
  useEffect(() => {
    isEditingRef.current = isEditing
  }, [isEditing])

  // Create + maintain the GL layer; re-create after style reloads (theme
  // switch wipes sources/layers/images). Removed on unmount.
  useEffect(() => {
    if (!map || !isLoaded) return
    let cancelled = false

    const ensure = (): void => {
      ensureHomeSpotLayer(map, coordsRef.current)
        .then(() => {
          if (!cancelled) setHomeSpotLayerVisible(map, !isEditingRef.current)
        })
        .catch(() => {})
    }

    ensure()
    map.on('style.load', ensure)
    return (): void => {
      cancelled = true
      map.off('style.load', ensure)
      try {
        removeHomeSpotLayer(map)
      } catch {
        // map already torn down
      }
    }
  }, [map, isLoaded])

  // Move the GL glyph when the saved home coords change (e.g. after a save).
  useEffect(() => {
    if (!map || !isLoaded) return
    updateHomeSpotPosition(map, longitude, latitude)
  }, [map, isLoaded, longitude, latitude])

  // Hide the resting glyph while editing (the draggable HTML marker stands in).
  useEffect(() => {
    if (!map || !isLoaded) return
    setHomeSpotLayerVisible(map, !isEditing)
  }, [map, isLoaded, isEditing])

  // Click the glyph → open the popover, anchored above the icon's screen point.
  useEffect(() => {
    if (!map || !isLoaded) return

    const openPopover = (): void => {
      if (isEditingRef.current) return
      const rect = map.getContainer().getBoundingClientRect()
      const point = map.project([
        coordsRef.current.longitude,
        coordsRef.current.latitude,
      ])
      const radius = spotPinDisplayRadiusPx(map.getZoom())
      const x = rect.left + point.x
      const top = rect.top + point.y - radius
      setPopoverAnchor({
        getBoundingClientRect: () => new DOMRect(x, top, 0, 0),
      })
      setPopoverOpen(true)
    }
    const setPointer = (): void => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const clearPointer = (): void => {
      map.getCanvas().style.cursor = ''
    }
    const closePopover = (): void => setPopoverOpen(false)

    map.on('click', HOME_SPOT_LAYER_ID, openPopover)
    map.on('mouseenter', HOME_SPOT_LAYER_ID, setPointer)
    map.on('mouseleave', HOME_SPOT_LAYER_ID, clearPointer)
    map.on('movestart', closePopover)
    return (): void => {
      map.off('click', HOME_SPOT_LAYER_ID, openPopover)
      map.off('mouseenter', HOME_SPOT_LAYER_ID, setPointer)
      map.off('mouseleave', HOME_SPOT_LAYER_ID, clearPointer)
      map.off('movestart', closePopover)
    }
  }, [map, isLoaded])

  // Draggable HTML marker — only while editing.
  useEffect(() => {
    if (!map || !isLoaded || !isEditing) return

    const seed: [number, number] = [
      coordsRef.current.longitude,
      coordsRef.current.latitude,
    ]

    const el = document.createElement('div')
    // Cursor lives on the wrapper (full hit-box), not the SVG — the icon's
    // transparent corners don't capture pointer events, so a cursor on the SVG
    // flickers against the map as the marker moves under the pointer.
    el.style.cursor = 'grab'
    // Start at the resting glyph's size so the swap from the GL layer grows in.
    el.style.setProperty(
      '--home-marker-drag-scale',
      String(HOME_MARKER_ENTER_FROM)
    )

    // "Pick up" feedback the instant you press, before any drag movement.
    const lift = (): void => {
      el.style.cursor = 'grabbing'
      el.style.setProperty(
        '--home-marker-drag-scale',
        String(HOME_MARKER_LIFT_SCALE)
      )
    }
    const drop = (): void => {
      el.style.cursor = 'grab'
      el.style.setProperty('--home-marker-drag-scale', '1')
    }
    el.addEventListener('pointerdown', lift)
    window.addEventListener('pointerup', drop)

    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'center',
      draggable: true,
    })
      .setLngLat(seed)
      .addTo(map)
    marker.on('dragstart', lift)
    marker.on('dragend', () => {
      drop()
      const { lng, lat } = marker.getLngLat()
      editPositionRef.current = { lng, lat }
    })

    editPositionRef.current = { lng: seed[0], lat: seed[1] }
    // Sync the Mapbox-created element into React so the portal can render the
    // glyph into it; this is external-system sync, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditMarkerEl(el)

    // Grow to full edit size once the glyph has painted at its starting size
    // (two frames so the transition actually runs rather than snapping).
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.style.setProperty('--home-marker-drag-scale', '1')
      })
    })

    return (): void => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
      el.removeEventListener('pointerdown', lift)
      window.removeEventListener('pointerup', drop)
      marker.remove()
      editPositionRef.current = null
      setEditMarkerEl(null)
    }
  }, [isEditing, map, isLoaded])

  // Scale the drag marker with zoom, matching the spot-pin curve.
  useEffect(() => {
    if (!map || !editMarkerEl) return
    const applySize = (): void => {
      const diameter =
        spotPinDisplayRadiusPx(map.getZoom()) * 2 * HOME_MARKER_EDIT_SCALE
      editMarkerEl.style.setProperty('--home-marker-size', `${diameter}px`)
    }
    applySize()
    map.on('zoom', applySize)
    return (): void => {
      map.off('zoom', applySize)
    }
  }, [map, editMarkerEl])

  const overlay = (
    <>
      {editMarkerEl ? createPortal(<HomeSpotIcon />, editMarkerEl) : null}
      <HomeSpotPopover
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        anchor={popoverAnchor}
        name={name}
        onChange={onRequestEdit}
      />
    </>
  )

  return { editPositionRef, overlay }
}
