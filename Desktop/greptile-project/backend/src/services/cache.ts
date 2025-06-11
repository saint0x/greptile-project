import { db, generateId } from '../lib/database.ts'
import { addHours, isAfter } from 'date-fns'

interface CacheEntry {
  id: string
  repository_id: string
  cache_type: string
  cache_key: string
  data: string
  expires_at: string
  created_at: string
}

export class CacheService {
  // Get cached data if not expired
  static async get(repositoryId: string, type: string, key: string): Promise<any | null> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM github_cache 
        WHERE repository_id = ? AND cache_type = ? AND cache_key = ?
        AND expires_at > datetime('now')
      `)
      
      const row = stmt.get(repositoryId, type, key) as CacheEntry | undefined
      
      if (row) {
        return JSON.parse(row.data)
      }
      
      return null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  // Set cache data with TTL
  static async set(
    repositoryId: string, 
    type: string, 
    key: string, 
    data: any, 
    ttlHours: number = 1
  ): Promise<void> {
    try {
      const expiresAt = addHours(new Date(), ttlHours).toISOString()
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO github_cache 
        (id, repository_id, cache_type, cache_key, data, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      
      stmt.run(
        generateId(),
        repositoryId,
        type,
        key,
        JSON.stringify(data),
        expiresAt
      )
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  // Clear expired cache entries
  static async cleanup(): Promise<void> {
    try {
      const stmt = db.prepare(`DELETE FROM github_cache WHERE expires_at < datetime('now')`)
      const result = stmt.run()
  
          } catch (error) {
        // Silent fail for cache cleanup
      }
  }

  // Clear all cache for a repository
  static async clearRepository(repositoryId: string): Promise<void> {
    try {
      const stmt = db.prepare(`DELETE FROM github_cache WHERE repository_id = ?`)
      stmt.run(repositoryId)
    } catch (error) {
      console.error('Cache clear repository error:', error)
    }
  }
} 