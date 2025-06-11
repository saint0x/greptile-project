import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchChangelogs, fetchChangelogDetail } from "@/lib/api"

// Query Keys
export const changelogQueryKeys = {
  all: ['changelogs'] as const,
  lists: () => [...changelogQueryKeys.all, 'list'] as const,
  list: (params: any) => [...changelogQueryKeys.lists(), params] as const,
  details: () => [...changelogQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...changelogQueryKeys.details(), id] as const,
} as const

/**
 * Hook to fetch paginated changelog list
 */
export function useChangelogs(params: {
  page?: number
  limit?: number
  sortBy?: 'publishedAt' | 'version'
  sortOrder?: 'asc' | 'desc'
} = {}) {
  return useQuery({
    queryKey: changelogQueryKeys.list(params),
    queryFn: async () => {
      const data = await fetchChangelogs(params)
      return data // data is { changelogs: [...], pagination: {...} }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook to fetch a specific changelog by ID
 */
export function useChangelogDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: changelogQueryKeys.detail(id),
    queryFn: async () => {
      const data = await fetchChangelogDetail(id)
      return data // data is { id, title, sections: [...], ... }
    },
    enabled: enabled && !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to prefetch a changelog (for hover/link prefetching)
 */
export function usePrefetchChangelog() {
  const queryClient = useQueryClient()

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: changelogQueryKeys.detail(id),
      queryFn: () => fetchChangelogDetail(id),
      staleTime: 10 * 60 * 1000,
    })
  }
} 