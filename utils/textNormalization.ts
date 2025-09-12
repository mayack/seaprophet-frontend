/**
 * Utility functions for normalizing text to handle different languages and diacritics
 */

/**
 * Removes diacritics and normalizes text for search purposes
 * Converts characters like á, ã, ç, etc. to their base forms (a, a, c, etc.)
 */
export function normalizeForSearch(text: string): string {
  if (!text) return ''

  return text
    .normalize('NFD') // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .toLowerCase()
    .trim()
}

/**
 * Checks if a search query matches text with diacritics-insensitive comparison
 */
export function matchesSearch(text: string, query: string): boolean {
  if (!text || !query) return false

  const normalizedText = normalizeForSearch(text)
  const normalizedQuery = normalizeForSearch(query)

  return normalizedText.includes(normalizedQuery)
}

/**
 * Creates multiple search variations of a query to catch different spellings
 * This helps with Portuguese characters like ã → a, ç → c, etc.
 */
export function createSearchVariations(query: string): string[] {
  // Kept for backward compatibility; simplified to normalized-only variant
  if (!query) return []
  const normalized = normalizeForSearch(query)
  const trimmed = query.toLowerCase().trim()
  return Array.from(new Set([trimmed, normalized])).filter((v) => v.length > 0)
}

/**
 * Extract meaningful search terms from a query for broader database searching
 * Splits the query into words and filters out very short terms
 */
export function extractSearchTerms(query: string): string[] {
  // Simplified: return normalized words of length >= 2
  if (!query) return []
  return normalizeForSearch(query)
    .split(/\s+/)
    .filter((word) => word.length >= 2)
}

/**
 * Create broader search patterns to catch diacritics variations
 * For each ASCII letter, this creates patterns that might match diacritics
 */
export function createBroadSearchTerms(query: string): string[] {
  if (!query) return []
  const terms = new Set<string>()

  const normalizedQuery = normalizeForSearch(query)
  const originalLower = query.toLowerCase().trim()

  // Always include normalized + original lowercase
  if (originalLower) terms.add(originalLower)
  if (normalizedQuery) terms.add(normalizedQuery)

  // Add split words (normalized, length >= 2)
  extractSearchTerms(query).forEach((word) => terms.add(word))

  // Limited diacritic expansions aimed at Portuguese/Spanish common cases
  const diacriticMap: Record<string, string[]> = {
    a: ['á', 'à', 'â', 'ã', 'ä'],
    e: ['é', 'è', 'ê', 'ë'],
    i: ['í', 'ì', 'î', 'ï'],
    o: ['ó', 'ò', 'ô', 'õ', 'ö'],
    u: ['ú', 'ù', 'û', 'ü'],
    c: ['ç'],
    n: ['ñ'],
  }

  const base = originalLower
  if (base.length >= 2 && base.length <= 24) {
    Object.entries(diacriticMap).forEach(([ascii, diacritics]) => {
      if (!base.includes(ascii)) return
      diacritics.forEach((d) => {
        // Replace all occurrences
        const all = base.replace(new RegExp(ascii, 'g'), d)
        if (all !== base) terms.add(all)
        // Replace first occurrence only
        const first = base.replace(ascii, d)
        if (first !== base) terms.add(first)
      })
    })
  }

  return Array.from(terms)
}
