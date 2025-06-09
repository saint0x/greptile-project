import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import CryptoJS from 'crypto-js'
import { env } from './env.ts'
import { statements, generateId, db } from './database.ts'
import type { User } from '../types/index.ts'

// JWT helpers
export const generateTokens = (userId: string) => {
  // @ts-ignore - JWT type definitions have conflicts
  const accessToken = jwt.sign(
    { userId }, 
    env.JWT_SECRET, 
    { expiresIn: env.JWT_EXPIRES_IN }
  )
  
  // @ts-ignore - JWT type definitions have conflicts
  const refreshToken = jwt.sign(
    { userId }, 
    env.JWT_REFRESH_SECRET, 
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  )
  
  return {
    accessToken: accessToken as string,
    refreshToken: refreshToken as string,
    expiresIn: 3600 // 1 hour in seconds
  }
}

export const verifyToken = (token: string, secret: string = env.JWT_SECRET) => {
  try {
    return jwt.verify(token, secret) as { userId: string }
  } catch (error) {
    return null
  }
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12)
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}

// Encryption for sensitive data like GitHub tokens
export const encrypt = (text: string): string => {
  return CryptoJS.AES.encrypt(text, env.JWT_SECRET).toString()
}

export const decrypt = (encryptedText: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedText, env.JWT_SECRET)
  return bytes.toString(CryptoJS.enc.Utf8)
}

// Authentication middleware - validates GitHub tokens from NextAuth
export const auth = () => {
  return async (c: any, next: any) => {
    try {
      const authHeader = c.req.header('authorization')
      console.log('Auth middleware - header:', authHeader?.substring(0, 20) + '...')
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Auth middleware - no valid auth header')
        return c.json({
          success: false,
          error: {
            code: 'AUTH_001',
            message: 'Missing or invalid authorization header'
          },
          timestamp: new Date().toISOString(),
          path: c.req.path
        }, 401)
      }
      
      const token = authHeader.split(' ')[1]
      console.log('Auth middleware - token:', token?.substring(0, 10) + '...')
      
      // Validate GitHub token by calling GitHub API
      const githubResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      })
      
      console.log('Auth middleware - GitHub API response:', githubResponse.status)
      
      if (!githubResponse.ok) {
        return c.json({
          success: false,
          error: {
            code: 'AUTH_002',
            message: 'Invalid GitHub token'
          },
          timestamp: new Date().toISOString(),
          path: c.req.path
        }, 401)
      }
      
      const githubUser = await githubResponse.json() as any
      
      // Find or create user in database
      const email = githubUser.email || `${githubUser.login}@github.local`
      let userRow = statements.getUserByEmail.get(email) as any
      
      // Also check by GitHub username in case email changed
      if (!userRow) {
        const getUserByGithubStmt = db.prepare('SELECT * FROM users WHERE github_username = ?')
        userRow = getUserByGithubStmt.get(githubUser.login) as any
      }
      
      if (!userRow) {
        // Create new user
        const userId = generateId()
        try {
          statements.createUser.run(
            userId, 
            email, 
            githubUser.name || githubUser.login, 
            githubUser.login, 
            encrypt(token), 
            'developer'
          )
          userRow = statements.getUserById.get(userId)
        } catch (error: any) {
          if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            // User already exists, get them
            userRow = statements.getUserByEmail.get(email) as any
            if (!userRow) {
              const getUserByGithubStmt = db.prepare('SELECT * FROM users WHERE github_username = ?')
              userRow = getUserByGithubStmt.get(githubUser.login) as any
            }
          } else {
            throw error
          }
        }
      }
      
      if (userRow) {
        // Update GitHub token and info
        statements.updateUser.run(
          githubUser.name || userRow.name,
          githubUser.login,
          encrypt(token),
          userRow.id
        )
        userRow = statements.getUserById.get(userRow.id)
      }
      
      // Convert to user object and set in context
      const user: User = {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        githubUsername: userRow.github_username,
        githubToken: token, // Use the live token
        role: userRow.role as 'admin' | 'developer' | 'viewer',
        createdAt: userRow.created_at,
        updatedAt: userRow.updated_at
      }
      
      c.set('user', user)
      await next()
    } catch (error) {
      console.error('Auth middleware error:', error)
      return c.json({
        success: false,
        error: {
          code: 'AUTH_003',
          message: 'Authentication error'
        },
        timestamp: new Date().toISOString(),
        path: c.req.path
      }, 500)
    }
  }
}

// Optional auth middleware (for public routes that can benefit from user context)
export const optionalAuth = () => {
  return async (c: any, next: any) => {
    try {
      const authHeader = c.req.header('authorization')
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        const payload = verifyToken(token)
        
        if (payload) {
          const userRow = statements.getUserById.get(payload.userId) as any
          if (userRow) {
            const user: User = {
              id: userRow.id,
              email: userRow.email,
              name: userRow.name,
              githubUsername: userRow.github_username,
              githubToken: userRow.github_token_encrypted ? decrypt(userRow.github_token_encrypted) : undefined,
              role: userRow.role as 'admin' | 'developer' | 'viewer',
              createdAt: userRow.created_at,
              updatedAt: userRow.updated_at
            }
            c.set('user', user)
          }
        }
      }
      
      await next()
    } catch (error) {
      // Don't fail on optional auth errors
      await next()
    }
  }
}

// Role-based authorization
export const requireRole = (roles: Array<'admin' | 'developer' | 'viewer'>) => {
  return async (c: any, next: any) => {
    const user = c.get('user') as User
    
    if (!user) {
      return c.json({
        success: false,
        error: {
          code: 'AUTH_003',
          message: 'Authentication required'
        },
        timestamp: new Date().toISOString(),
        path: c.req.path
      }, 401)
    }
    
    if (!roles.includes(user.role)) {
      return c.json({
        success: false,
        error: {
          code: 'AUTH_003',
          message: 'Insufficient permissions'
        },
        timestamp: new Date().toISOString(),
        path: c.req.path
      }, 403)
    }
    
    await next()
  }
}

// User service functions
export const createUser = async (email: string, name: string, password: string) => {
  const existingUser = statements.getUserByEmail.get(email)
  if (existingUser) {
    throw new Error('User already exists')
  }
  
  const hashedPassword = await hashPassword(password)
  const userId = generateId()
  
  statements.createUser.run(userId, email, name, null, null, 'developer')
  
  // Store password hash separately (in a real app, you'd have a passwords table)
  // For simplicity, we're just using the encrypted token field
  statements.updateUser.run(name, null, encrypt(hashedPassword), userId)
  
  return statements.getUserById.get(userId)
}

export const authenticateUser = async (email: string, password: string) => {
  const userRow = statements.getUserByEmail.get(email) as any
  if (!userRow) {
    throw new Error('Invalid credentials')
  }
  
  // In this simplified version, we're storing the password hash in the encrypted token field
  const storedHash = userRow.github_token_encrypted ? decrypt(userRow.github_token_encrypted) : ''
  const isValid = await verifyPassword(password, storedHash)
  
  if (!isValid) {
    throw new Error('Invalid credentials')
  }
  
  return {
    id: userRow.id,
    email: userRow.email,
    name: userRow.name,
    githubUsername: userRow.github_username,
    role: userRow.role as 'admin' | 'developer' | 'viewer',
    createdAt: userRow.created_at,
    updatedAt: userRow.updated_at
  }
} 