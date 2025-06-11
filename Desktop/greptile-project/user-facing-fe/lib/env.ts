/**
 * Environment configuration for public-facing changelog application
 */

export const env = {
  // Backend API configuration - points to public endpoints
  API_URL: process.env.NEXT_PUBLIC_API_URL 
    ? `${process.env.NEXT_PUBLIC_API_URL}/public`
    : 'http://localhost:8000/api/public',
  
  // Site configuration
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001',
  SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME || 'Changelog',
  
  // Development flags
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  
  // Feature flags (minimal set)
  FEATURES: {
    RSS_FEED: true, // Keep for later enhancement
  }
} as const

// Validate required environment variables
if (!env.API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required')
}

// RSS feed URL builder (for later enhancement)
export function getRSSFeedUrl(): string {
  return `${env.API_URL}/rss`
}

// Changelog detail URL builder
export function getChangelogDetailUrl(changelogId: string): string {
  return `${env.SITE_URL}/changelog/${changelogId}`
} 