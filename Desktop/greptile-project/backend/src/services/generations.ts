import { db, generateId } from '../lib/database.ts'
import type { ChangelogGeneration } from '../types/index.ts'

interface SavedGeneration {
  id: string
  user_id: string
  repository_id: string
  branch: string
  date_start: string
  date_end: string
  status: string
  progress: number
  commits_data: string
  generated_content: string
  ai_metadata: string
  is_saved: boolean
  settings: string
  created_at: string
  updated_at: string
}

export class GenerationsService {
  // Save a generation for a user
  static async saveGeneration(
    userId: string,
    generationId: string
  ): Promise<boolean> {
    try {
      const stmt = db.prepare(`
        UPDATE ai_generations 
        SET is_saved = 1, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `)
      
      const result = stmt.run(generationId, userId)
      return result.changes > 0
    } catch (error) {
      console.error('Save generation error:', error)
      return false
    }
  }

  // Get saved generations for a user
  static async getSavedGenerations(userId: string): Promise<SavedGeneration[]> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM ai_generations 
        WHERE user_id = ? AND is_saved = 1
        ORDER BY created_at DESC
      `)
      
      return stmt.all(userId) as SavedGeneration[]
    } catch (error) {
      console.error('Get saved generations error:', error)
      return []
    }
  }

  // Get a specific generation
  static async getGeneration(generationId: string, userId?: string): Promise<SavedGeneration | null> {
    try {
      const stmt = userId 
        ? db.prepare(`SELECT * FROM ai_generations WHERE id = ? AND user_id = ?`)
        : db.prepare(`SELECT * FROM ai_generations WHERE id = ?`)
      
      const params = userId ? [generationId, userId] : [generationId]
      return stmt.get(...params) as SavedGeneration | null
    } catch (error) {
      console.error('Get generation error:', error)
      return null
    }
  }

  // Create a new generation record
  static async createGeneration(data: {
    userId: string
    repositoryId: string
    branch: string
    dateStart: string
    dateEnd: string
    settings: any
  }): Promise<string> {
    try {
      const id = generateId()
      const stmt = db.prepare(`
        INSERT INTO ai_generations (
          id, user_id, repository_id, branch, date_start, date_end, 
          status, settings, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'processing', ?, datetime('now'), datetime('now'))
      `)
      
      stmt.run(
        id,
        data.userId,
        data.repositoryId,
        data.branch,
        data.dateStart,
        data.dateEnd,
        JSON.stringify(data.settings)
      )
      
      return id
    } catch (error) {
      console.error('Create generation error:', error)
      throw error
    }
  }

  // Update generation with results
  static async updateGeneration(
    generationId: string,
    data: {
      status?: string
      progress?: number
      commitsData?: any[]
      generatedContent?: any
      aiMetadata?: any
    }
  ): Promise<boolean> {
    try {
      const updates: string[] = []
      const values: any[] = []

      if (data.status !== undefined) {
        updates.push('status = ?')
        values.push(data.status)
      }
      if (data.progress !== undefined) {
        updates.push('progress = ?')
        values.push(data.progress)
      }
      if (data.commitsData !== undefined) {
        updates.push('commits_data = ?')
        values.push(JSON.stringify(data.commitsData))
      }
      if (data.generatedContent !== undefined) {
        updates.push('generated_content = ?')
        values.push(JSON.stringify(data.generatedContent))
      }
      if (data.aiMetadata !== undefined) {
        updates.push('ai_metadata = ?')
        values.push(JSON.stringify(data.aiMetadata))
      }

      updates.push('updated_at = datetime(\'now\')')
      values.push(generationId)

      const stmt = db.prepare(`
        UPDATE ai_generations 
        SET ${updates.join(', ')}
        WHERE id = ?
      `)
      
      const result = stmt.run(...values)
      return result.changes > 0
    } catch (error) {
      console.error('Update generation error:', error)
      return false
    }
  }

  // Delete a saved generation
  static async deleteGeneration(generationId: string, userId: string): Promise<boolean> {
    try {
      const stmt = db.prepare(`
        DELETE FROM ai_generations 
        WHERE id = ? AND user_id = ?
      `)
      
      const result = stmt.run(generationId, userId)
      return result.changes > 0
    } catch (error) {
      console.error('Delete generation error:', error)
      return false
    }
  }
} 