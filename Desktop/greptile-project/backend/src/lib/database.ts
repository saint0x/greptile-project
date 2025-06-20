import { Database } from 'bun:sqlite'
import type { UserRow, RepositoryRow, ChangelogRow } from '../types/index.ts'

// Initialize SQLite database with retry logic for locks
const dbPath = process.env.NODE_ENV === 'production' ? './data/changelog.db' : './data/changelog-dev.db'

let dbInstance: Database | null = null

function createDatabase() {
  try {
    const database = new Database(dbPath, { create: true })
    
    // Enable foreign keys and performance optimizations with error handling
    try {
      database.exec('PRAGMA foreign_keys = ON')
      database.exec('PRAGMA journal_mode = WAL')
      database.exec('PRAGMA synchronous = NORMAL')
      database.exec('PRAGMA cache_size = 1000')
      database.exec('PRAGMA busy_timeout = 30000') // 30 second timeout for locks
      database.exec('PRAGMA temp_store = MEMORY') // Use memory for temp tables
      database.exec('PRAGMA mmap_size = 268435456') // 256MB memory map
    } catch (pragmaError) {
      console.warn('Some PRAGMA statements failed:', pragmaError)
      // Continue anyway - these are optimizations, not critical
    }
    
    return database
  } catch (error) {
    console.error('Failed to create database:', error)
    throw error
  }
}

// Initialize database lazily
function getDatabase(): Database {
  if (!dbInstance) {
    dbInstance = createDatabase()
  }
  return dbInstance
}

export { getDatabase }
export const db = getDatabase()

// Database schema creation with enhanced caching and persistence
export const createTables = () => {
  const database = getDatabase()
  
  // Users table
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      github_username TEXT,
      github_token_encrypted TEXT,
      role TEXT DEFAULT 'developer',
      preferences TEXT DEFAULT '{}',
      last_login_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Repositories table - enhanced with cache metadata
  database.exec(`
    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      github_id INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      owner TEXT NOT NULL,
      description TEXT,
      url TEXT NOT NULL,
      is_private BOOLEAN DEFAULT FALSE,
      default_branch TEXT DEFAULT 'main',
      language TEXT,
      star_count INTEGER DEFAULT 0,
      fork_count INTEGER DEFAULT 0,
      last_pushed_at TEXT,
      last_sync_at TEXT,
      sync_status TEXT DEFAULT 'pending',
      cache_expires_at TEXT,
      webhook_configured BOOLEAN DEFAULT FALSE,
      topics TEXT DEFAULT '[]',
      license TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Repository access table (manages which users can access which repositories)
  database.exec(`
    CREATE TABLE IF NOT EXISTS repository_access (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      github_id INTEGER REFERENCES repositories(github_id) ON DELETE CASCADE,
      access_level TEXT DEFAULT 'read',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, github_id)
    )
  `)

  // GitHub data cache for performance
  database.exec(`
    CREATE TABLE IF NOT EXISTS github_cache (
      id TEXT PRIMARY KEY,
      repository_id TEXT REFERENCES repositories(id) ON DELETE CASCADE,
      cache_type TEXT NOT NULL, -- 'commits', 'branches'
      cache_key TEXT NOT NULL, -- branch_name:date_range
      data TEXT NOT NULL, -- JSON data
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(repository_id, cache_type, cache_key)
    )
  `)

  // Changelogs table - enhanced
  database.exec(`
    CREATE TABLE IF NOT EXISTS changelogs (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      repository_id TEXT REFERENCES repositories(id),
      branch TEXT NOT NULL,
      date_start TEXT NOT NULL,
      date_end TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      published_at TEXT,
      published_by TEXT REFERENCES users(id),
      metadata TEXT DEFAULT '{}',
      tags TEXT DEFAULT '[]',
      views INTEGER DEFAULT 0,
      is_public BOOLEAN DEFAULT FALSE,
      slug TEXT, -- For public URLs
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Changelog sections table
  database.exec(`
    CREATE TABLE IF NOT EXISTS changelog_sections (
      id TEXT PRIMARY KEY,
      changelog_id TEXT REFERENCES changelogs(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Changelog changes table
  database.exec(`
    CREATE TABLE IF NOT EXISTS changelog_changes (
      id TEXT PRIMARY KEY,
      section_id TEXT REFERENCES changelog_sections(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      type TEXT NOT NULL,
      impact TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      commits TEXT DEFAULT '[]',
      pull_requests TEXT DEFAULT '[]',
      author TEXT,
      affected_components TEXT DEFAULT '[]',
      migration_guide TEXT,
      code_examples TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // AI generations table - enhanced for saved generations
  database.exec(`
    CREATE TABLE IF NOT EXISTS ai_generations (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      repository_id TEXT NOT NULL,
      branch TEXT,
      date_start TEXT,
      date_end TEXT,
      status TEXT DEFAULT 'processing',
      progress INTEGER DEFAULT 0,
      commits_data TEXT DEFAULT '[]',
      generated_content TEXT DEFAULT '{}',
      ai_metadata TEXT DEFAULT '{}',
      is_saved BOOLEAN DEFAULT FALSE,
      settings TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Create indexes for performance
  database.exec('CREATE INDEX IF NOT EXISTS idx_changelogs_repository_id ON changelogs(repository_id)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_changelogs_status ON changelogs(status)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_changelogs_published_at ON changelogs(published_at)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_changelogs_is_public ON changelogs(is_public)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_changelogs_slug ON changelogs(slug)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_changelog_sections_changelog_id ON changelog_sections(changelog_id)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_changelog_changes_section_id ON changelog_changes(section_id)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_users_github_username ON users(github_username)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_repositories_github_id ON repositories(github_id)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_repositories_owner ON repositories(owner)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_repositories_full_name ON repositories(full_name)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_repository_access_user_id ON repository_access(user_id)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_repository_access_github_id ON repository_access(github_id)')
  
  // Essential indexes for caching and saved generations
  database.exec('CREATE INDEX IF NOT EXISTS idx_github_cache_repo_type ON github_cache(repository_id, cache_type)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_github_cache_expires ON github_cache(expires_at)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_ai_generations_user ON ai_generations(user_id)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_ai_generations_saved ON ai_generations(is_saved)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_ai_generations_status ON ai_generations(status)')
}

// Initialize prepared statements after tables are created
export function initializeStatements() {
  const database = getDatabase()
  return {
    // Users
    createUser: database.prepare(`
      INSERT INTO users (id, email, name, github_username, github_token_encrypted, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    
    getUserById: database.prepare('SELECT * FROM users WHERE id = ?'),
    getUserByEmail: database.prepare('SELECT * FROM users WHERE email = ?'),
    updateUser: database.prepare(`
      UPDATE users 
      SET name = ?, github_username = ?, github_token_encrypted = ?, updated_at = datetime('now')
      WHERE id = ?
    `),

    // Repositories
    createRepository: database.prepare(`
      INSERT INTO repositories (
        id, github_id, name, full_name, owner, description, url, is_private,
        default_branch, language, star_count, fork_count, last_pushed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    
    getRepositoryById: database.prepare('SELECT * FROM repositories WHERE id = ?'),
    getRepositoriesByOwner: database.prepare('SELECT * FROM repositories ORDER BY updated_at DESC'),
    updateRepositorySync: database.prepare(`
      UPDATE repositories 
      SET last_sync_at = datetime('now'), sync_status = ?, updated_at = datetime('now')
      WHERE id = ?
    `),

    // Changelogs
    createChangelog: database.prepare(`
      INSERT INTO changelogs (
        id, version, title, description, repository_id, branch, date_start, date_end,
        status, published_at, published_by, is_public, metadata, tags, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    
    createChangelogSection: database.prepare(`
      INSERT INTO changelog_sections (id, changelog_id, title, order_index)
      VALUES (?, ?, ?, ?)
    `),
    
    createChangelogChange: database.prepare(`
      INSERT INTO changelog_changes (
        id, section_id, description, type, impact, tags, commits, pull_requests,
        author, affected_components, migration_guide, code_examples
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    
    getChangelogById: database.prepare('SELECT * FROM changelogs WHERE id = ?'),
    getChangelogsByRepository: database.prepare('SELECT * FROM changelogs WHERE repository_id = ? ORDER BY created_at DESC'),
    getPublishedChangelogs: database.prepare(`
      SELECT * FROM changelogs 
      WHERE status = 'published' 
      ORDER BY published_at DESC 
      LIMIT ? OFFSET ?
    `),
    updateChangelogStatus: database.prepare(`
      UPDATE changelogs 
      SET status = ?, published_at = ?, published_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `),

    // AI Generations
    createGeneration: database.prepare(`
      INSERT INTO ai_generations (id, repository_id, branch, date_start, date_end)
      VALUES (?, ?, ?, ?, ?)
    `),
    
    getGenerationById: database.prepare('SELECT * FROM ai_generations WHERE id = ?'),
    updateGenerationProgress: database.prepare(`
      UPDATE ai_generations 
      SET progress = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `),
    updateGenerationComplete: database.prepare(`
      UPDATE ai_generations 
      SET status = 'completed', progress = 100, generated_content = ?, ai_metadata = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
  }
}

// Prepared statements (will be initialized after migration)
export let statements: ReturnType<typeof initializeStatements>

// Initialize statements immediately after tables are created
export const initializeDatabase = () => {
  createTables()
  statements = initializeStatements()
  return statements
}

// Helper functions
export const generateId = () => crypto.randomUUID()

export const rowToUser = (row: UserRow) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  githubUsername: row.github_username,
  githubToken: row.github_token_encrypted,
  role: row.role as 'admin' | 'developer' | 'viewer',
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export const rowToRepository = (row: RepositoryRow) => ({
  id: row.id,
  githubId: row.github_id,
  name: row.name,
  fullName: row.full_name,
  owner: row.owner,
  description: row.description,
  url: row.url,
  isPrivate: row.is_private,
  defaultBranch: row.default_branch,
  language: row.language,
  starCount: row.star_count,
  forkCount: row.fork_count,
  lastPushedAt: row.last_pushed_at,
  lastSyncAt: row.last_sync_at,
  syncStatus: row.sync_status as 'pending' | 'syncing' | 'completed' | 'failed',
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export const rowToChangelog = (row: ChangelogRow) => ({
  id: row.id,
  version: row.version,
  title: row.title,
  description: row.description,
  repositoryId: row.repository_id,
  branch: row.branch,
  dateRange: {
    start: row.date_start,
    end: row.date_end
  },
  sections: [], // Will be populated by separate query
  metadata: JSON.parse(row.metadata),
  status: row.status as 'draft' | 'review' | 'published' | 'archived',
  publishedAt: row.published_at,
  publishedBy: row.published_by,
  tags: JSON.parse(row.tags),
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
}) 