import { Hono } from 'hono'
import { verifyToken } from '../lib/auth.ts'
import { statements, generateId } from '../lib/database.ts'
import { GenerationsService } from '../services/generations.ts'
import { CacheService } from '../services/cache.ts'
import type { Variables } from '../types/index.ts'

const testRouter = new Hono<{ Variables: Variables }>()

// Simple JWT auth for testing (without GitHub)
const simpleAuth = async (c: any, next: any) => {
  try {
    const authHeader = c.req.header('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: { code: 'AUTH_001', message: 'Missing authorization header' }
      }, 401)
    }
    
    const token = authHeader.split(' ')[1]
    const payload = verifyToken(token)
    
    if (!payload) {
      return c.json({
        success: false,
        error: { code: 'AUTH_002', message: 'Invalid token' }
      }, 401)
    }
    
    const userRow = statements.getUserById.get(payload.userId) as any
    if (!userRow) {
      return c.json({
        success: false,
        error: { code: 'AUTH_003', message: 'User not found' }
      }, 401)
    }
    
    c.set('user', {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role
    })
    
    await next()
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'AUTH_004', message: 'Authentication error' }
    }, 500)
  }
}

// Test user profile
testRouter.get('/me', simpleAuth, async (c) => {
  const user = c.get('user')
  return c.json({
    success: true,
    data: user
  })
})

// Test creating a generation
testRouter.post('/generation', simpleAuth, async (c) => {
  try {
    const user = c.get('user')
    
    const generationId = await GenerationsService.createGeneration({
      userId: user.id,
      repositoryId: 'test-repo-id',
      branch: 'main',
      dateStart: '2025-01-01T00:00:00Z',
      dateEnd: '2025-01-07T00:00:00Z',
      settings: { type: 'test' }
    })
    
    return c.json({
      success: true,
      data: { id: generationId }
    })
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'TEST_001', message: 'Failed to create generation' }
    }, 500)
  }
})

// Test saving a generation
testRouter.post('/generation/:id/save', simpleAuth, async (c) => {
  try {
    const user = c.get('user')
    const generationId = c.req.param('id')
    
    const success = await GenerationsService.saveGeneration(user.id, generationId)
    
    return c.json({
      success,
      message: success ? 'Generation saved' : 'Generation not found'
    })
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'TEST_002', message: 'Failed to save generation' }
    }, 500)
  }
})

// Test getting saved generations
testRouter.get('/saved', simpleAuth, async (c) => {
  try {
    const user = c.get('user')
    const saved = await GenerationsService.getSavedGenerations(user.id)
    
    return c.json({
      success: true,
      data: saved
    })
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'TEST_003', message: 'Failed to get saved generations' }
    }, 500)
  }
})

// Test cache functionality
testRouter.post('/cache', async (c) => {
  try {
    // Set cache
    await CacheService.set('test-repo', 'commits', 'main:2025-01-01:2025-01-07', {
      commits: [{ sha: 'abc123', message: 'test commit' }]
    })
    
    // Get cache immediately after setting
    const cached = await CacheService.get('test-repo', 'commits', 'main:2025-01-01:2025-01-07')
    
    return c.json({
      success: true,
      data: { 
        cached,
        message: cached ? 'Cache hit' : 'Cache miss'
      }
    })
  } catch (error) {
    console.error('Cache test error:', error)
    return c.json({
      success: false,
      error: { 
        code: 'TEST_004', 
        message: `Cache test failed: ${error.message}` 
      }
    }, 500)
  }
})

// Test cache cleanup
testRouter.post('/cache/cleanup', async (c) => {
  try {
    await CacheService.cleanup()
    
    return c.json({
      success: true,
      message: 'Cache cleanup completed'
    })
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'TEST_005', message: 'Cache cleanup failed' }
    }, 500)
  }
})

export { testRouter } 