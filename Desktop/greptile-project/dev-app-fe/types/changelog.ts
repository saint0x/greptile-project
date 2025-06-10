// Core entities - Enhanced for backend alignment
export interface Repository {
  readonly id: string
  readonly githubId: number
  readonly name: string
  readonly fullName: string // owner/repo
  readonly owner: string
  readonly description?: string
  readonly url: string
  readonly isPrivate: boolean
  readonly defaultBranch: string
  readonly language?: string
  readonly starCount: number
  readonly forkCount: number
  readonly lastPushedAt: string
  readonly createdAt: string
  readonly updatedAt: string
  // Cache metadata
  readonly lastSyncAt?: string
  readonly syncStatus: 'pending' | 'syncing' | 'completed' | 'failed'
}

export interface Branch {
  readonly name: string
  readonly sha: string
  readonly isDefault: boolean
  readonly isProtected: boolean
  readonly lastCommit: {
    readonly sha: string
    readonly message: string
    readonly author: string
    readonly date: string
  }
}

// Request/Response types - Enhanced
export interface ChangelogRequest {
  readonly repositoryId: string
  readonly branch: string
  readonly startDate: string
  readonly endDate: string
  readonly options: ChangelogGenerationOptions
}

export interface ChangelogGenerationOptions {
  readonly groupBy: 'type' | 'author' | 'component' | 'chronological'
  readonly includeBreakingChanges: boolean
  readonly includeBugFixes: boolean
  readonly includeFeatures: boolean
  readonly includeDocumentation: boolean
  readonly excludePatterns: readonly string[] // Regex patterns to exclude commits
  readonly customPrompt?: string
  readonly targetAudience: 'developers' | 'end-users' | 'technical' | 'general'
}

// AI Generation tracking
export interface ChangelogGeneration {
  readonly id: string
  readonly repositoryId: string
  readonly branch: string
  readonly dateRange: {
    readonly start: string
    readonly end: string
  }
  readonly status: 'processing' | 'completed' | 'failed'
  readonly progress: number // 0-100
  readonly commits: readonly CommitAnalysis[]
  readonly generatedContent: GeneratedChangelog
  readonly aiMetadata: {
    readonly model: string
    readonly promptTokens: number
    readonly completionTokens: number
    readonly processingTime: number
    readonly confidence: number
  }
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CommitAnalysis {
  readonly sha: string
  readonly type: 'feature' | 'bugfix' | 'breaking' | 'docs' | 'refactor' | 'test' | 'chore'
  readonly scope?: string
  readonly description: string
  readonly impact: 'major' | 'minor' | 'patch'
  readonly breakingChange: boolean
  readonly affectedComponents: readonly string[]
  readonly userFacing: boolean
  readonly confidence: number // AI confidence score 0-1
}

// Enhanced Changelog structure
export interface Changelog {
  readonly id: string
  readonly version: string
  readonly title: string
  readonly description?: string
  readonly repositoryId: string
  readonly repository: Repository // Populated
  readonly branch: string
  readonly dateRange: {
    readonly start: string
    readonly end: string
  }
  readonly sections: readonly ChangelogSection[]
  readonly metadata: {
    readonly totalCommits: number
    readonly contributors: number
    readonly filesChanged: number
    readonly linesAdded: number
    readonly linesRemoved: number
    readonly generationMethod: 'ai' | 'manual' | 'hybrid'
    readonly aiGenerationId?: string
  }
  readonly status: 'draft' | 'review' | 'published' | 'archived'
  readonly publishedAt?: string
  readonly publishedBy?: string
  readonly tags: readonly string[]
  readonly createdBy: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ChangelogSection {
  readonly id: string
  readonly title: string
  readonly order: number
  readonly changes: readonly ChangelogChange[]
}

export interface ChangelogChange {
  readonly id: string
  readonly description: string
  readonly type: 'feature' | 'bugfix' | 'breaking' | 'enhancement' | 'deprecation' | 'security'
  readonly impact: 'major' | 'minor' | 'patch'
  readonly tags: readonly string[]
  readonly commits?: readonly string[] // Associated commit SHAs
  readonly pullRequests?: readonly number[]
  readonly author?: string
  readonly affectedComponents?: readonly string[]
  readonly migrationGuide?: string
  readonly codeExamples?: Readonly<Record<string, string>> // language -> code
}

// Legacy interface for backward compatibility
export interface GeneratedChangelog {
  readonly id?: string
  readonly version: string
  readonly title: string
  readonly repository: string
  readonly branch: string
  readonly dateRange: string
  readonly sections: readonly ChangelogSection[]
  readonly createdAt?: string
  readonly metadata?: Readonly<Record<string, any>>
}

// Enums and constants
export type ChangeCategory =
  | "feature"
  | "bugfix"
  | "enhancement"
  | "breaking"
  | "deprecation"
  | "security"
  | "documentation"
  | "performance"

// API response types
export interface ApiResponse<T> {
  readonly data: T
  readonly success: boolean
  readonly message?: string
  readonly errors?: readonly string[]
}

export interface PaginatedResponse<T> {
  readonly data: readonly T[]
  readonly pagination: {
    readonly page: number
    readonly limit: number
    readonly total: number
    readonly hasNext: boolean
    readonly hasPrev: boolean
  }
}

// User management types
export interface User {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly githubUsername?: string
  readonly role: 'admin' | 'developer' | 'viewer'
  readonly createdAt: string
  readonly updatedAt: string
}

export interface AuthTokens {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresIn: number
}
