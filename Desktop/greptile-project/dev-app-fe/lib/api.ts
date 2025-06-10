import type { 
  Repository, 
  Branch, 
  ChangelogRequest, 
  GeneratedChangelog,
  Changelog,
  ChangelogGeneration,
  User,
  AuthTokens,
  ApiResponse,
  PaginatedResponse
} from "@/types/changelog"
import { getSession } from "next-auth/react"

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

// HTTP client with auth that always gets fresh token from NextAuth
async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  // Always get fresh session token
  const session = await getSession()
  const token = session?.accessToken
  const url = `${API_BASE_URL}${endpoint}`
  
  console.log('API Request:', endpoint, 'Has token:', !!token, 'Token preview:', token?.substring(0, 15) + '...')
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    // GitHub token invalid - NextAuth will handle this
    throw new Error('Authentication required')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * User API functions
 */
export async function getCurrentUser(): Promise<User> {
  return apiRequest<User>('/auth/me')
}

/**
 * Repository Management API functions
 */
export async function fetchRepositories(): Promise<Repository[]> {
  const response = await apiRequest<ApiResponse<Repository[]>>('/repositories')
  return response.data
}

export async function syncRepositories(): Promise<{ synced: number; failed: number }> {
  return apiRequest<{ synced: number; failed: number }>('/repositories/sync', {
    method: 'POST',
  })
}

export async function fetchBranches(repositoryId: string, defaultBranch?: string): Promise<Branch[]> {
  const url = `/repositories/${encodeURIComponent(repositoryId)}/branches` + 
    (defaultBranch ? `?defaultBranch=${encodeURIComponent(defaultBranch)}` : '')
  const response = await apiRequest<ApiResponse<Branch[]>>(url)
  return response.data
}

export async function getRepository(repositoryId: string): Promise<Repository> {
  const response = await apiRequest<ApiResponse<Repository>>(`/repositories/${repositoryId}`)
  return response.data
}

/**
 * AI-Powered Changelog Generation
 */
export async function generateChangelog(request: ChangelogRequest): Promise<ChangelogGeneration> {
  const response = await apiRequest<ApiResponse<ChangelogGeneration>>('/changelogs/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  })
  return response.data
}

export async function getGenerationStatus(generationId: string): Promise<ChangelogGeneration> {
  const response = await apiRequest<ApiResponse<ChangelogGeneration>>(`/changelogs/generate/${generationId}`)
  return response.data
}

export async function retryGeneration(generationId: string): Promise<ChangelogGeneration> {
  const response = await apiRequest<ApiResponse<ChangelogGeneration>>(`/changelogs/generate/${generationId}/retry`, {
    method: 'POST',
  })
  return response.data
}

export async function cancelGeneration(generationId: string): Promise<void> {
  await apiRequest(`/changelogs/generate/${generationId}`, {
    method: 'DELETE',
  })
}

/**
 * Changelog CRUD Operations
 */
export async function fetchChangelogs(params: {
  page?: number
  limit?: number
  status?: string
  repositoryId?: string
} = {}): Promise<PaginatedResponse<Changelog>> {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value))
    }
  })
  
  const query = searchParams.toString()
  const endpoint = `/changelogs${query ? `?${query}` : ''}`
  
  return apiRequest<PaginatedResponse<Changelog>>(endpoint)
}

export async function createChangelog(changelog: Partial<Changelog>): Promise<Changelog> {
  const response = await apiRequest<ApiResponse<Changelog>>('/changelogs', {
    method: 'POST',
    body: JSON.stringify(changelog),
  })
  return response.data
}

export async function getChangelog(changelogId: string): Promise<Changelog> {
  const response = await apiRequest<ApiResponse<Changelog>>(`/changelogs/${changelogId}`)
  return response.data
}

export async function updateChangelog(changelogId: string, updates: Partial<Changelog>): Promise<Changelog> {
  const response = await apiRequest<ApiResponse<Changelog>>(`/changelogs/${changelogId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
  return response.data
}

export async function deleteChangelog(changelogId: string): Promise<void> {
  await apiRequest(`/changelogs/${changelogId}`, {
    method: 'DELETE',
  })
}

export async function publishChangelog(changelogId: string): Promise<Changelog> {
  const response = await apiRequest<ApiResponse<Changelog>>(`/changelogs/${changelogId}/publish`, {
    method: 'POST',
  })
  return response.data
}

export async function unpublishChangelog(changelogId: string): Promise<Changelog> {
  const response = await apiRequest<ApiResponse<Changelog>>(`/changelogs/${changelogId}/unpublish`, {
    method: 'POST',
  })
  return response.data
}

export async function duplicateChangelog(changelogId: string): Promise<Changelog> {
  const response = await apiRequest<ApiResponse<Changelog>>(`/changelogs/${changelogId}/duplicate`, {
    method: 'POST',
  })
  return response.data
}

/**
 * AI Enhancement functions
 */
export async function enhanceDescription(description: string): Promise<{ enhanced: string; suggestions: string[] }> {
  const response = await apiRequest<{ enhanced: string; suggestions: string[] }>('/ai/enhance-description', {
    method: 'POST',
    body: JSON.stringify({ description }),
  })
  return response
}

export async function suggestTags(description: string): Promise<string[]> {
  const response = await apiRequest<{ tags: string[] }>('/ai/suggest-tags', {
    method: 'POST',
    body: JSON.stringify({ description }),
  })
  return response.tags
}

/**
 * Utility functions for polling AI generation status
 */
export async function pollGenerationStatus(
  generationId: string,
  onProgress?: (generation: ChangelogGeneration) => void,
  onComplete?: (generation: ChangelogGeneration) => void,
  onError?: (error: Error) => void
): Promise<ChangelogGeneration> {
  const poll = async (): Promise<ChangelogGeneration> => {
    try {
      const generation = await getGenerationStatus(generationId)
      
      if (onProgress) {
        onProgress(generation)
      }
      
      if (generation.status === 'completed') {
        if (onComplete) {
          onComplete(generation)
        }
        return generation
      } else if (generation.status === 'failed') {
        const error = new Error('Changelog generation failed')
        if (onError) {
          onError(error)
        }
        throw error
      } else {
        // Still processing, poll again in 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000))
        return poll()
      }
    } catch (error) {
      if (onError) {
        onError(error as Error)
      }
      throw error
    }
  }
  
  return poll()
}

// Legacy functions for backward compatibility (now get token from session directly)
function setAuthToken(token: string) {
  console.log('🔧 setAuthToken called (now uses NextAuth session directly)')
}

function getAuthToken(): string | null {
  console.log('🔧 getAuthToken called (now uses NextAuth session directly)')
  return null
}

function clearAuthToken() {
  console.log('🔧 clearAuthToken called (now uses NextAuth session directly)')
}

// Export auth utilities for backward compatibility
export { setAuthToken, getAuthToken, clearAuthToken }
