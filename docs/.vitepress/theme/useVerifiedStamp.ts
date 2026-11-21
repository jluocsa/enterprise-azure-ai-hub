import { computed } from 'vue'
import { useData } from 'vitepress'
import { resolveVerifiedStamp, type TimestampedPageData } from './verifiedStamp'

export function useVerifiedStamp(getExplicit?: () => string | undefined) {
  const { page } = useData()
  return computed(() =>
    resolveVerifiedStamp(getExplicit?.(), page.value as TimestampedPageData)
  )
}
