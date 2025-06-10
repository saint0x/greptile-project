import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  fetchRepositories, 
  syncRepositories, 
  fetchBranches, 
  getRepository 
} from "@/lib/api"
import type { Repository, Branch } from "@/types/changelog"

/**
 * Hook for fetching repositories with caching
 */
export function useRepositories() {
  return useQuery<Repository[], Error>({
    queryKey: ["repositories"],
    queryFn: fetchRepositories,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook for syncing repositories from GitHub
 */
export function useSyncRepositories() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: syncRepositories,
    onSuccess: () => {
      // Invalidate repositories query to refetch
      queryClient.invalidateQueries({ queryKey: ["repositories"] })
    },
  })
}

/**
 * Hook for fetching a specific repository
 */
export function useRepository(repositoryId: string) {
  return useQuery<Repository, Error>({
    queryKey: ["repository", repositoryId],
    queryFn: () => getRepository(repositoryId),
    enabled: Boolean(repositoryId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook for fetching repository branches
 */
export function useBranches(repositoryId: string) {
  return useQuery<Branch[], Error>({
    queryKey: ["branches", repositoryId],
    queryFn: () => fetchBranches(repositoryId),
    enabled: Boolean(repositoryId),
    staleTime: 2 * 60 * 1000, // 2 minutes (branches change more frequently)
    refetchOnWindowFocus: false,
  })
} 