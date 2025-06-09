# AI Changelog Generator - Backend

A high-performance backend built with Bun, Hono, and SQLite for generating AI-powered changelogs from GitHub repositories.

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+ (recommended for performance)
- Node.js 18+ (alternative runtime)

### Installation

```bash
# Install dependencies
bun install

# Create environment file
cp .env.example .env

# Run database migrations
bun run migrate

# Start development server
bun run dev
```

The API will be available at `http://localhost:8000`

## 🛠️ Environment Configuration

Create a `.env` file with the following variables:

### Required Variables

```bash
# Application
NODE_ENV=development
PORT=8000
DATABASE_URL=./data/changelog.db

# JWT Authentication (generate secure keys!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production

# Frontend URLs (for CORS)
FRONTEND_URLS=http://localhost:3000,http://localhost:3001
```

### Optional Features

```bash
# GitHub Integration (for repository access)
GITHUB_CLIENT_ID=your-github-oauth-app-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-client-secret

# OpenAI Integration (for AI features)
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4

# Feature Flags
ENABLE_GITHUB_INTEGRATION=true
ENABLE_AI_FEATURES=true
ENABLE_REGISTRATION=true
```

## 📚 API Documentation

### Base URL
- Development: `http://localhost:8000/api`
- Production: Configure according to your deployment

### Authentication Endpoints

```
POST   /api/auth/register           # Register new user
POST   /api/auth/login              # User login
POST   /api/auth/refresh            # Refresh access token
DELETE /api/auth/logout             # User logout
GET    /api/auth/me                 # Get current user profile
PUT    /api/auth/profile            # Update user profile
POST   /api/auth/github/connect     # Connect GitHub account
DELETE /api/auth/github/disconnect  # Disconnect GitHub account
```

### Repository Management

```
GET    /api/repositories            # List accessible repositories
POST   /api/repositories/sync       # Sync from GitHub
GET    /api/repositories/:id        # Get repository details
PUT    /api/repositories/:id        # Update repository settings
GET    /api/repositories/:id/branches # List branches
GET    /api/repositories/:id/commits  # Get commit history
```

### AI-Powered Features

```
POST   /api/ai/changelog/generate       # Generate changelog with AI
GET    /api/ai/changelog/generate/:id   # Get generation status
POST   /api/ai/changelog/generate/:id/retry # Retry failed generation
POST   /api/ai/analyze-commits          # Analyze commits only
POST   /api/ai/enhance-description      # Enhance manual descriptions
POST   /api/ai/suggest-tags            # Suggest tags for entries
```

### Changelog Management

```
GET    /api/changelogs              # List changelogs
POST   /api/changelogs              # Create new changelog
GET    /api/changelogs/:id          # Get changelog details
PUT    /api/changelogs/:id          # Update changelog
DELETE /api/changelogs/:id          # Delete changelog
POST   /api/changelogs/:id/publish  # Publish changelog
POST   /api/changelogs/:id/sections # Add section
```

### Public API (User-Facing)

```
GET    /api/public/changelogs       # List published changelogs
GET    /api/public/changelogs/:id   # Get published changelog
GET    /api/public/search           # Search changelogs
GET    /api/public/tags             # Get available tags
GET    /api/public/repositories     # Get public repositories
```

## 🗄️ Database Schema

The application uses SQLite with the following key tables:

- `users` - User accounts and authentication
- `repositories` - GitHub repository metadata
- `repository_access` - User repository permissions
- `changelogs` - Changelog documents
- `changelog_sections` - Organized changelog sections
- `changelog_changes` - Individual change entries
- `ai_generations` - AI generation tracking and caching

## 🔧 Development

### Available Scripts

```bash
# Development server with hot reload
bun run dev

# Run database migrations
bun run migrate

# Build for production
bun run build

# Start production server
bun run start

# Run tests
bun test

# Type checking
bun run type-check

# Linting
bun run lint
```

### Code Structure

```
src/
├── index.ts              # Main application entry
├── lib/
│   ├── database.ts       # SQLite database setup
│   ├── env.ts           # Environment validation
│   ├── auth.ts          # JWT authentication
│   └── validation.ts    # Zod schemas
├── routes/
│   ├── auth.ts          # Authentication routes
│   ├── repositories.ts  # Repository management
│   ├── changelogs.ts    # Changelog CRUD
│   ├── ai.ts           # AI generation
│   └── public.ts       # Public API
├── services/
│   ├── github.ts       # GitHub API integration
│   └── openai.ts       # OpenAI API calls
├── types/
│   └── index.ts        # TypeScript definitions
└── scripts/
    └── migrate.ts      # Database migration
```

## 🚀 Deployment

### Using Bun (Recommended)

```bash
# Build the application
bun run build

# Start with PM2 or similar
pm2 start bun --name "changelog-api" -- run start
```

### Using Docker

```dockerfile
FROM oven/bun:1 as base
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Run migrations and start
CMD ["bun", "run", "migrate", "&&", "bun", "run", "start"]
```

### Environment Variables for Production

```bash
NODE_ENV=production
PORT=8000
DATABASE_URL=/data/changelog.db
JWT_SECRET=your-production-jwt-secret
JWT_REFRESH_SECRET=your-production-refresh-secret
FRONTEND_URLS=https://your-domain.com,https://changelog.your-domain.com
```

## 🔒 Security Features

- JWT-based authentication with refresh tokens
- Bcrypt password hashing
- Rate limiting (built into Hono)
- CORS configuration for specific origins
- Input validation with Zod schemas
- SQL injection prevention with prepared statements
- Encrypted GitHub token storage

## 🔍 Monitoring & Debugging

### Health Check

```bash
curl http://localhost:8000/health
```

### Logs

The application uses structured logging. In development, logs are output to console. For production, consider using a log aggregation service.

### Performance

- SQLite with WAL mode for better concurrency
- Prepared statements for optimal query performance
- Connection pooling handled by Bun's SQLite driver
- Indexes on frequently queried columns

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with proper TypeScript types
4. Add tests for new functionality
5. Ensure all linting passes: `bun run lint`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

**Database locked error**
```bash
# Stop all processes and restart
pkill -f bun
bun run dev
```

**GitHub API rate limit**
```bash
# Check your rate limit status
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/rate_limit
```

**TypeScript errors**
```bash
# Clear and reinstall dependencies
rm -rf node_modules bun.lockb
bun install
```

For more help, check the [GitHub Issues](https://github.com/your-repo/issues) or create a new issue.
