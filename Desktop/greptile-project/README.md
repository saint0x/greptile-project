# AI-Powered Changelog Generator

A TypeScript-based changelog generation system that transforms GitHub commits into user-friendly changelogs using AI.

## Quick Start

```bash
# Install dependencies
bun run install:all

# Setup environment (see .env.example files)
# - GitHub OAuth app (client ID/secret)
# - OpenAI API key

# Initialize database
cd backend && bun run db:migrate

# Start all services
bun run dev
```

**Access:**
- Developer Dashboard: http://localhost:3000
- Public Website: http://localhost:3001
- Backend API: http://localhost:8000

## Technical Decisions

### TypeScript
- **Fast development** with static type safety
- **Catch errors at compile time** rather than runtime
- **Better IDE support** and refactoring confidence

### Next.js
- **Quick prototyping** and MVP development
- **App Router** for modern React patterns
- **Built-in optimizations** for production

### Architecture: Monorepo with Separation of Concerns
- **Backend** (Bun + Hono): API server and database
- **Dev App** (Next.js): OAuth-authenticated dashboard for developers
- **User-facing App** (Next.js): Public changelog website
- **Monorepo approach** avoids microservices overkill while maintaining clear boundaries

### SQLite
- **Perfect for this use case**: file-based, zero-config, handles reads well
- **No infrastructure overhead** for demo/MVP
- **Easy to backup and migrate**

### Full Type Safety
- **End-to-end TypeScript** from database to UI
- **Shared types** across all applications
- **Runtime validation** with proper error handling

## Production Improvements

If this were a production system, we would add:

- **PostgreSQL** with proper indexing for better concurrent writes
- **Redis caching** for expensive AI operations
- **Rate limiting** and authentication middleware
- **Proper logging/error handling** and monitoring (DataDog, Sentry)

- **CI/CD pipeline** with automated testing
- **Database migrations** with rollback support
- **Horizontal scaling** for AI processing workers
- **CDN** for static assets and changelog pages
- **Security audits** and penetration testing