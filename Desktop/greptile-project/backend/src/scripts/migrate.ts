#!/usr/bin/env bun

import { db } from '../lib/database.js'

console.log('🔧 Running database migrations...')

try {
  // Run migrations step by step to handle schema evolution
  
  // Step 1: Add new columns to existing tables safely
  console.log('📝 Adding new columns to existing tables...')
  
  try {
    db.exec(`ALTER TABLE repositories ADD COLUMN cache_expires_at TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  
  try {
    db.exec(`ALTER TABLE repositories ADD COLUMN webhook_configured BOOLEAN DEFAULT FALSE`)
  } catch (e) {
    // Column already exists, ignore  
  }
  
  try {
    db.exec(`ALTER TABLE repositories ADD COLUMN topics TEXT DEFAULT '[]'`)
  } catch (e) {
    // Column already exists, ignore
  }
  
  try {
    db.exec(`ALTER TABLE repositories ADD COLUMN license TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  
  try {
    db.exec(`ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}'`)
  } catch (e) {
    // Column already exists, ignore
  }
  
  try {
    db.exec(`ALTER TABLE users ADD COLUMN last_login_at TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  
  try {
    db.exec(`ALTER TABLE changelogs ADD COLUMN views INTEGER DEFAULT 0`)
  } catch (e) {
    // Column already exists, ignore
  }
  
  try {
    db.exec(`ALTER TABLE changelogs ADD COLUMN is_public BOOLEAN DEFAULT FALSE`)
  } catch (e) {
    // Column already exists, ignore
  }
  
  try {
    db.exec(`ALTER TABLE changelogs ADD COLUMN slug TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  
  // Step 2: Create new tables
  console.log('📝 Creating new tables...')
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS github_cache (
      id TEXT PRIMARY KEY,
      repository_id TEXT REFERENCES repositories(id) ON DELETE CASCADE,
      cache_type TEXT NOT NULL,
      cache_key TEXT NOT NULL,
      data TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(repository_id, cache_type, cache_key)
    )
  `)
  
  // Step 3: Recreate ai_generations with new schema
  console.log('📝 Updating ai_generations table...')
  
  // Check if ai_generations needs updating
  const tableInfo = db.prepare(`PRAGMA table_info(ai_generations)`).all()
  const hasUserId = tableInfo.some((col: any) => col.name === 'user_id')
  
  if (!hasUserId) {
    console.log('📝 Migrating ai_generations table...')
    
    // Backup existing data
    db.exec(`CREATE TABLE ai_generations_backup AS SELECT * FROM ai_generations`)
    
    // Drop old table
    db.exec(`DROP TABLE ai_generations`)
    
    // Create new table
    db.exec(`
      CREATE TABLE ai_generations (
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
    
    // Migrate data (set user_id to null for existing records)
    db.exec(`
      INSERT INTO ai_generations 
      (id, repository_id, branch, date_start, date_end, status, progress, 
       commits_data, generated_content, ai_metadata, created_at, updated_at)
      SELECT id, repository_id, branch, date_start, date_end, status, progress,
             commits_data, generated_content, ai_metadata, created_at, updated_at
      FROM ai_generations_backup
    `)
    
    // Drop backup
    db.exec(`DROP TABLE ai_generations_backup`)
  }
  
  // Step 4: Create indexes
  console.log('📝 Creating indexes...')
  
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_changelogs_repository_id ON changelogs(repository_id)',
    'CREATE INDEX IF NOT EXISTS idx_changelogs_status ON changelogs(status)',
    'CREATE INDEX IF NOT EXISTS idx_changelogs_published_at ON changelogs(published_at)',
    'CREATE INDEX IF NOT EXISTS idx_changelogs_is_public ON changelogs(is_public)',
    'CREATE INDEX IF NOT EXISTS idx_changelogs_slug ON changelogs(slug)',
    'CREATE INDEX IF NOT EXISTS idx_github_cache_repo_type ON github_cache(repository_id, cache_type)',
    'CREATE INDEX IF NOT EXISTS idx_github_cache_expires ON github_cache(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_ai_generations_user ON ai_generations(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_ai_generations_saved ON ai_generations(is_saved)',
    'CREATE INDEX IF NOT EXISTS idx_ai_generations_status ON ai_generations(status)'
  ]
  
  indexes.forEach(indexQuery => {
    try {
      db.exec(indexQuery)
    } catch (e) {
      console.warn('Index creation warning:', e instanceof Error ? e.message : String(e))
    }
  })
  
  console.log('✅ Database migration completed successfully!')
} catch (error) {
  console.error('❌ Database migration failed:', error)
  process.exit(1)
} 