/**
 * Environment configuration for server communication
 */

// Environment configuration for the dev app
export const env = {
  // Backend API configuration
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  
  // Development flags
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  
  // Optional: Feature flags for gradual rollout
  FEATURES: {
    AI_ENHANCEMENTS: process.env.NEXT_PUBLIC_ENABLE_AI_ENHANCEMENTS !== 'false',
    ADVANCED_GENERATION: process.env.NEXT_PUBLIC_ENABLE_ADVANCED_GENERATION !== 'false',
    ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS !== 'false',
  }
} as const

// Validate required environment variables
if (!env.API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required')
}

// Server-side configuration (for when we connect to external server)
export const SERVER_API_URL = process.env.API_BASE_URL
export const API_SECRET_KEY = process.env.API_SECRET_KEY
