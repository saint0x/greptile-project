import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { 
  generateTokens, 
  createUser, 
  authenticateUser, 
  verifyToken,
  auth,
  encrypt,
  decrypt
} from '../lib/auth.ts'
import { 
  successResponse, 
  errorResponse,
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  githubConnectSchema
} from '../lib/validation.ts'
import { env, features } from '../lib/env.ts'
import { db } from '../lib/database.ts'
import type { User, UserRow } from '../types/index.ts'

// Define context type with user property
type Variables = {
  user?: User
}

export const authRouter = new Hono<{ Variables: Variables }>()

// POST /api/auth/register
authRouter.post('/register', zValidator('json', registerSchema), async (c) => {
  try {
    const { email, name, password } = c.req.valid('json')
    
    const userRow = await createUser(email, name, password) as UserRow
    const tokens = generateTokens(userRow.id)
    
    const user: User = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      githubUsername: userRow.github_username,
      role: userRow.role as 'admin' | 'developer' | 'viewer',
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at
    }
    
    return c.json(successResponse({ user, tokens }, 'User registered successfully'))
  } catch (error: any) {
    console.error('Registration error:', error)
    
    if (error.message === 'User already exists') {
      return c.json(errorResponse('USER_EXISTS', 'User with this email already exists'), 409)
    }
    
    return c.json(errorResponse('REGISTRATION_FAILED', 'Failed to register user'), 500)
  }
})

// POST /api/auth/login
authRouter.post('/login', zValidator('json', loginSchema), async (c) => {
  try {
    const { email, password } = c.req.valid('json')
    
    const user = await authenticateUser(email, password)
    const tokens = generateTokens(user.id)
    
    return c.json(successResponse({ user, tokens }, 'Login successful'))
  } catch (error: any) {
    console.error('Login error:', error)
    
    if (error.message === 'Invalid credentials') {
      return c.json(errorResponse('AUTH_001', 'Invalid email or password'), 401)
    }
    
    return c.json(errorResponse('LOGIN_FAILED', 'Login failed'), 500)
  }
})

// POST /api/auth/refresh
authRouter.post('/refresh', zValidator('json', refreshTokenSchema), async (c) => {
  try {
    const { refreshToken } = c.req.valid('json')
    
    const payload = verifyToken(refreshToken, env.JWT_REFRESH_SECRET)
    if (!payload) {
      return c.json(errorResponse('AUTH_002', 'Invalid refresh token'), 401)
    }
    
    // Verify user still exists
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as any
    if (!userRow) {
      return c.json(errorResponse('AUTH_001', 'User not found'), 401)
    }
    
    const tokens = generateTokens(payload.userId)
    return c.json(successResponse(tokens, 'Token refreshed successfully'))
  } catch (error) {
    console.error('Token refresh error:', error)
    return c.json(errorResponse('REFRESH_FAILED', 'Failed to refresh token'), 500)
  }
})

// DELETE /api/auth/logout
authRouter.delete('/logout', auth(), async (c) => {
  // In a real app, you might invalidate the token in a blacklist
  // For now, we'll just return success (client should delete the token)
  return c.json(successResponse(null, 'Logout successful'))
})

// GET /api/auth/me
authRouter.get('/me', auth(), async (c) => {
  const user = c.get('user') as User
  
  // Don't return sensitive information
  const safeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    githubUsername: user.githubUsername,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
  
  return c.json(successResponse(safeUser))
})

// PUT /api/auth/profile
authRouter.put('/profile', auth(), async (c) => {
  try {
    const user = c.get('user') as User
    const body = await c.req.json()
    
    // Validate input
    const { name } = body
    if (!name || typeof name !== 'string' || name.length === 0) {
      return c.json(errorResponse('VALIDATION_ERROR', 'Name is required'), 400)
    }
    
    // Update user
    const updateStmt = db.prepare(`
      UPDATE users 
      SET name = ?, github_username = ?, github_token_encrypted = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    updateStmt.run(name, user.githubUsername || null, user.githubToken ? encrypt(user.githubToken) : null, user.id)
    
    // Get updated user
    const getUserStmt = db.prepare('SELECT * FROM users WHERE id = ?')
    const updatedUserRow = getUserStmt.get(user.id) as any
    const updatedUser: User = {
      id: updatedUserRow.id,
      email: updatedUserRow.email,
      name: updatedUserRow.name,
      githubUsername: updatedUserRow.github_username,
      role: updatedUserRow.role as 'admin' | 'developer' | 'viewer',
      createdAt: updatedUserRow.created_at,
      updatedAt: updatedUserRow.updated_at
    }
    
    return c.json(successResponse(updatedUser, 'Profile updated successfully'))
  } catch (error) {
    console.error('Profile update error:', error)
    return c.json(errorResponse('UPDATE_FAILED', 'Failed to update profile'), 500)
  }
})

// POST /api/auth/github/connect
authRouter.post('/github/connect', auth(), zValidator('json', githubConnectSchema), async (c) => {
  if (!features.github) {
    return c.json(errorResponse('FEATURE_DISABLED', 'GitHub integration is not configured'), 503)
  }
  
  try {
    const user = c.get('user') as User
    const { code } = c.req.valid('json')
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    })
    
    if (!tokenResponse.ok) {
      throw new Error('GitHub token exchange failed')
    }
    
    const tokenData = await tokenResponse.json() as any
    if (tokenData.error) {
      throw new Error(tokenData.error_description || 'GitHub authorization failed')
    }
    
    // Get GitHub user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })
    
    if (!userResponse.ok) {
      throw new Error('Failed to get GitHub user info')
    }
    
    const githubUser = await userResponse.json() as any
    
    // Update user with GitHub info
    const encryptedToken = encrypt(tokenData.access_token)
    const updateStmt = db.prepare(`
      UPDATE users 
      SET name = ?, github_username = ?, github_token_encrypted = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    updateStmt.run(user.name, githubUser.login, encryptedToken, user.id)
    
    return c.json(successResponse({ success: true }, 'GitHub account connected successfully'))
  } catch (error: any) {
    console.error('GitHub connect error:', error)
    return c.json(errorResponse('GITHUB_CONNECT_FAILED', error.message || 'Failed to connect GitHub account'), 500)
  }
})

// DELETE /api/auth/github/disconnect
authRouter.delete('/github/disconnect', auth(), async (c) => {
  try {
    const user = c.get('user') as User
    
    // Remove GitHub connection
    const updateStmt = db.prepare(`
      UPDATE users 
      SET name = ?, github_username = ?, github_token_encrypted = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    updateStmt.run(user.name, null, null, user.id)
    
    return c.json(successResponse({ success: true }, 'GitHub account disconnected successfully'))
  } catch (error) {
    console.error('GitHub disconnect error:', error)
    return c.json(errorResponse('GITHUB_DISCONNECT_FAILED', 'Failed to disconnect GitHub account'), 500)
  }
}) 