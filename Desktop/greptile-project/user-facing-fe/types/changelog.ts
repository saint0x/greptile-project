// Types aligned with backend source of truth - public API focused

// Core Repository type (public view)
export interface Repository {
  readonly name: string
  readonly fullName: string
  readonly owner: string
  readonly description?: string
  readonly changelogCount: number
  readonly latestChangelog?: string
}

// Core Changelog Change type - matches backend exactly
export interface ChangelogChange {
  readonly id: string
  readonly description: string
  readonly type: 'feature' | 'bugfix' | 'breaking' | 'enhancement' | 'deprecation' | 'security'
  readonly impact: 'major' | 'minor' | 'patch'
  readonly tags: readonly string[]
  readonly commits?: readonly string[]
  readonly pullRequests?: readonly number[]
  readonly author?: string
  readonly affectedComponents?: readonly string[]
  readonly migrationGuide?: string
  readonly codeExamples?: Readonly<Record<string, string>>
}

// Changelog Section - matches backend exactly
export interface ChangelogSection {
  readonly id: string
  readonly title: string
  readonly order: number
  readonly changes: readonly ChangelogChange[]
}

// Main Changelog type for public consumption - matches backend public API response
export interface PublicChangelog {
  readonly id: string
  readonly version: string
  readonly title: string
  readonly description?: string
  readonly repository: Repository
  readonly branch: string
  readonly dateRange: {
    readonly start: string
    readonly end: string
  }
  readonly sections: readonly ChangelogSection[]
  readonly publishedAt?: string
  readonly tags: readonly string[]
  readonly views?: number // For trending
}

// Changelog listing item - matches backend /public/changelogs response
export interface ChangelogListItem {
  readonly id: string
  readonly version: string
  readonly title: string
  readonly description?: string
  readonly repository: {
    readonly name: string
    readonly fullName: string
    readonly owner: string
  }
  readonly branch: string
  readonly dateRange: {
    readonly start: string
    readonly end: string
  }
  readonly publishedAt: string
  readonly tags: readonly string[]
}

// API Response types - match backend exactly
export interface ApiResponse<T> {
  readonly data: T
  readonly success: boolean
  readonly message?: string
  readonly errors?: readonly string[]
}

export interface ApiError {
  readonly success: false
  readonly error: {
    readonly code: string
    readonly message: string
    readonly details?: any
  }
  readonly timestamp: string
  readonly path: string
}

// Pagination type - matches backend exactly
export interface PaginationMeta {
  readonly page: number
  readonly limit: number
  readonly total: number
  readonly totalPages: number
  readonly hasNext?: boolean
  readonly hasPrev?: boolean
}

// Public API Response types - match backend public routes exactly

// GET /public/changelogs response
export interface ChangelogListResponse {
  readonly success: true
  readonly data: {
    readonly changelogs: readonly ChangelogListItem[]
    readonly pagination: PaginationMeta
  }
}

// GET /public/changelogs/:id response
export interface ChangelogDetailResponse {
  readonly success: true
  readonly data: PublicChangelog
}

// GET /public/search response
export interface SearchResponse {
  readonly success: true
  readonly data: {
    readonly query: string
    readonly results: readonly ChangelogListItem[]
    readonly pagination: PaginationMeta
  }
}

// GET /public/tags response
export interface TagsResponse {
  readonly success: true
  readonly data: {
    readonly tags: readonly {
      readonly tag: string
      readonly count: number
    }[]
  }
}

// GET /public/repositories response
export interface RepositoriesResponse {
  readonly success: true
  readonly data: {
    readonly repositories: readonly Repository[]
  }
}

// GET /public/trending response
export interface TrendingResponse {
  readonly success: true
  readonly data: {
    readonly trending: readonly (ChangelogListItem & { readonly views: number })[]
  }
}

// Search and filter types
export interface SearchFilters {
  readonly search?: string
  readonly tags?: string
  readonly repository?: string
  readonly sortBy?: 'publishedAt' | 'version' | 'title'
  readonly sortOrder?: 'asc' | 'desc'
}

export interface SearchParams extends SearchFilters {
  readonly page?: number
  readonly limit?: number
}

export interface AdvancedSearchParams {
  readonly q: string
  readonly page?: number
  readonly limit?: number
}

// Tag types
export interface Tag {
  readonly name: string
  readonly count: number
}

// Legacy types for backward compatibility with existing components
export interface ChangelogData {
  readonly releases: readonly ChangelogListItem[]
}

export interface ChangelogEntryDetail extends PublicChangelog {
  readonly category: string // Derived from tags[0] or type
  readonly whatsNew: string // Derived from description
  readonly impact: string // Derived from changes
  readonly upgradeSteps: readonly string[] // Derived from migration guides
  readonly relatedChanges: readonly string[] // Derived from related changelogs
}

// For existing component compatibility
export interface ChangelogRelease extends ChangelogListItem {}

// Component props types
export interface ChangelogListProps {
  readonly filters?: SearchFilters
  readonly initialData?: ChangelogListResponse
}

export interface ChangelogDetailProps {
  readonly changelogId: string
  readonly initialData?: ChangelogDetailResponse
}

// Error types
export class ChangelogAPIError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'ChangelogAPIError'
  }
}

// Tag color mapping - keeping existing colors for consistency
export const tagColors: Record<string, string> = {
  // Product tags
  Issuing: "bg-blue-100 text-blue-800",
  Payments: "bg-purple-100 text-purple-800",
  Connect: "bg-cyan-100 text-cyan-800",
  Checkout: "bg-green-100 text-green-800",
  Terminal: "bg-orange-100 text-orange-800",
  Billing: "bg-yellow-100 text-yellow-800",
  Identity: "bg-pink-100 text-pink-800",
  Tax: "bg-indigo-100 text-indigo-800",
  
  // Change type tags
  API: "bg-green-100 text-green-800",
  feature: "bg-purple-100 text-purple-800",
  enhancement: "bg-blue-100 text-blue-800",
  breaking: "bg-red-100 text-red-800",
  bugfix: "bg-green-100 text-green-800",
  deprecation: "bg-yellow-100 text-yellow-800",
  security: "bg-red-100 text-red-800",
  
  // Overflow indicators
  "+1 more": "bg-gray-100 text-gray-600",
  "+2 more": "bg-gray-100 text-gray-600",
  "+3 more": "bg-gray-100 text-gray-600",
  
  // Default
  default: "bg-gray-100 text-gray-800"
} as const

// Type guards for runtime type checking
export function isChangelogListResponse(data: any): data is ChangelogListResponse {
  return data && 
    typeof data === 'object' && 
    data.success === true &&
    data.data &&
    Array.isArray(data.data.changelogs) &&
    data.data.pagination
}

export function isChangelogDetailResponse(data: any): data is ChangelogDetailResponse {
  return data && 
    typeof data === 'object' && 
    data.success === true &&
    data.data &&
    typeof data.data.id === 'string'
}

export function isApiError(data: any): data is ApiError {
  return data && 
    typeof data === 'object' && 
    data.success === false &&
    data.error &&
    typeof data.error.code === 'string'
}
