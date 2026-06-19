export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('input, textarea, select, [contenteditable="true"]') !== null
  )
}

export function getHotkeyModifier(): string {
  if (typeof navigator === 'undefined') return 'Ctrl'
  return /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘' : 'Ctrl'
}
