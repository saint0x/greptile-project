#!/usr/bin/env bun

import { CacheService } from '../services/cache.ts'

console.log('🧹 Starting database cleanup...')

try {
  // Clean up expired cache entries
  await CacheService.cleanup()
  
  console.log('✅ Database cleanup completed successfully!')
} catch (error) {
  console.error('❌ Database cleanup failed:', error)
  process.exit(1)
} 