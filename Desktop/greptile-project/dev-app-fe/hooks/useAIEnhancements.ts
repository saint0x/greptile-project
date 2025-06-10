import { useMutation } from "@tanstack/react-query"
import { 
  enhanceDescription, 
  suggestTags 
} from "@/lib/api"

/**
 * Hook for enhancing changelog descriptions with AI
 */
export function useEnhanceDescription() {
  return useMutation({
    mutationFn: (description: string) => enhanceDescription(description),
    onError: (error) => {
      console.error('Description enhancement failed:', error)
    },
  })
}

/**
 * Hook for AI tag suggestions
 */
export function useSuggestTags() {
  return useMutation({
    mutationFn: (description: string) => suggestTags(description),
    onError: (error) => {
      console.error('Tag suggestion failed:', error)
    },
  })
}

/**
 * Hook for batch AI enhancements
 * Useful for enhancing multiple descriptions at once
 */
export function useBatchEnhance() {
  return useMutation({
    mutationFn: async (descriptions: string[]) => {
      const promises = descriptions.map(desc => enhanceDescription(desc))
      return Promise.all(promises)
    },
    onError: (error) => {
      console.error('Batch enhancement failed:', error)
    },
  })
} 