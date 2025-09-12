// Utility functions for diacritics-insensitive text handling

export function normalizeForSearch(text: string): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function matchesSearch(text: string, query: string): boolean {
  if (!text || !query) return false
  const normalizedText = normalizeForSearch(text)
  const normalizedQuery = normalizeForSearch(query)
  return normalizedText.includes(normalizedQuery)
}
