import { Database } from 'bun:sqlite'
import type { UserRow, RepositoryRow, ChangelogRow } from '../types/index.ts'

// Initialize SQLite database
const dbPath = process.env.NODE_ENV === 'production' ? './data/changelog.db' : './data/changelog-dev.db'
export const db = new Database(dbPath, { create: true })

// Enable foreign keys and performance optimizations
db.exec('PRAGMA foreign_keys = ON')
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA synchronous = NORMAL')
db.exec('PRAGMA cache_size = 1000')

// Database schema creation
export const createTables = () => {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      github_username TEXT,
      github_token_encrypted TEXT,
      role TEXT DEFAULT 'developer',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Repositories table
  db.exec(`
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Repository access table (manages which users can access which repositories)
  db.exec(`
    CREATE TABLE IF NOT EXISTS repository_access (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      github_id INTEGER REFERENCES repositories(github_id) ON DELETE CASCADE,
      access_level TEXT DEFAULT 'read',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, github_id)
    )
  `)

  // Changelogs table
  db.exec(`
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
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Changelog sections table
  db.exec(`
    CREATE TABLE IF NOT EXISTS changelog_sections (
      id TEXT PRIMARY KEY,
      changelog_id TEXT REFERENCES changelogs(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Changelog changes table
  db.exec(`
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

  // AI generations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_generations (
      id TEXT PRIMARY KEY,
      repository_id TEXT REFERENCES repositories(id),
      branch TEXT,
      date_start TEXT,
      date_end TEXT,
      status TEXT DEFAULT 'processing',
      progress INTEGER DEFAULT 0,
      commits_data TEXT DEFAULT '[]',
      generated_content TEXT DEFAULT '{}',
      ai_metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Create indexes for performance
  db.exec('CREATE INDEX IF NOT EXISTS idx_changelogs_repository_id ON changelogs(repository_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_changelogs_status ON changelogs(status)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_changelogs_published_at ON changelogs(published_at)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_changelog_sections_changelog_id ON changelog_sections(changelog_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_changelog_changes_section_id ON changelog_changes(section_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_repositories_github_id ON repositories(github_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_repository_access_user_id ON repository_access(user_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_repository_access_github_id ON repository_access(github_id)')
}

// Initialize prepared statements after tables are created
export function initializeStatements() {
  return {
    // Users
    createUser: db.prepare(`
      INSERT INTO users (id, email, name, github_username, github_token_encrypted, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    
    getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
    getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    updateUser: db.prepare(`
      UPDATE users 
      SET name = ?, github_username = ?, github_token_encrypted = ?, updated_at = datetime('now')
      WHERE id = ?
    `),

    // Repositories
    createRepository: db.prepare(`
      INSERT INTO repositories (
        id, github_id, name, full_name, owner, description, url, is_private,
        default_branch, language, star_count, fork_count, last_pushed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    
    getRepositoryById: db.prepare('SELECT * FROM repositories WHERE id = ?'),
    getRepositoriesByOwner: db.prepare('SELECT * FROM repositories ORDER BY updated_at DESC'),
    updateRepositorySync: db.prepare(`
      UPDATE repositories 
      SET last_sync_at = datetime('now'), sync_status = ?, updated_at = datetime('now')
      WHERE id = ?
    `),

    // Changelogs
    createChangelog: db.prepare(`
      INSERT INTO changelogs (
        id, version, title, description, repository_id, branch, date_start, date_end,
        metadata, tags, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    
    createChangelogSection: db.prepare(`
      INSERT INTO changelog_sections (id, changelog_id, title, order_index)
      VALUES (?, ?, ?, ?)
    `),
    
    createChangelogChange: db.prepare(`
      INSERT INTO changelog_changes (
        id, section_id, description, type, impact, tags, commits, pull_requests,
        author, affected_components, migration_guide, code_examples
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    
    getChangelogById: db.prepare('SELECT * FROM changelogs WHERE id = ?'),
    getChangelogsByRepository: db.prepare('SELECT * FROM changelogs WHERE repository_id = ? ORDER BY created_at DESC'),
    getPublishedChangelogs: db.prepare(`
      SELECT * FROM changelogs 
      WHERE status = 'published' 
      ORDER BY published_at DESC 
      LIMIT ? OFFSET ?
    `),
    updateChangelogStatus: db.prepare(`
      UPDATE changelogs 
      SET status = ?, published_at = ?, published_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `),

    // AI Generations
    createGeneration: db.prepare(`
      INSERT INTO ai_generations (id, repository_id, branch, date_start, date_end)
      VALUES (?, ?, ?, ?, ?)
    `),
    
    getGenerationById: db.prepare('SELECT * FROM ai_generations WHERE id = ?'),
    updateGenerationProgress: db.prepare(`
      UPDATE ai_generations 
      SET progress = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `),
    updateGenerationComplete: db.prepare(`
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