import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  generateChangelog,
  getGenerationStatus,
  retryGeneration,
  cancelGeneration,
  pollGenerationStatus,
  acceptGeneration
} from "@/lib/api"
import type { 
  ChangelogRequest, 
  ChangelogGeneration 
} from "@/types/changelog"

/**
 * Hook for starting changelog generation
 */
export function useGenerateChangelog() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (request: ChangelogRequest) => generateChangelog(request),
    onSuccess: (generation) => {
      // Add to cache for immediate status checking
      queryClient.setQueryData(["generation", generation.id], generation)
    },
  })
}

/**
 * Hook for accepting a generated changelog (creates and publishes it)
 */
export function useAcceptGeneration() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (generationId: string) => acceptGeneration(generationId),
    onSuccess: (changelog) => {

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["changelogs"] })
      queryClient.invalidateQueries({ queryKey: ["repositories"] })
    },
  })
}

/**
 * Hook for checking generation status with smart polling
 */
export function useGenerationStatus(generationId?: string) {
  return useQuery<ChangelogGeneration, Error>({
    queryKey: ["generation", generationId],
    queryFn: () => getGenerationStatus(generationId!),
    enabled: Boolean(generationId),
    refetchInterval: (query) => {
      // Stop polling when completed or failed
      if (query?.state?.data?.status === 'completed' || query?.state?.data?.status === 'failed') {
        return false
      }
      // Poll every 3 seconds while processing (reduced from 2s for better performance)
      return 3000
    },
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook for retrying failed generation
 */
export function useRetryGeneration() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (generationId: string) => retryGeneration(generationId),
    onSuccess: (generation) => {
      queryClient.setQueryData(["generation", generation.id], generation)
    },
  })
}

/**
 * Hook for canceling generation
 */
export function useCancelGeneration() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (generationId: string) => cancelGeneration(generationId),
    onSuccess: (_, generationId) => {
      queryClient.removeQueries({ queryKey: ["generation", generationId] })
    },
  })
}

/**
 * Hook for polling generation with callbacks
 * Useful for complex UI flows with progress tracking
 */
export function usePollGeneration(
  generationId?: string,
  options: {
    onProgress?: (generation: ChangelogGeneration) => void
    onComplete?: (generation: ChangelogGeneration) => void
    onError?: (error: Error) => void
  } = {}
) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: () => {
      if (!generationId) {
        throw new Error("Generation ID is required")
      }
      
      return pollGenerationStatus(
        generationId,
        options.onProgress,
        options.onComplete,
        options.onError
      )
    },
    onSuccess: (generation) => {
      queryClient.setQueryData(["generation", generation.id], generation)
    },
  })
} 