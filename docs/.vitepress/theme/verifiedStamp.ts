export interface TimestampedPageData {
  lastUpdated?: number
  verifiedStamp?: string
}

const DATE_ONLY_TZ_RE = /^\d{4}-\d{2}-\d{2}(?:\s+[A-Z]{2,5})?$/i

export function formatPacificTimestamp(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).formatToParts(new Date(ms))

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} ${get('timeZoneName')}`
}

export function resolveVerifiedStamp(
  explicit?: string,
  pageData?: TimestampedPageData,
  fallback = '2026-11-19 22:12 PST'
): string {
  const buildStamp =
    pageData?.verifiedStamp ||
    (typeof pageData?.lastUpdated === 'number' && Number.isFinite(pageData.lastUpdated)
      ? formatPacificTimestamp(pageData.lastUpdated)
      : fallback)

  const trimmed = explicit?.trim()
  if (!trimmed || DATE_ONLY_TZ_RE.test(trimmed)) {
    return buildStamp
  }
  return trimmed
}
