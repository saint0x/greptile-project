import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { auth } from '../lib/auth.ts'
import { changelogIntegrationService } from '../services/integration.ts'
import type { Variables } from '../types/index.ts'

const aiRouter = new Hono<{ Variables: Variables }>()

// Validation schemas
const generateChangelogSchema = z.object({
  repositoryId: z.string().uuid(),
  branch: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  options: z.object({
    groupBy: z.enum(['type', 'author', 'component', 'chronological']).default('type'),
    includeBreakingChanges: z.boolean().default(true),
    includeBugFixes: z.boolean().default(true),
    includeFeatures: z.boolean().default(true),
    includeDocumentation: z.boolean().default(false),
    excludePatterns: z.array(z.string()).default([]),
    customPrompt: z.string().optional(),
    targetAudience: z.enum(['developers', 'end-users', 'technical', 'general']).default('end-users')
  })
})

const createChangelogSchema = z.object({
  generationId: z.string().uuid(),
  customizations: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional()
  }).optional()
})

const enhanceDescriptionSchema = z.object({
  description: z.string().min(1)
})

// Apply auth middleware to all routes
aiRouter.use('*', auth())

// Start changelog generation
aiRouter.post('/generate', zValidator('json', generateChangelogSchema), async (c) => {
  try {
    const user = c.get('user')!
    const request = c.req.valid('json')
    
    const generation = await changelogIntegrationService.startGeneration(user, request)
    
    return c.json({
      success: true,
      data: generation
    })
  } catch (error) {
    console.error('Generation start error:', error)
    return c.json({
      success: false,
      error: {
        code: 'AI_001',
        message: error instanceof Error ? error.message : 'Failed to start changelog generation'
      }
    }, 500)
  }
})

// Get generation status
aiRouter.get('/generate/:id', async (c) => {
  try {
    const id = c.req.param('id')
    
    const generation = changelogIntegrationService.getGeneration(id)
    if (!generation) {
      return c.json({
        success: false,
        error: {
          code: 'AI_002',
          message: 'Generation not found'
        }
      }, 404)
    }
    
    return c.json({
      success: true,
      data: generation
    })
  } catch (error) {
    console.error('Generation status error:', error)
    return c.json({
      success: false,
      error: {
        code: 'AI_001',
        message: 'Failed to get generation status'
      }
    }, 500)
  }
})

// Create changelog from generation
aiRouter.post('/generate/:id/create', zValidator('json', createChangelogSchema), async (c) => {
  try {
    const user = c.get('user')!
    const generationId = c.req.param('id')
    const { customizations } = c.req.valid('json')
    
    const changelog = await changelogIntegrationService.createChangelogFromGeneration(
      generationId,
      user.id,
      customizations
    )
    
    return c.json({
      success: true,
      data: changelog
    })
  } catch (error) {
    console.error('Changelog creation error:', error)
    return c.json({
      success: false,
      error: {
        code: 'AI_001',
        message: error instanceof Error ? error.message : 'Failed to create changelog'
      }
    }, 500)
  }
})

// Enhance description
aiRouter.post('/enhance-description', zValidator('json', enhanceDescriptionSchema), async (c) => {
  try {
    const { description } = c.req.valid('json')
    
    const result = await changelogIntegrationService.enhanceDescription(description)
    
    return c.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Description enhancement error:', error)
    return c.json({
      success: false,
      error: {
        code: 'AI_001',
        message: 'Failed to enhance description'
      }
    }, 500)
  }
})

// Suggest tags
aiRouter.post('/suggest-tags', zValidator('json', enhanceDescriptionSchema), async (c) => {
  try {
    const { description } = c.req.valid('json')
    
    const tags = await changelogIntegrationService.suggestTags(description)
    
    return c.json({
      success: true,
      data: { tags }
    })
  } catch (error) {
    console.error('Tag suggestion error:', error)
    return c.json({
      success: false,
      error: {
        code: 'AI_001',
        message: 'Failed to suggest tags'
      }
    }, 500)
  }
})

export { aiRouter } 