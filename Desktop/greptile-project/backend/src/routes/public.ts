import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../lib/database.ts'

const publicRouter = new Hono()

// Validation schemas
const publicQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1).max(50)).default('20'),
  search: z.string().optional(),
  tags: z.string().optional(),
  repository: z.string().optional(),
  sortBy: z.enum(['publishedAt', 'version', 'title']).default('publishedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1).max(50)).default('20')
})

// GET /public/changelogs - List published changelogs
publicRouter.get(
  '/changelogs',
  zValidator('query', publicQuerySchema),
  async (c) => {
    const { page, limit, search, tags, repository, sortBy, sortOrder } = c.req.valid('query')

    try {
      const offset = (page - 1) * limit
      
      // Build WHERE conditions
      const conditions: string[] = ['c.status = ?']
      const params: any[] = ['published']

      if (search) {
        conditions.push('(c.title LIKE ? OR c.description LIKE ? OR c.version LIKE ?)')
        const searchPattern = `%${search}%`
        params.push(searchPattern, searchPattern, searchPattern)
      }

      if (tags) {
        const tagList = tags.split(',').map(tag => tag.trim())
        const tagConditions = tagList.map(() => 'json_extract(c.tags, "$") LIKE ?').join(' OR ')
        conditions.push(`(${tagConditions})`)
        tagList.forEach(tag => params.push(`%"${tag}"%`))
      }

      if (repository) {
        conditions.push('(r.name LIKE ? OR r.full_name LIKE ?)')
        const repoPattern = `%${repository}%`
        params.push(repoPattern, repoPattern)
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`

      // Count total
      const countStmt = db.prepare(`
        SELECT COUNT(*) as total
        FROM changelogs c
        JOIN repositories r ON c.repository_id = r.id
        ${whereClause}
      `)
      const { total } = countStmt.get(...params) as { total: number }

      // Fetch changelogs
      const orderByClause = sortBy === 'publishedAt' ? 'c.published_at' : 
                          sortBy === 'version' ? 'c.version' : 'c.title'

      const stmt = db.prepare(`
        SELECT 
          c.id,
          c.version,
          c.title,
          c.description,
          c.branch,
          c.date_start,
          c.date_end,
          c.published_at,
          c.tags,
          r.name as repository_name,
          r.full_name as repository_full_name,
          r.owner as repository_owner
        FROM changelogs c
        JOIN repositories r ON c.repository_id = r.id
        ${whereClause}
        ORDER BY ${orderByClause} ${sortOrder.toUpperCase()}
        LIMIT ? OFFSET ?
      `)

      const changelogs = stmt.all(...params, limit, offset) as any[]

      // Transform data
      const formattedChangelogs = changelogs.map(changelog => ({
        id: changelog.id,
        version: changelog.version,
        title: changelog.title,
        description: changelog.description,
        repository: {
          name: changelog.repository_name,
          fullName: changelog.repository_full_name,
          owner: changelog.repository_owner
        },
        branch: changelog.branch,
        dateRange: {
          start: changelog.date_start,
          end: changelog.date_end
        },
        publishedAt: changelog.published_at,
        tags: changelog.tags ? JSON.parse(changelog.tags) : []
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
      console.error('Public changelogs error:', error)
      return c.json({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch changelogs' }
      }, 500)
    }
  }
)

// GET /public/changelogs/:id - Get published changelog details
publicRouter.get(
  '/changelogs/:id',
  async (c) => {
    const changelogId = c.req.param('id')

    try {
      // Get changelog
      const stmt = db.prepare(`
        SELECT 
          c.*,
          r.name as repository_name,
          r.full_name as repository_full_name,
          r.owner as repository_owner
        FROM changelogs c
        JOIN repositories r ON c.repository_id = r.id
        WHERE c.id = ? AND c.status = 'published'
      `)

      const changelog = stmt.get(changelogId) as any

      if (!changelog) {
        return c.json({
          success: false,
          error: { code: 'CHANGELOG_NOT_FOUND', message: 'Published changelog not found' }
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
        title: section.title,
        changes: changesStmt.all(section.id).map((change: any) => ({
          description: change.description,
          type: change.type,
          impact: change.impact,
          tags: change.tags ? JSON.parse(change.tags) : [],
          migrationGuide: change.migration_guide,
          codeExamples: change.code_examples ? JSON.parse(change.code_examples) : {}
        }))
      }))

      // Track view
      try {
        const updateViewStmt = db.prepare(`
          UPDATE changelogs 
          SET metadata = json_set(
            COALESCE(metadata, '{}'), 
            '$.views', 
            COALESCE(json_extract(metadata, '$.views'), 0) + 1
          )
          WHERE id = ?
        `)
        updateViewStmt.run(changelogId)
      } catch (viewError) {
        console.warn('Failed to track view:', viewError)
      }

      return c.json({
        success: true,
        data: {
          id: changelog.id,
          version: changelog.version,
          title: changelog.title,
          description: changelog.description,
          repository: {
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
          publishedAt: changelog.published_at,
          tags: changelog.tags ? JSON.parse(changelog.tags) : []
        }
      })
    } catch (error) {
      console.error('Get public changelog error:', error)
      return c.json({
        success: false,
        error: { code: 'FETCH_FAILED', message: 'Failed to fetch changelog' }
      }, 500)
    }
  }
)

// GET /public/search - Search changelogs
publicRouter.get(
  '/search',
  zValidator('query', searchQuerySchema),
  async (c) => {
    const { q, page, limit } = c.req.valid('query')

    try {
      const offset = (page - 1) * limit
      const searchPattern = `%${q}%`

      const stmt = db.prepare(`
        SELECT 
          c.id,
          c.version,
          c.title,
          c.description,
          c.published_at,
          c.tags,
          r.name as repository_name,
          r.full_name as repository_full_name,
          r.owner as repository_owner
        FROM changelogs c
        JOIN repositories r ON c.repository_id = r.id
        WHERE c.status = 'published' AND (
          c.title LIKE ? OR 
          c.description LIKE ? OR 
          c.version LIKE ? OR 
          r.name LIKE ? OR
          r.full_name LIKE ?
        )
        ORDER BY c.published_at DESC
        LIMIT ? OFFSET ?
      `)

      const results = stmt.all(
        searchPattern, searchPattern, searchPattern, searchPattern, searchPattern,
        limit, offset
      ) as any[]

      // Count total results
      const countStmt = db.prepare(`
        SELECT COUNT(*) as total
        FROM changelogs c
        JOIN repositories r ON c.repository_id = r.id
        WHERE c.status = 'published' AND (
          c.title LIKE ? OR 
          c.description LIKE ? OR 
          c.version LIKE ? OR 
          r.name LIKE ? OR
          r.full_name LIKE ?
        )
      `)

      const { total } = countStmt.get(
        searchPattern, searchPattern, searchPattern, searchPattern, searchPattern
      ) as { total: number }

      const formattedResults = results.map(result => ({
        id: result.id,
        version: result.version,
        title: result.title,
        description: result.description,
        repository: {
          name: result.repository_name,
          fullName: result.repository_full_name,
          owner: result.repository_owner
        },
        publishedAt: result.published_at,
        tags: result.tags ? JSON.parse(result.tags) : []
      }))

      return c.json({
        success: true,
        data: {
          query: q,
          results: formattedResults,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      })
    } catch (error) {
      console.error('Search error:', error)
      return c.json({
        success: false,
        error: { code: 'SEARCH_FAILED', message: 'Search failed' }
      }, 500)
    }
  }
)

// GET /public/tags - Get available tags
publicRouter.get('/tags', async (c) => {
  try {
    const stmt = db.prepare(`
      SELECT DISTINCT json_each.value as tag, COUNT(*) as count
      FROM changelogs c, json_each(c.tags)
      WHERE c.status = 'published'
      GROUP BY json_each.value
      ORDER BY count DESC, tag ASC
      LIMIT 100
    `)

    const tags = stmt.all() as { tag: string; count: number }[]

    return c.json({
      success: true,
      data: { tags }
    })
  } catch (error) {
    console.error('Get tags error:', error)
    return c.json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch tags' }
    }, 500)
  }
})

// GET /public/repositories - Get public repositories
publicRouter.get('/repositories', async (c) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        r.name,
        r.full_name,
        r.owner,
        r.description,
        COUNT(c.id) as changelog_count,
        MAX(c.published_at) as latest_changelog
      FROM repositories r
      LEFT JOIN changelogs c ON r.id = c.repository_id AND c.status = 'published'
      GROUP BY r.id, r.name, r.full_name, r.owner, r.description
      HAVING changelog_count > 0
      ORDER BY changelog_count DESC, latest_changelog DESC
    `)

    const repositories = stmt.all() as any[]

    const formattedRepositories = repositories.map(repo => ({
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner,
      description: repo.description,
      changelogCount: repo.changelog_count,
      latestChangelog: repo.latest_changelog
    }))

    return c.json({
      success: true,
      data: { repositories: formattedRepositories }
    })
  } catch (error) {
    console.error('Get repositories error:', error)
    return c.json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch repositories' }
    }, 500)
  }
})

// GET /public/trending - Get trending changelogs (most viewed in last 30 days)
publicRouter.get('/trending', async (c) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        c.id,
        c.version,
        c.title,
        c.description,
        c.published_at,
        c.tags,
        r.name as repository_name,
        r.full_name as repository_full_name,
        r.owner as repository_owner,
        COALESCE(json_extract(c.metadata, '$.views'), 0) as views
      FROM changelogs c
      JOIN repositories r ON c.repository_id = r.id
      WHERE c.status = 'published' 
        AND c.published_at > datetime('now', '-30 days')
      ORDER BY views DESC, c.published_at DESC
      LIMIT 20
    `)

    const trending = stmt.all() as any[]

    const formattedTrending = trending.map(changelog => ({
      id: changelog.id,
      version: changelog.version,
      title: changelog.title,
      description: changelog.description,
      repository: {
        name: changelog.repository_name,
        fullName: changelog.repository_full_name,
        owner: changelog.repository_owner
      },
      publishedAt: changelog.published_at,
      tags: changelog.tags ? JSON.parse(changelog.tags) : [],
      views: changelog.views
    }))

    return c.json({
      success: true,
      data: { trending: formattedTrending }
    })
  } catch (error) {
    console.error('Get trending error:', error)
    return c.json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch trending changelogs' }
    }, 500)
  }
})

// GET /public/rss - RSS feed for latest changelogs
publicRouter.get('/rss', async (c) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        c.id,
        c.version,
        c.title,
        c.description,
        c.published_at,
        r.name as repository_name,
        r.full_name as repository_full_name,
        r.owner as repository_owner
      FROM changelogs c
      JOIN repositories r ON c.repository_id = r.id
      WHERE c.status = 'published'
      ORDER BY c.published_at DESC
      LIMIT 50
    `)

    const changelogs = stmt.all() as any[]

    // Generate RSS XML
    const rssItems = changelogs.map(changelog => `
      <item>
        <title><![CDATA[${changelog.repository_name} ${changelog.version}: ${changelog.title}]]></title>
        <link>https://your-domain.com/changelog/${changelog.id}</link>
        <guid>https://your-domain.com/changelog/${changelog.id}</guid>
        <pubDate>${new Date(changelog.published_at).toUTCString()}</pubDate>
        <description><![CDATA[${changelog.description || ''}]]></description>
        <category>${changelog.repository_full_name}</category>
      </item>
    `).join('')

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Latest Changelogs</title>
        <description>Stay updated with the latest software changes</description>
        <link>https://your-domain.com</link>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        ${rssItems}
      </channel>
    </rss>`

    c.header('Content-Type', 'application/rss+xml')
    return c.text(rss)
  } catch (error) {
    console.error('RSS feed error:', error)
    return c.text('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Error</title></channel></rss>', 500)
  }
})

// Helper function to get section counts
async function getSectionCounts(changelogIds: string[]): Promise<Record<string, number>> {
  if (changelogIds.length === 0) return {}
  
  const placeholders = changelogIds.map(() => '?').join(',')
  const stmt = db.prepare(`
    SELECT changelog_id, COUNT(*) as count
    FROM changelog_sections
    WHERE changelog_id IN (${placeholders})
    GROUP BY changelog_id
  `)
  
  const results = stmt.all(...changelogIds) as { changelog_id: string; count: number }[]
  
  return results.reduce((acc, result) => {
    acc[result.changelog_id] = result.count
    return acc
  }, {} as Record<string, number>)
}

export { publicRouter } 