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
import { type SearchResultSpot, useSpotSearch } from './useSpotSearch'

/** Ignore sloppy touch outside-press that fires on the same tap as open. */
const OPEN_DISMISS_GRACE_MS = 500

interface SearchSpotsProps {
  placeholder?: string
}

function SpotSearchCommand({
  inputRef,
  placeholder,
  query,
  onInputValueChange,
  groupedItems,
  showGroupLabels,
  isLoading,
  error,
  onSelect,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  placeholder: string
  query: string
  onInputValueChange: (value: string) => void
  groupedItems: ReturnType<typeof useSpotSearch>['groupedItems']
  showGroupLabels: boolean
  isLoading: boolean
  error: string | null
  onSelect: (spot: SearchResultSpot) => void
}): React.JSX.Element {
  return (
    <Command shouldFilter={false}>
      <CommandInput
        ref={inputRef}
        placeholder={placeholder}
        value={query}
        onValueChange={onInputValueChange}
        className="text-base md:text-sm"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
      />
      <CommandList>
        <CommandEmpty>
          {query.trim() &&
            (isLoading ? 'Searching...' : (error ?? 'No spots found'))}
        </CommandEmpty>
        {groupedItems.map((group) => (
          <CommandGroup
            key={group.value}
            heading={showGroupLabels && group.label ? group.label : undefined}
          >
            {group.items.map((spot) => (
              <CommandItem
                key={spot.id}
                value={`${spot.id}-${spot.name}`}
                onSelect={() => onSelect(spot)}
              >
                {spot.name}
                {spot.webcam && (
                  <CommandShortcut>
                    <Video />
                  </CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
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
    groupedItems,
    showGroupLabels,
    isLoading,
    error,
    clearSearch,
  } = useSpotSearch()

  const [prevPathname, setPrevPathname] = useState(pathname)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    setOpen(false)
    clearSearch()
  }

  const openSearch = useCallback((fromTouch = false): void => {
    openedAtRef.current = Date.now()
    if (fromTouch) {
      flushSync(() => setOpen(true))
      searchInputRef.current?.focus({ preventScroll: true })
      return
    }
    setOpen(true)
  }, [])

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
      onClick={isDesktop ? () => openSearch() : undefined}
      aria-label="Search spots"
      aria-expanded={open}
    >
      <Search />
    </Button>
  )

  return (
    <>
      {isDesktop ? (
        <Tooltip>
          <TooltipTrigger render={searchTrigger} />
          <TooltipContent side="right" sideOffset={12}>
            Search spots
            <KbdGroup>
              <Kbd>{hotkeyModifier}</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </TooltipContent>
        </Tooltip>
      ) : (
        searchTrigger
      )}
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Search spots"
        description="Search for a surf spot by name"
        showCloseButton
        initialFocus={searchInputRef}
      >
        <SpotSearchCommand
          inputRef={searchInputRef}
          placeholder={placeholder}
          query={query}
          onInputValueChange={onInputValueChange}
          groupedItems={groupedItems}
          showGroupLabels={showGroupLabels}
          isLoading={isLoading}
          error={error}
          onSelect={handleSelect}
        />
      </CommandDialog>
    </>
  )
}
