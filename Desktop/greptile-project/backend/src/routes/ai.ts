import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { auth } from '../lib/auth.ts'
import { changelogIntegrationService } from '../services/integration.ts'
import { GenerationsService } from '../services/generations.ts'
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

// Saved Generations Management

// Save a generation
aiRouter.post('/generate/:id/save', async (c) => {
  try {
    const user = c.get('user')!
    const generationId = c.req.param('id')
    
    const success = await GenerationsService.saveGeneration(user.id, generationId)
    
    if (!success) {
      return c.json({
        success: false,
        error: {
          code: 'AI_003',
          message: 'Failed to save generation or generation not found'
        }
      }, 404)
    }
    
    return c.json({
      success: true,
      message: 'Generation saved successfully'
    })
  } catch (error) {
    console.error('Save generation error:', error)
    return c.json({
      success: false,
      error: {
        code: 'AI_001',
        message: 'Failed to save generation'
      }
    }, 500)
  }
})

// Get saved generations for user
aiRouter.get('/saved', async (c) => {
  try {
    const user = c.get('user')!
    
    const savedGenerations = await GenerationsService.getSavedGenerations(user.id)
    
    return c.json({
      success: true,
      data: savedGenerations
    })
  } catch (error) {
    console.error('Get saved generations error:', error)
    return c.json({
      success: false,
      error: {
        code: 'AI_001',
        message: 'Failed to get saved generations'
      }
    }, 500)
  }
})

// Delete a saved generation
aiRouter.delete('/saved/:id', async (c) => {
  try {
    const user = c.get('user')!
    const generationId = c.req.param('id')
    
    const success = await GenerationsService.deleteGeneration(generationId, user.id)
    
    if (!success) {
      return c.json({
        success: false,
        error: {
          code: 'AI_003',
          message: 'Generation not found or not owned by user'
        }
      }, 404)
    }
    
    return c.json({
      success: true,
      message: 'Generation deleted successfully'
    })
  } catch (error) {
    console.error('Delete generation error:', error)
    return c.json({
      success: false,
      error: {
        code: 'AI_001',
        message: 'Failed to delete generation'
      }
    }, 500)
  }
})

export { aiRouter } 