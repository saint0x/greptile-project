import { env } from './env'

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
  }
}

// Error handling
export class ChangelogAPIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message)
    this.name = 'ChangelogAPIError'
  }
}

// Base API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${env.API_URL}${endpoint}`
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }

  try {
    const response = await fetch(url, defaultOptions)
    
    if (!response.ok) {
      throw new ChangelogAPIError(
        `API request failed: ${response.statusText}`,
        'API_ERROR',
        response.status
      )
    }

    const data = await response.json()
    return data
  } catch (error) {
    if (error instanceof ChangelogAPIError) {
      throw error
    }
    throw new ChangelogAPIError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK_ERROR'
    )
  }
}

/**
 * Fetch paginated changelog list
 */
export async function fetchChangelogs(params: {
  page?: number
  limit?: number
  sortBy?: 'publishedAt' | 'version'
  sortOrder?: 'asc' | 'desc'
} = {}) {
  const queryParams = new URLSearchParams()
  
  if (params.page) queryParams.set('page', params.page.toString())
  if (params.limit) queryParams.set('limit', params.limit.toString())
  if (params.sortBy) queryParams.set('sortBy', params.sortBy)
  if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder)

  const response = await apiRequest<any>(`/changelogs?${queryParams}`)
  return response.data // Backend response structure: { success: true, data: { changelogs: [...], pagination: {...} } }
}

/**
 * Fetch changelog detail by ID
 */
export async function fetchChangelogDetail(id: string) {
  const response = await apiRequest<any>(`/changelogs/${encodeURIComponent(id)}`)
  return response.data // Backend response structure: { success: true, data: { id, title, sections: [...], ... } }
}
