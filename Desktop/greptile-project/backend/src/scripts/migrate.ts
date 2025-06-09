#!/usr/bin/env bun

import { createTables, initializeStatements } from '../lib/database.js'

console.log('🔧 Running database migrations...')

try {
  createTables()
  console.log('✅ Tables created successfully!')
  
  // Initialize prepared statements after tables exist
  const statements = initializeStatements()
  console.log('✅ Prepared statements initialized!')
  
  console.log('✅ Database migration completed successfully!')
} catch (error) {
  console.error('❌ Database migration failed:', error)
  process.exit(1)
} 