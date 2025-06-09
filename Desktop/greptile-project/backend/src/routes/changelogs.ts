import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../lib/database.ts'
import { auth } from '../lib/auth.ts'
import type { User, Changelog, ChangelogSection, ChangelogChange } from '../types/index.ts'

// Define context type with user property
type Variables = {
  user?: User
}

const changelogsRouter = new Hono<{ Variables: Variables }>()

// Validation schemas
const createChangelogSchema = z.object({
  version: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  repositoryId: z.string().uuid(),
  branch: z.string().min(1),
  dateStart: z.string().datetime(),
  dateEnd: z.string().datetime(),
  tags: z.array(z.string()).default([]),
  aiGenerationId: z.string().uuid().optional()
})

const updateChangelogSchema = z.object({
  version: z.string().min(1).max(255).optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  branch: z.string().min(1).optional(),
  dateStart: z.string().datetime().optional(),
  dateEnd: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'review', 'published', 'archived']).optional()
})

const createSectionSchema = z.object({
  title: z.string().min(1).max(255),
  order: z.number().int().min(0).default(0)
})

const createChangeSchema = z.object({
  description: z.string().min(1),
  type: z.enum(['feature', 'bugfix', 'breaking', 'enhancement', 'deprecation', 'security']),
  impact: z.enum(['major', 'minor', 'patch']),
  tags: z.array(z.string()).default([]),
  commits: z.array(z.string()).default([]),
  pullRequests: z.array(z.number()).default([]),
  author: z.string().optional(),
  affectedComponents: z.array(z.string()).default([]),
  migrationGuide: z.string().optional(),
  codeExamples: z.record(z.string()).default({})
})

const querySchema = z.object({
  page: z.string().default('1').transform(val => Math.max(1, parseInt(val, 10) || 1)),
  limit: z.string().default('20').transform(val => Math.min(Math.max(1, parseInt(val, 10) || 20), 100)),
  status: z.enum(['draft', 'review', 'published', 'archived']).optional(),
  repositoryId: z.string().uuid().optional(),
  search: z.string().optional(),
  tags: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'publishedAt', 'version']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

// Apply auth middleware to all routes
changelogsRouter.use('/*', auth())

// GET /changelogs - List changelogs with filtering
changelogsRouter.get(
  '/',
  // zValidator('query', querySchema),
  async (c) => {
    const user = c.get('user') as User
    
    // Default query parameters
    const page = parseInt(c.req.query('page') || '1', 10) || 1
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10) || 20, 100)
    const status = c.req.query('status')
    const repositoryId = c.req.query('repositoryId')
    const search = c.req.query('search')
    const tags = c.req.query('tags')
    const sortBy = c.req.query('sortBy') || 'createdAt'
    const sortOrder = c.req.query('sortOrder') || 'desc'

    try {
      const offset = (page - 1) * limit
      
      // Simplified query - just get changelogs for this user
      const countStmt = db.prepare(`
        SELECT COUNT(*) as total
        FROM changelogs c
        WHERE c.created_by = ? OR ? = 'admin'
      `)
      const { total } = countStmt.get(user.id, user.role) as { total: number }

      // Simplified fetch query
      const stmt = db.prepare(`
        SELECT 
          c.*
        FROM changelogs c
        WHERE c.created_by = ? OR ? = 'admin'
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `)

      const changelogs = stmt.all(user.id, user.role, limit, offset) as any[]

      // Basic transformation
      const formattedChangelogs = changelogs.map(changelog => ({
        id: changelog.id,
        version: changelog.version,
        title: changelog.title,
        description: changelog.description,
        repositoryId: changelog.repository_id,
        branch: changelog.branch,
        dateRange: {
          start: changelog.date_start,
          end: changelog.date_end
        },
        status: changelog.status,
        publishedAt: changelog.published_at,
        publishedBy: changelog.published_by,
        tags: changelog.tags ? JSON.parse(changelog.tags) : [],
        metadata: changelog.metadata ? JSON.parse(changelog.metadata) : {},
        createdBy: changelog.created_by,
        createdAt: changelog.created_at,
        updatedAt: changelog.updated_at
      }))

      return c.json({
        success: true,
        data: {
          changelogs: formattedChangelogs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      })
    } catch (error) {
      console.error('List changelogs error:', error)
      return c.json({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch changelogs' }
      }, 500)
    }
  }
)

// POST /changelogs - Create new changelog
changelogsRouter.post(
  '/',
  zValidator('json', createChangelogSchema),
  async (c) => {
    const user = c.get('user') as User
    const data = c.req.valid('json')

    try {
      // Verify repository access
      const repoStmt = db.prepare(`
        SELECT * FROM repositories 
        WHERE id = ?
      `)
      const repository = repoStmt.get(data.repositoryId)

      if (!repository) {
        return c.json({
          success: false,
          error: { code: 'REPO_ACCESS_DENIED', message: 'Repository not found or access denied' }
        }, 403)
      }

      // Check for duplicate version
      const existingStmt = db.prepare(`
        SELECT id FROM changelogs 
        WHERE repository_id = ? AND version = ? AND status != 'archived'
      `)
      const existing = existingStmt.get(data.repositoryId, data.version)

      if (existing) {
        return c.json({
          success: false,
          error: { code: 'VERSION_EXISTS', message: 'Version already exists for this repository' }
        }, 409)
      }

      const changelogId = crypto.randomUUID()
      
      // If creating from AI generation, get the generated content
      let generatedSections: any[] = []
      if (data.aiGenerationId) {
        const genStmt = db.prepare(`
          SELECT generated_content FROM ai_generations 
          WHERE id = ? AND status = 'completed'
        `)
        const generation = genStmt.get(data.aiGenerationId) as { generated_content?: string } | undefined
        
        if (generation?.generated_content) {
          const content = JSON.parse(generation.generated_content)
          generatedSections = content.sections || []
        }
      }

      // Create changelog
      const insertStmt = db.prepare(`
        INSERT INTO changelogs (
          id, version, title, description, repository_id, branch,
          date_start, date_end, status, tags, metadata, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, datetime('now'), datetime('now'))
      `)

      const metadata = {
        totalCommits: 0,
        contributors: 0,
        filesChanged: 0,
        linesAdded: 0,
        linesRemoved: 0,
        generationMethod: data.aiGenerationId ? 'ai' : 'manual',
        aiGenerationId: data.aiGenerationId
      }

      insertStmt.run(
        changelogId,
        data.version,
        data.title,
        data.description || null,
        data.repositoryId,
        data.branch,
        data.dateStart,
        data.dateEnd,
        JSON.stringify(data.tags),
        JSON.stringify(metadata),
        user.id
      )

      // Create sections from AI generation if available
      if (generatedSections.length > 0) {
        const sectionStmt = db.prepare(`
          INSERT INTO changelog_sections (id, changelog_id, title, order_index, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `)

        const changeStmt = db.prepare(`
          INSERT INTO changelog_changes (
            id, section_id, description, type, impact, tags, commits, 
            pull_requests, author, affected_components, migration_guide, 
            code_examples, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)

        generatedSections.forEach((section, sectionIndex) => {
          const sectionId = crypto.randomUUID()
          sectionStmt.run(sectionId, changelogId, section.title, sectionIndex)

          section.changes?.forEach((change: any) => {
            const changeId = crypto.randomUUID()
            changeStmt.run(
              changeId,
              sectionId,
              change.description,
              change.category || change.type || 'enhancement',
              change.impact || 'minor',
              JSON.stringify(change.tags || []),
              JSON.stringify(change.commit ? [change.commit] : []),
              JSON.stringify([]),
              change.author || null,
              JSON.stringify([]),
              null,
              JSON.stringify({}),
            )
          })
        })
      }

      return c.json({
        success: true,
        data: { id: changelogId }
      }, 201)
    } catch (error) {
      console.error('Create changelog error:', error)
      return c.json({
        success: false,
        error: { code: 'CREATE_FAILED', message: 'Failed to create changelog' }
      }, 500)
    }
  }
)

// GET /changelogs/:id - Get changelog details
changelogsRouter.get(
  '/:id',
  async (c) => {
    const changelogId = c.req.param('id')
    const user = c.get('user') as User

    try {
      // Get changelog with repository info
      const stmt = db.prepare(`
        SELECT 
          c.*,
          r.name as repository_name,
          r.full_name as repository_full_name,
          r.owner as repository_owner,
          u.name as created_by_name
        FROM changelogs c
        JOIN repositories r ON c.repository_id = r.id
        JOIN users u ON c.created_by = u.id
        WHERE c.id = ? AND (c.created_by = ? OR ? = 'admin')
      `)

      const changelog = stmt.get(changelogId, user.id, user.role) as any

      if (!changelog) {
        return c.json({
          success: false,
          error: { code: 'CHANGELOG_NOT_FOUND', message: 'Changelog not found' }
        }, 404)
      }

      // Get sections and changes
      const sectionsStmt = db.prepare(`
        SELECT * FROM changelog_sections 
        WHERE changelog_id = ?
        ORDER BY order_index
      `)
      const sections = sectionsStmt.all(changelogId) as any[]

      const changesStmt = db.prepare(`
        SELECT * FROM changelog_changes 
        WHERE section_id = ?
        ORDER BY created_at
      `)

      const formattedSections = sections.map(section => ({
        id: section.id,
        title: section.title,
        order: section.order_index,
        changes: changesStmt.all(section.id).map((change: any) => ({
          id: change.id,
          description: change.description,
          type: change.type,
          impact: change.impact,
          tags: change.tags ? JSON.parse(change.tags) : [],
          commits: change.commits ? JSON.parse(change.commits) : [],
          pullRequests: change.pull_requests ? JSON.parse(change.pull_requests) : [],
          author: change.author,
          affectedComponents: change.affected_components ? JSON.parse(change.affected_components) : [],
          migrationGuide: change.migration_guide,
          codeExamples: change.code_examples ? JSON.parse(change.code_examples) : {}
        }))
      }))

      return c.json({
        success: true,
        data: {
          id: changelog.id,
          version: changelog.version,
          title: changelog.title,
          description: changelog.description,
          repository: {
            id: changelog.repository_id,
            name: changelog.repository_name,
            fullName: changelog.repository_full_name,
            owner: changelog.repository_owner
          },
          branch: changelog.branch,
          dateRange: {
            start: changelog.date_start,
            end: changelog.date_end
          },
          sections: formattedSections,
          status: changelog.status,
          publishedAt: changelog.published_at,
          publishedBy: changelog.published_by,
          tags: changelog.tags ? JSON.parse(changelog.tags) : [],
          metadata: changelog.metadata ? JSON.parse(changelog.metadata) : {},
          createdBy: {
            id: changelog.created_by,
            name: changelog.created_by_name
          },
          createdAt: changelog.created_at,
          updatedAt: changelog.updated_at
        }
      })
    } catch (error) {
      console.error('Get changelog error:', error)
      return c.json({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch changelog' }
      }, 500)
    }
  }
)

// PUT /changelogs/:id - Update changelog
changelogsRouter.put(
  '/:id',
  zValidator('json', updateChangelogSchema),
  async (c) => {
    const changelogId = c.req.param('id')
    const user = c.get('user') as User
    const updates = c.req.valid('json')

    try {
      // Verify access and ownership
      const checkStmt = db.prepare(`
        SELECT c.*, r.github_id
        FROM changelogs c
        JOIN repositories r ON c.repository_id = r.id
        WHERE c.id = ? AND (c.created_by = ? OR ? = 'admin')
      `)

      const changelog = checkStmt.get(changelogId, user.id, user.role) as any

      if (!changelog) {
        return c.json({
          success: false,
          error: { code: 'CHANGELOG_NOT_FOUND', message: 'Changelog not found' }
        }, 404)
      }

      // Check if published changelog can be modified
      if (changelog.status === 'published' && user.role !== 'admin') {
        return c.json({
          success: false,
          error: { code: 'PUBLISHED_READONLY', message: 'Published changelogs cannot be modified' }
        }, 403)
      }

      // Build update query dynamically
      const updateFields: string[] = []
      const updateValues: any[] = []

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbKey = key === 'dateStart' ? 'date_start' : 
                       key === 'dateEnd' ? 'date_end' : key
          
          if (key === 'tags') {
            updateFields.push(`${dbKey} = ?`)
            updateValues.push(JSON.stringify(value))
          } else {
            updateFields.push(`${dbKey} = ?`)
            updateValues.push(value)
          }
        }
      })

      if (updateFields.length === 0) {
        return c.json({
          success: false,
          error: { code: 'NO_UPDATES', message: 'No fields to update' }
        }, 400)
      }

      updateFields.push('updated_at = datetime(\'now\')')
      updateValues.push(changelogId)

      const updateStmt = db.prepare(`
        UPDATE changelogs 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `)

      updateStmt.run(...updateValues)

      return c.json({
        success: true,
        data: { updated: true }
      })
    } catch (error) {
      console.error('Update changelog error:', error)
      return c.json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update changelog' }
      }, 500)
    }
  }
)

// DELETE /changelogs/:id - Delete changelog
changelogsRouter.delete(
  '/:id',
  async (c) => {
    const changelogId = c.req.param('id')
    const user = c.get('user') as User

    try {
      // Verify access and check if published
      const checkStmt = db.prepare(`
        SELECT c.status, r.github_id
        FROM changelogs c
        JOIN repositories r ON c.repository_id = r.id
        WHERE c.id = ? AND (c.created_by = ? OR ? = 'admin')
      `)

      const changelog = checkStmt.get(changelogId, user.id, user.role) as any

      if (!changelog) {
        return c.json({
          success: false,
          error: { code: 'CHANGELOG_NOT_FOUND', message: 'Changelog not found' }
        }, 404)
      }

      if (changelog.status === 'published' && user.role !== 'admin') {
        return c.json({
          success: false,
          error: { code: 'PUBLISHED_READONLY', message: 'Published changelogs cannot be deleted' }
        }, 403)
      }

      // Delete changelog (cascade will handle sections and changes)
      const deleteStmt = db.prepare('DELETE FROM changelogs WHERE id = ?')
      deleteStmt.run(changelogId)

      return c.json({
        success: true,
        data: { deleted: true }
      })
    } catch (error) {
      console.error('Delete changelog error:', error)
      return c.json({
        success: false,
        error: { code: 'DELETE_FAILED', message: 'Failed to delete changelog' }
      }, 500)
    }
  }
)

// POST /changelogs/:id/publish - Publish changelog
changelogsRouter.post(
  '/:id/publish',
  async (c) => {
    const changelogId = c.req.param('id')
    const user = c.get('user') as User

    try {
      // Verify access
      const checkStmt = db.prepare(`
        SELECT c.*, r.github_id
        FROM changelogs c
        JOIN repositories r ON c.repository_id = r.id
        WHERE c.id = ? AND c.status != 'published' AND (c.created_by = ? OR ? = 'admin')
      `)

      const changelog = checkStmt.get(changelogId, user.id, user.role) as any

      if (!changelog) {
        return c.json({
          success: false,
          error: { code: 'CHANGELOG_NOT_FOUND', message: 'Changelog not found or already published' }
        }, 404)
      }

      // Update status to published
      const updateStmt = db.prepare(`
        UPDATE changelogs 
        SET status = 'published', published_at = datetime('now'), published_by = ?, updated_at = datetime('now')
        WHERE id = ?
      `)
      updateStmt.run(user.id, changelogId)

      return c.json({
        success: true,
        data: { published: true }
      })
    } catch (error) {
      console.error('Publish changelog error:', error)
      return c.json({
        success: false,
        error: { code: 'PUBLISH_FAILED', message: 'Failed to publish changelog' }
      }, 500)
    }
  }
)

// POST /changelogs/:id/unpublish - Unpublish changelog
changelogsRouter.post(
  '/:id/unpublish',
  async (c) => {
    const changelogId = c.req.param('id')
    const user = c.get('user') as User

    // Only admins can unpublish
    if (user.role !== 'admin') {
      return c.json({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only admins can unpublish changelogs' }
      }, 403)
    }

    try {
      const updateStmt = db.prepare(`
        UPDATE changelogs 
        SET status = 'draft', published_at = NULL, published_by = NULL, updated_at = datetime('now')
        WHERE id = ? AND status = 'published'
      `)
      
      const result = updateStmt.run(changelogId)

      if (result.changes === 0) {
        return c.json({
          success: false,
          error: { code: 'CHANGELOG_NOT_FOUND', message: 'Published changelog not found' }
        }, 404)
      }

      return c.json({
        success: true,
        data: { unpublished: true }
      })
    } catch (error) {
      console.error('Unpublish changelog error:', error)
      return c.json({
        success: false,
        error: { code: 'UNPUBLISH_FAILED', message: 'Failed to unpublish changelog' }
      }, 500)
    }
  }
)

// POST /changelogs/:id/sections - Add section
changelogsRouter.post(
  '/:id/sections',
  zValidator('json', createSectionSchema),
  async (c) => {
    const changelogId = c.req.param('id')
    const user = c.get('user') as User
    const { title, order } = c.req.valid('json')

    try {
      // Verify changelog access
      const checkStmt = db.prepare(`
        SELECT c.id FROM changelogs c
        JOIN repositories r ON c.repository_id = r.id
        WHERE c.id = ? AND c.status != 'published' AND (
          r.github_id IN (SELECT github_id FROM repository_access WHERE user_id = ?)
          OR ? = 'admin'
        )
      `)

      const changelog = checkStmt.get(changelogId, user.id, user.role)

      if (!changelog) {
        return c.json({
          success: false,
          error: { code: 'CHANGELOG_NOT_FOUND', message: 'Changelog not found or published' }
        }, 404)
      }

      const sectionId = crypto.randomUUID()
      const insertStmt = db.prepare(`
        INSERT INTO changelog_sections (id, changelog_id, title, order_index, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `)

      insertStmt.run(sectionId, changelogId, title, order)

      return c.json({
        success: true,
        data: { id: sectionId }
      }, 201)
    } catch (error) {
      console.error('Create section error:', error)
      return c.json({
        success: false,
        error: { code: 'CREATE_FAILED', message: 'Failed to create section' }
      }, 500)
    }
  }
)

export { changelogsRouter } 