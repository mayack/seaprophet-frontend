'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { usePathname } from 'next/navigation'
import type { DialogRoot } from '@base-ui/react/dialog'
import { Search, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getHotkeyModifier, isEditableTarget } from '@/lib/hotkeys'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { useSpotNavigation } from '@/hooks/useSpotNavigation'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import {
  type SearchResultSpot,
  type SpotSearchRow,
  useSpotSearch,
} from './useSpotSearch'
import { cn } from '@/lib/utils'

/** Ignore sloppy touch outside-press that fires on the same tap as open. */
const OPEN_DISMISS_GRACE_MS = 500

/** Mobile dialog gap from the screen edge — equal on top/left/right (px). */
const MOBILE_DIALOG_INSET = 16

interface SearchSpotsProps {
  placeholder?: string
}

function SpotSearchCommand({
  inputRef,
  placeholder,
  query,
  onInputValueChange,
  rows,
  isLoading,
  error,
  spotCount,
  onSelect,
  isMobile,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  placeholder: string
  query: string
  onInputValueChange: (value: string) => void
  rows: SpotSearchRow[]
  isLoading: boolean
  error: string | null
  spotCount: number | null
  onSelect: (spot: SearchResultSpot) => void
  isMobile: boolean
}): React.JSX.Element {
  const hasQuery = query.trim().length > 0
  const emptyPrompt =
    spotCount !== null
      ? `${spotCount.toLocaleString()} spots available`
      : 'Start typing to search spots'

  return (
    <Command
      shouldFilter={false}
      className={isMobile ? 'h-auto w-full' : undefined}
    >
      <CommandInput
        ref={inputRef}
        placeholder={placeholder}
        value={query}
        onValueChange={onInputValueChange}
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
      />
      <CommandList
        className={
          isMobile && hasQuery
            ? 'max-h-[calc(var(--search-dialog-max)-2.5rem)]'
            : undefined
        }
      >
        <CommandEmpty className="text-muted-foreground">
          {hasQuery
            ? isLoading
              ? 'Searching...'
              : (error ?? 'No spots found')
            : emptyPrompt}
        </CommandEmpty>
        <CommandGroup>
          {rows.map((row) => {
            if (row.kind === 'header') {
              return (
                <div
                  key={row.key}
                  role="presentation"
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground',
                    // small breathing room above every country block
                    row.level === 'country' && 'mt-2 font-semibold text-foreground'
                  )}
                >
                  {row.emoji && <span aria-hidden>{row.emoji}</span>}
                  {row.label}
                </div>
              )
            }
            return (
              <CommandItem
                key={row.key}
                value={`${row.item.id}-${row.item.name}`}
                onSelect={() => onSelect(row.item)}
              >
                {row.item.name}
                {row.item.webcam && (
                  <CommandShortcut>
                    <Video strokeWidth={1.5} />
                  </CommandShortcut>
                )}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

export function SearchSpots({
  placeholder = 'Search spots...',
}: SearchSpotsProps): React.JSX.Element {
  const pathname = usePathname()
  const isDesktop = useIsDesktop()
  const { openSpot } = useSpotNavigation()
  const [open, setOpen] = useState(false)
  const [hotkeyModifier] = useState(getHotkeyModifier)
  const searchTriggerRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const openedAtRef = useRef(0)
  const {
    query,
    onInputValueChange,
    rows,
    isLoading,
    error,
    spotCount,
    clearSearch,
  } = useSpotSearch()

  const [prevPathname, setPrevPathname] = useState(pathname)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    setOpen(false)
    clearSearch()
  }

  // On mobile, pin the dialog to the top with equal top/left/right insets.
  // Height wraps the search input until there is a query, then grows with
  // results up to the space above the keyboard (visual viewport).
  const viewport = useVisualViewport(open && !isDesktop)
  const mobileAvailableHeight = viewport
    ? viewport.height - MOBILE_DIALOG_INSET * 2
    : null
  const mobileContentStyle:
    | (React.CSSProperties & {
        '--search-dialog-max'?: string
      })
    | undefined =
    !isDesktop && viewport && mobileAvailableHeight !== null
      ? {
          top: viewport.offsetTop + MOBILE_DIALOG_INSET,
          left: MOBILE_DIALOG_INSET,
          right: MOBILE_DIALOG_INSET,
          width: 'auto',
          maxWidth: 'none',
          height: 'auto',
          maxHeight: mobileAvailableHeight,
          '--search-dialog-max': `${mobileAvailableHeight}px`,
          // Tailwind v4 centers via the `translate` property (not `transform`),
          // so clear that to cancel the base `-translate-x/y-1/2`.
          translate: 'none',
          transform: 'none',
        }
      : undefined

  const openSearch = useCallback((fromTouch = false): void => {
    openedAtRef.current = Date.now()
    if (fromTouch) {
      flushSync(() => setOpen(true))
      searchInputRef.current?.focus({ preventScroll: true })
      return
    }
    setOpen(true)
  }, [])

  // Touch screens: open synchronously on touchend so outside-press dismiss does
  // not race the open state (see OPEN_DISMISS_GRACE_MS). preventDefault blocks
  // the synthetic click. Mouse pointers at mobile widths rely on onClick above.
  useEffect(() => {
    if (isDesktop) return undefined

    const trigger = searchTriggerRef.current
    if (!trigger) return undefined

    const onTouchEnd = (event: TouchEvent): void => {
      event.preventDefault()
      openSearch(true)
    }

    trigger.addEventListener('touchend', onTouchEnd, { passive: false })
    return (): void => trigger.removeEventListener('touchend', onTouchEnd)
  }, [isDesktop, openSearch])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== 'k') return
      if (!event.metaKey && !event.ctrlKey) return
      if (isEditableTarget(event.target)) return

      event.preventDefault()
      openSearch()
      requestAnimationFrame(() =>
        searchInputRef.current?.focus({ preventScroll: true })
      )
    }

    window.addEventListener('keydown', onKeyDown)
    return (): void => window.removeEventListener('keydown', onKeyDown)
  }, [openSearch])

  const handleOpenChange = useCallback(
    (next: boolean, eventDetails: DialogRoot.ChangeEventDetails): void => {
      if (
        !next &&
        (eventDetails.reason === 'outside-press' ||
          eventDetails.reason === 'focus-out') &&
        Date.now() - openedAtRef.current < OPEN_DISMISS_GRACE_MS
      ) {
        eventDetails.cancel()
        return
      }

      setOpen(next)
      if (!next) clearSearch()
    },
    [clearSearch]
  )

  const handleSelect = useCallback(
    (spot: SearchResultSpot): void => {
      openSpot({
        id: spot.id,
        lng: spot.location.long,
        lat: spot.location.lat,
        name: spot.name,
      })
      clearSearch()
      setOpen(false)
    },
    [openSpot, clearSearch]
  )

  const searchTrigger = (
    <Button
      ref={searchTriggerRef}
      variant="elevated"
      size="icon-circle"
      onClick={() => openSearch()}
      aria-label="Search spots"
      aria-expanded={open}
    >
      <Search />
    </Button>
  )

  return (
    <>
      <Tooltip>
        <TooltipTrigger render={searchTrigger} />
        <TooltipContent side="right" sideOffset={12}>
          Search spots
          {isDesktop && (
            <KbdGroup>
              <Kbd>{hotkeyModifier}</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          )}
        </TooltipContent>
      </Tooltip>
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Search spots"
        description="Search for a surf spot by name"
        showCloseButton
        closeButtonClassName="top-2 right-2 text-muted-foreground"
        initialFocus={searchInputRef}
        contentStyle={mobileContentStyle}
        className={cn(
          !isDesktop ? 'h-auto auto-rows-min' : undefined,
          'rounded-2xl!'
        )}
      >
        <SpotSearchCommand
          inputRef={searchInputRef}
          placeholder={placeholder}
          query={query}
          onInputValueChange={onInputValueChange}
          rows={rows}
          isLoading={isLoading}
          error={error}
          spotCount={spotCount}
          onSelect={handleSelect}
          isMobile={!isDesktop}
        />
      </CommandDialog>
    </>
  )
}
