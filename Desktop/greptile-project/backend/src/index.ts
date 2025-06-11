import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './lib/env.ts'
import { initializeDatabase } from './lib/database.ts'
import { auth, optionalAuth, requireRole } from './lib/auth.ts'
import { 
  validate, 
  successResponse, 
  errorResponse,
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  changelogGenerationSchema,
  createChangelogSchema,
  updateChangelogSchema,
  enhanceDescriptionSchema,
  suggestTagsSchema,
  changelogListSchema,
  publicChangelogSchema
} from './lib/validation.ts'

// Import route handlers
import { authRouter } from './routes/auth.ts'
import { repositoriesRouter } from './routes/repositories.ts'
import { changelogsRouter } from './routes/changelogs.ts'
import { aiRouter } from './routes/ai.ts'
import { publicRouter } from './routes/public.ts'

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use('*', cors({
  origin: env.FRONTEND_URLS,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
}))

app.onError((err, c) => {
  const message = env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message
  
  return c.json(errorResponse('INTERNAL_ERROR', message), 500)
})

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: env.NODE_ENV
  })
})

// API Routes
app.route('/api/auth', authRouter)
app.route('/api/repositories', repositoriesRouter)
app.route('/api/changelogs', changelogsRouter)
app.route('/api/ai', aiRouter) // AI generation and enhancement routes
app.route('/api/public', publicRouter)

// 404 handler
app.notFound((c) => {
  return c.json(errorResponse('NOT_FOUND', 'Endpoint not found'), 404)
})

const initializeApp = async () => {
  try {
    initializeDatabase()
    
    const port = env.PORT
    console.log(`Server starting on port ${port} (${env.NODE_ENV})`)
    
    return {
      port,
      fetch: app.fetch,
    }
  } catch (error) {
    console.error('Failed to initialize application:', error)
    process.exit(1)
  }
}

// Initialize the app
const server = await initializeApp()

// Export for Bun
export default server

// Export for testing
export { app } 