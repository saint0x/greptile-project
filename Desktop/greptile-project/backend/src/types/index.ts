// Core types that match our frontend interfaces exactly
export interface User {
  id: string
  email: string
  name: string
  githubUsername?: string
  githubToken?: string // Encrypted
  role: 'admin' | 'developer' | 'viewer'
  createdAt: string
  updatedAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface Repository {
  id: string
  githubId: number
  name: string
  fullName: string // owner/repo
  owner: string
  description?: string
  url: string
  isPrivate: boolean
  defaultBranch: string
  language?: string
  starCount: number
  forkCount: number
  lastPushedAt: string
  createdAt: string
  updatedAt: string
  // Cache metadata
  lastSyncAt?: string
  syncStatus: 'pending' | 'syncing' | 'completed' | 'failed'
}

export interface Branch {
  name: string
  sha: string
  isDefault: boolean
  isProtected: boolean
  lastCommit: {
    sha: string
    message: string
    author: string
    date: string
  }
}

export interface ChangelogRequest {
  repositoryId: string
  branch: string
  startDate: string
  endDate: string
  options: {
    groupBy: 'type' | 'author' | 'component' | 'chronological'
    includeBreakingChanges: boolean
    includeBugFixes: boolean
    includeFeatures: boolean
    includeDocumentation: boolean
    excludePatterns: string[]
    customPrompt?: string
    targetAudience: 'developers' | 'end-users' | 'technical' | 'general'
  }
}

export interface CommitAnalysis {
  sha: string
  type: 'feature' | 'bugfix' | 'breaking' | 'docs' | 'refactor' | 'test' | 'chore'
  scope?: string
  description: string
  impact: 'major' | 'minor' | 'patch'
  breakingChange: boolean
  affectedComponents: string[]
  userFacing: boolean
  confidence: number // AI confidence score 0-1
}

export interface ChangelogGeneration {
  id: string
  repositoryId: string
  branch: string
  dateRange: {
    start: string
    end: string
  }
  status: 'processing' | 'completed' | 'failed'
  progress: number // 0-100
  commits: CommitAnalysis[]
  generatedContent: any // Will be populated with Changelog structure
  aiMetadata: {
    model: string
    promptTokens: number
    completionTokens: number
    processingTime: number
    confidence: number
  }
  createdAt: string
  updatedAt: string
}

export interface Changelog {
  id: string
  version: string
  title: string
  description?: string
  repositoryId: string
  branch: string
  dateRange: {
    start: string
    end: string
  }
  sections: ChangelogSection[]
  metadata: {
    totalCommits: number
    contributors: number
    filesChanged: number
    linesAdded: number
    linesRemoved: number
    generationMethod: 'ai' | 'manual' | 'hybrid'
    aiGenerationId?: string
  }
  status: 'draft' | 'review' | 'published' | 'archived'
  publishedAt?: string
  publishedBy?: string
  tags: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ChangelogSection {
  id: string
  title: string
  order: number
  changes: ChangelogChange[]
}

export interface ChangelogChange {
  id: string
  description: string
  type: 'feature' | 'bugfix' | 'breaking' | 'enhancement' | 'deprecation' | 'security'
  impact: 'major' | 'minor' | 'patch'
  tags: string[]
  commits?: string[]
  pullRequests?: number[]
  author?: string
  affectedComponents?: string[]
  migrationGuide?: string
  codeExamples?: Record<string, string>
}

// API Response wrappers
export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
  errors?: string[]
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: any
  }
  timestamp: string
  path: string
}

// Database row types (snake_case for SQLite)
export interface UserRow {
  id: string
  email: string
  name: string
  github_username?: string
  github_token_encrypted?: string
  role: string
  created_at: string
  updated_at: string
}

export interface RepositoryRow {
  id: string
  github_id: number
  name: string
  full_name: string
  owner: string
  description?: string
  url: string
  is_private: boolean
  default_branch: string
  language?: string
  star_count: number
  fork_count: number
  last_pushed_at: string
  last_sync_at?: string
  sync_status: string
  created_at: string
  updated_at: string
}

export interface ChangelogRow {
  id: string
  version: string
  title: string
  description?: string
  repository_id: string
  branch: string
  date_start: string
  date_end: string
  status: string
  published_at?: string
  published_by?: string
  metadata: string // JSON
  tags: string // JSON array
  created_by: string
  created_at: string
  updated_at: string
}

// Context Variables for Hono
export interface Variables {
  user?: User
} 