import { z } from 'zod'

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters')
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  password: z.string().min(6, 'Password must be at least 6 characters')
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
})

export const githubConnectSchema = z.object({
  code: z.string().min(1, 'GitHub authorization code is required')
})

// Repository schemas
export const repositoryUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional()
})

// Changelog generation schemas
export const changelogGenerationSchema = z.object({
  repositoryId: z.string().uuid('Invalid repository ID'),
  branch: z.string().min(1, 'Branch is required'),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  options: z.object({
    groupBy: z.enum(['type', 'author', 'component', 'chronological']).default('type'),
    includeBreakingChanges: z.boolean().default(true),
    includeBugFixes: z.boolean().default(true),
    includeFeatures: z.boolean().default(true),
    includeDocumentation: z.boolean().default(false),
    excludePatterns: z.array(z.string()).default([]),
    customPrompt: z.string().optional(),
    targetAudience: z.enum(['developers', 'end-users', 'technical', 'general']).default('developers')
  })
})

// Changelog CRUD schemas
export const createChangelogSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  repositoryId: z.string().uuid('Invalid repository ID'),
  branch: z.string().min(1, 'Branch is required'),
  dateRange: z.object({
    start: z.string().datetime('Invalid start date'),
    end: z.string().datetime('Invalid end date')
  }),
  sections: z.array(z.object({
    title: z.string().min(1, 'Section title is required'),
    order: z.number().int().min(0),
    changes: z.array(z.object({
      description: z.string().min(1, 'Change description is required'),
      type: z.enum(['feature', 'bugfix', 'breaking', 'enhancement', 'deprecation', 'security']),
      impact: z.enum(['major', 'minor', 'patch']),
      tags: z.array(z.string()).default([]),
      commits: z.array(z.string()).optional(),
      pullRequests: z.array(z.number()).optional(),
      author: z.string().optional(),
      affectedComponents: z.array(z.string()).optional(),
      migrationGuide: z.string().optional(),
      codeExamples: z.record(z.string()).optional()
    }))
  })).default([]),
  tags: z.array(z.string()).default([])
})

export const updateChangelogSchema = createChangelogSchema.partial()

// AI enhancement schemas
export const enhanceDescriptionSchema = z.object({
  description: z.string().min(1, 'Description is required').max(1000, 'Description too long')
})

export const suggestTagsSchema = z.object({
  description: z.string().min(1, 'Description is required').max(1000, 'Description too long')
})

// Query parameter schemas
const basePaginationSchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10')
})

export const paginationSchema = basePaginationSchema.transform(data => ({
  page: Math.max(1, data.page),
  limit: Math.min(Math.max(1, data.limit), 100) // Cap at 100 items per page
}))

export const changelogListSchema = basePaginationSchema.extend({
  status: z.enum(['draft', 'review', 'published', 'archived']).optional(),
  repositoryId: z.string().uuid().optional()
}).transform(data => ({
  page: Math.max(1, data.page),
  limit: Math.min(Math.max(1, data.limit), 100),
  status: data.status,
  repositoryId: data.repositoryId
}))

export const publicChangelogSchema = basePaginationSchema.extend({
  search: z.string().optional(),
  product: z.string().optional(),
  category: z.string().optional(),
  channel: z.string().optional()
}).transform(data => ({
  page: Math.max(1, data.page),
  limit: Math.min(Math.max(1, data.limit), 100),
  search: data.search,
  product: data.product,
  category: data.category,
  channel: data.channel
}))

// Search schemas
export const searchSchema = z.object({
  q: z.string().min(1, 'Query is required'),
  page: z.string().transform(Number).default('1'),
  pageSize: z.string().transform(Number).default('10'),
  tags: z.string().optional().transform(s => s ? s.split(',') : undefined),
  repositories: z.string().optional().transform(s => s ? s.split(',') : undefined),
  dateStart: z.string().datetime().optional(),
  dateEnd: z.string().datetime().optional()
})

// Validation middleware helper
export const validate = (schema: z.ZodSchema) => {
  return async (c: any, next: any) => {
    try {
      const contentType = c.req.header('content-type')
      
      let data: any
      if (contentType?.includes('application/json')) {
        data = await c.req.json()
      } else {
        // For query parameters
        data = Object.fromEntries(new URL(c.req.url).searchParams.entries())
      }
      
      const validated = schema.parse(data)
      c.set('validated', validated)
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          },
          timestamp: new Date().toISOString(),
          path: c.req.path
        }, 400)
      }
      throw error
    }
  }
}

// Response helpers
export const successResponse = <T>(data: T, message?: string) => ({
  data,
  success: true,
  ...(message && { message })
})

export const errorResponse = (code: string, message: string, details?: any) => ({
  success: false,
  error: {
    code,
    message,
    ...(details && { details })
  },
  timestamp: new Date().toISOString()
})

export const paginatedResponse = <T>(
  data: T[],
  page: number,
  limit: number,
  total: number
) => ({
  data,
  pagination: {
    page,
    limit,
    total,
    hasNext: page * limit < total,
    hasPrev: page > 1
  }
}) 