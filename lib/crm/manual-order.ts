/**
 * Orders items by a user's manual ranks. Items that were never ranked (for example new tasks)
 * stay above ranked ones so that fresh urgent work is not buried; they and rank ties use the
 * automatic order. Ranks are presentation only and never change priority or stage.
 */
export function sortWithManualOrder<T>(
  items: readonly T[],
  ranks: Readonly<Record<string, number>> | undefined,
  getId: (item: T) => string,
  automaticOrder: (a: T, b: T) => number,
): T[] {
  return [...items].sort((a, b) => {
    const rankA = ranks?.[getId(a)], rankB = ranks?.[getId(b)]
    if (rankA !== undefined && rankB !== undefined && rankA !== rankB) return rankA - rankB
    if (rankA !== undefined && rankB === undefined) return 1
    if (rankA === undefined && rankB !== undefined) return -1
    return automaticOrder(a, b)
  })
}

export function hasManualOrder(manualOrder: Readonly<Record<string, Record<string, number>>>, listKeyPrefix: string) {
  return Object.entries(manualOrder).some(([key, ranks]) => key.startsWith(listKeyPrefix) && Object.keys(ranks).length > 0)
}
