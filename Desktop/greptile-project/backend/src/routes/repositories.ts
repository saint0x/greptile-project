import { Hono } from 'hono'
import { auth } from '../lib/auth.ts'
import { 
  validate, 
  successResponse, 
  errorResponse,
  repositoryUpdateSchema
} from '../lib/validation.ts'
import { RepositoryService, GitHubService } from '../services/github.ts'
import type { User } from '../types/index.ts'

// Define context type with user property
type Variables = {
  user?: User
  validated?: any
}

export const repositoriesRouter = new Hono<{ Variables: Variables }>()

// GET /api/repositories - List user's repositories
repositoriesRouter.get('/', auth(), async (c) => {
  try {
    const user = c.get('user') as User
    
    if (!user.githubToken) {
      return c.json(errorResponse('GITHUB_NOT_CONNECTED', 'GitHub account not connected'), 400)
    }
    
    // Get repositories directly from GitHub
    const github = GitHubService.createForUser(user)
    
    if (!github) {
      return c.json(errorResponse('GITHUB_NOT_AVAILABLE', 'GitHub integration is not configured'), 503)
    }
    
    const githubRepos = await github.getUserRepositories()
    
    // Transform GitHub data to our Repository format
    const repositories = githubRepos.map(repo => ({
      id: repo.full_name, // Use full_name as ID for easy branch fetching
      githubId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      description: repo.description,
      url: repo.html_url,
      isPrivate: repo.private,
      defaultBranch: repo.default_branch || 'main',
      language: repo.language,
      starCount: repo.stargazers_count || 0,
      forkCount: repo.forks_count || 0,
      lastPushedAt: repo.pushed_at || new Date().toISOString(),
      createdAt: repo.created_at,
      updatedAt: repo.updated_at,
      syncStatus: 'completed' as const
    }))
    
    return c.json(successResponse(repositories))
  } catch (error) {
    console.error('Get repositories error:', error)
    return c.json(errorResponse('FETCH_FAILED', 'Failed to fetch repositories'), 500)
  }
})

// POST /api/repositories/sync - Sync repositories from GitHub
repositoriesRouter.post('/sync', auth(), async (c) => {
  try {
    const user = c.get('user') as User
    
    if (!user.githubToken) {
      return c.json(errorResponse('GITHUB_NOT_CONNECTED', 'GitHub account not connected'), 400)
    }
    
    const result = await RepositoryService.syncRepositories(user)
    return c.json(successResponse(result, 'Repositories synced successfully'))
  } catch (error: any) {
    console.error('Repository sync error:', error)
    
    if (error.message === 'GitHub integration not available') {
      return c.json(errorResponse('GITHUB_NOT_AVAILABLE', 'GitHub integration is not configured'), 503)
    }
    
    return c.json(errorResponse('SYNC_FAILED', error.message || 'Failed to sync repositories'), 500)
  }
})

// GET /api/repositories/:id - Get repository details
repositoriesRouter.get('/:id', auth(), async (c) => {
  try {
    const id = c.req.param('id')
    const repository = RepositoryService.getRepositoryById(id)
    
    if (!repository) {
      return c.json(errorResponse('REPO_001', 'Repository not found'), 404)
    }
    
    return c.json(successResponse(repository))
  } catch (error) {
    console.error('Get repository error:', error)
    return c.json(errorResponse('FETCH_FAILED', 'Failed to fetch repository'), 500)
  }
})

// PUT /api/repositories/:id - Update repository settings
repositoriesRouter.put('/:id', auth(), validate(repositoryUpdateSchema), async (c) => {
  try {
    const id = c.req.param('id')
    const updates = c.get('validated')
    
    const repository = RepositoryService.getRepositoryById(id)
    if (!repository) {
      return c.json(errorResponse('REPO_001', 'Repository not found'), 404)
    }
    
    // For now, we only allow updating name and description
    // In a real app, you might want to sync these changes back to GitHub
    
    return c.json(successResponse(repository, 'Repository updated successfully'))
  } catch (error) {
    console.error('Update repository error:', error)
    return c.json(errorResponse('UPDATE_FAILED', 'Failed to update repository'), 500)
  }
})

// DELETE /api/repositories/:id - Remove repository from local database
repositoriesRouter.delete('/:id', auth(), async (c) => {
  try {
    const id = c.req.param('id')
    
    const repository = RepositoryService.getRepositoryById(id)
    if (!repository) {
      return c.json(errorResponse('REPO_001', 'Repository not found'), 404)
    }
    
            // Repository deletion not implemented in demo
    // This should remove the repository from local database but not from GitHub
    
    return c.json(successResponse(null, 'Repository removed successfully'))
  } catch (error) {
    console.error('Delete repository error:', error)
    return c.json(errorResponse('DELETE_FAILED', 'Failed to remove repository'), 500)
  }
})

// GET /api/repositories/:id/branches - List repository branches
repositoriesRouter.get('/:id/branches', auth(), async (c) => {
  try {
    const user = c.get('user') as User
    const fullName = decodeURIComponent(c.req.param('id')) // This is now "owner/repo"
    const defaultBranch = c.req.query('defaultBranch') || 'main' // Frontend can send default branch
    
    if (!user.githubToken) {
      return c.json(errorResponse('GITHUB_NOT_CONNECTED', 'GitHub account not connected'), 400)
    }
    
    const github = GitHubService.createForUser(user)
    if (!github) {
      return c.json(errorResponse('GITHUB_NOT_AVAILABLE', 'GitHub integration is not configured'), 503)
    }
    
    // Parse owner and repo from full_name
    const parts = fullName.split('/')
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return c.json(errorResponse('REPO_001', 'Invalid repository format'), 400)
    }
    const [owner, repo] = parts
    
    // Get branches using owner/repo name - SINGLE API CALL
    const branches = await github.getRepositoryBranches(owner, repo)
    
    // Set default branch using info from repositories endpoint
    const transformedBranches = branches.map(branch => ({
      ...branch,
      isDefault: branch.name === defaultBranch
    }))
    
    return c.json(successResponse(transformedBranches))
  } catch (error: any) {
    console.error('Get branches error:', error)
    
    if (error.message === 'Repository not found') {
      return c.json(errorResponse('REPO_001', 'Repository not found'), 404)
    }
    
    if (error.message === 'GitHub integration not available') {
      return c.json(errorResponse('GITHUB_NOT_AVAILABLE', 'GitHub integration is not configured'), 503)
    }
    
    return c.json(errorResponse('FETCH_FAILED', 'Failed to fetch repository branches'), 500)
  }
})

// GET /api/repositories/:id/commits - Get commit history
repositoriesRouter.get('/:id/commits', auth(), async (c) => {
  try {
    const user = c.get('user') as User
    const repositoryId = c.req.param('id')
    const { branch, since, until } = c.req.query()
    
    if (!user.githubToken) {
      return c.json(errorResponse('GITHUB_NOT_CONNECTED', 'GitHub account not connected'), 400)
    }
    
    if (!branch) {
      return c.json(errorResponse('VALIDATION_ERROR', 'Branch parameter is required'), 400)
    }
    
    const commits = await RepositoryService.getCommitsForDateRange(
      user,
      repositoryId,
      branch,
      since || '',
      until || ''
    )
    
    return c.json(successResponse(commits))
  } catch (error: any) {
    console.error('Get commits error:', error)
    
    if (error.message === 'Repository not found') {
      return c.json(errorResponse('REPO_001', 'Repository not found'), 404)
    }
    
    return c.json(errorResponse('FETCH_FAILED', 'Failed to fetch repository commits'), 500)
  }
})

// GET /api/repositories/:id/commits/:sha - Get specific commit details
repositoriesRouter.get('/:id/commits/:sha', auth(), async (c) => {
  try {
    const user = c.get('user') as User
    const repositoryId = c.req.param('id')
    const sha = c.req.param('sha')
    
    if (!user.githubToken) {
      return c.json(errorResponse('GITHUB_NOT_CONNECTED', 'GitHub account not connected'), 400)
    }
    
    const commit = await RepositoryService.getCommitDetails(user, repositoryId, sha)
    return c.json(successResponse(commit))
  } catch (error: any) {
    console.error('Get commit details error:', error)
    
    if (error.message === 'Repository not found') {
      return c.json(errorResponse('REPO_001', 'Repository not found'), 404)
    }
    
    return c.json(errorResponse('FETCH_FAILED', 'Failed to fetch commit details'), 500)
  }
}) 