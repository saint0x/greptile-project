import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  fetchChangelogs,
  createChangelog,
  getChangelog,
  updateChangelog,
  deleteChangelog,
  publishChangelog,
  unpublishChangelog,
  duplicateChangelog
} from "@/lib/api"
import type { 
  Changelog, 
  PaginatedResponse 
} from "@/types/changelog"

/**
 * Hook for fetching changelogs with filtering and pagination
 */
export function useChangelogs(params: {
  page?: number
  limit?: number
  status?: string
  repositoryId?: string
} = {}) {
  return useQuery<PaginatedResponse<Changelog>, Error>({
    queryKey: ["changelogs", params],
    queryFn: () => fetchChangelogs(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook for fetching a specific changelog
 */
export function useChangelog(changelogId?: string) {
  return useQuery<Changelog, Error>({
    queryKey: ["changelog", changelogId],
    queryFn: () => getChangelog(changelogId!),
    enabled: Boolean(changelogId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook for creating a new changelog
 */
export function useCreateChangelog() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (changelog: Partial<Changelog>) => createChangelog(changelog),
    onSuccess: (newChangelog) => {
      // Invalidate changelogs list
      queryClient.invalidateQueries({ queryKey: ["changelogs"] })
      // Add to individual cache
      queryClient.setQueryData(["changelog", newChangelog.id], newChangelog)
    },
  })
}

/**
 * Hook for updating a changelog
 */
export function useUpdateChangelog() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ changelogId, updates }: { 
      changelogId: string; 
      updates: Partial<Changelog> 
    }) => updateChangelog(changelogId, updates),
    onSuccess: (updatedChangelog) => {
      // Update individual cache
      queryClient.setQueryData(["changelog", updatedChangelog.id], updatedChangelog)
      // Invalidate list to update status/metadata
      queryClient.invalidateQueries({ queryKey: ["changelogs"] })
    },
  })
}

/**
 * Hook for deleting a changelog
 */
export function useDeleteChangelog() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (changelogId: string) => deleteChangelog(changelogId),
    onSuccess: (_, changelogId) => {
      // Remove from individual cache
      queryClient.removeQueries({ queryKey: ["changelog", changelogId] })
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: ["changelogs"] })
    },
  })
}

/**
 * Hook for publishing a changelog
 */
export function usePublishChangelog() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (changelogId: string) => publishChangelog(changelogId),
    onSuccess: (publishedChangelog) => {
      // Update individual cache
      queryClient.setQueryData(["changelog", publishedChangelog.id], publishedChangelog)
      // Invalidate list to update status
      queryClient.invalidateQueries({ queryKey: ["changelogs"] })
    },
  })
}

/**
 * Hook for unpublishing a changelog
 */
export function useUnpublishChangelog() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (changelogId: string) => unpublishChangelog(changelogId),
    onSuccess: (unpublishedChangelog) => {
      // Update individual cache
      queryClient.setQueryData(["changelog", unpublishedChangelog.id], unpublishedChangelog)
      // Invalidate list to update status
      queryClient.invalidateQueries({ queryKey: ["changelogs"] })
    },
  })
}

/**
 * Hook for duplicating a changelog
 */
export function useDuplicateChangelog() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (changelogId: string) => duplicateChangelog(changelogId),
    onSuccess: (duplicatedChangelog) => {
      // Invalidate changelogs list to show the new duplicate
      queryClient.invalidateQueries({ queryKey: ["changelogs"] })
      // Add to individual cache
      queryClient.setQueryData(["changelog", duplicatedChangelog.id], duplicatedChangelog)
    },
  })
}

/**
 * Hook for drafts (filtered changelogs)
 */
export function useDrafts() {
  return useChangelogs({ status: 'draft' })
}

/**
 * Hook for published changelogs
 */
export function usePublishedChangelogs() {
  return useChangelogs({ status: 'published' })
} 