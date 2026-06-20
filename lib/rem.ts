/** Convert rem to px using the document root font size. */
export function remToPx(rem: number): number {
  if (typeof window === 'undefined') return rem * 16
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return rem * root
}
