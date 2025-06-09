import { Octokit } from '@octokit/rest'
import { env, features } from '../lib/env.ts'
import { statements, generateId, rowToRepository, db } from '../lib/database.ts'
import type { Repository, Branch, User } from '../types/index.ts'

export class GitHubService {
  private octokit: Octokit

  constructor(accessToken?: string) {
    this.octokit = new Octokit({
      auth: accessToken,
      userAgent: 'changelog-generator/1.0.0',
    })
  }

  static createForUser(user: User): GitHubService | null {
    if (!features.github || !user.githubToken) {
      return null
    }
    return new GitHubService(user.githubToken)
  }

  // Get user's repositories from GitHub
  async getUserRepositories(): Promise<any[]> {
    try {
      const response = await this.octokit.rest.repos.listForAuthenticatedUser({
        visibility: 'all',
        sort: 'updated',
        per_page: 100,
      })
      
      return response.data
    } catch (error) {
      console.error('GitHub API error:', error)
      throw new Error('Failed to fetch repositories from GitHub')
    }
  }

  // Get repository branches
  async getRepositoryBranches(owner: string, repo: string): Promise<Branch[]> {
    try {
      const response = await this.octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      })
      
      return response.data.map(branch => ({
        name: branch.name,
        sha: branch.commit.sha,
        isDefault: false, // We'll set this separately
        isProtected: branch.protected || false,
        lastCommit: {
          sha: branch.commit.sha,
          message: '', // Would need separate API call to get full commit info
          author: '',
          date: '',
        }
      }))
    } catch (error) {
      console.error('GitHub branches API error:', error)
      throw new Error('Failed to fetch repository branches')
    }
  }

  // Get repository details
  async getRepository(owner: string, repo: string): Promise<any> {
    try {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo,
      })
      
      return response.data
    } catch (error) {
      console.error('GitHub repo API error:', error)
      throw new Error('Failed to fetch repository details')
    }
  }

  // Get commits for a date range
  async getCommits(
    owner: string,
    repo: string,
    branch: string,
    since?: string,
    until?: string
  ): Promise<any[]> {
    try {
      const params: any = {
        owner,
        repo,
        sha: branch,
        per_page: 100,
      }
      
      if (since) params.since = since
      if (until) params.until = until
      
      const response = await this.octokit.rest.repos.listCommits(params)
      
      return response.data
    } catch (error) {
      console.error('GitHub commits API error:', error)
      throw new Error('Failed to fetch repository commits')
    }
  }

  // Get commit details with file changes
  async getCommitDetails(owner: string, repo: string, sha: string): Promise<any> {
    try {
      const response = await this.octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: sha,
      })
      
      return response.data
    } catch (error) {
      console.error('GitHub commit details API error:', error)
      throw new Error('Failed to fetch commit details')
    }
  }

  // Helper method to get commits by repository full name and branch
  async getCommitsByFullName(
    fullName: string,
    branch: string,
    since?: string,
    until?: string
  ): Promise<any[]> {
    const [owner, repo] = fullName.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository format: ${fullName}`)
    }
    
    return this.getCommits(owner, repo, branch, since, until)
  }

  // Sync repositories from GitHub to local database
  async syncRepositoriesToDatabase(): Promise<{ synced: number; failed: number }> {
    let synced = 0
    let failed = 0
    
    try {
      const repos = await this.getUserRepositories()
      
      for (const repo of repos) {
        try {
          // Check if repository already exists by GitHub ID
          const existingStmt = db.prepare('SELECT * FROM repositories WHERE github_id = ?')
          const existing = existingStmt.get(repo.id) as any
          
          if (!existing) {
            // Create new repository record
            const repoId = generateId()
            statements.createRepository.run(
              repoId,
              repo.id,
              repo.name,
              repo.full_name,
              repo.owner.login,
              repo.description || null,
              repo.html_url,
              repo.private,
              repo.default_branch || 'main',
              repo.language || null,
              repo.stargazers_count || 0,
              repo.forks_count || 0,
              repo.pushed_at || new Date().toISOString()
            )
            synced++
          } else {
            // Update sync status
            statements.updateRepositorySync.run('completed', existing.id)
            synced++
          }
        } catch (error) {
          console.error(`Failed to sync repository ${repo.full_name}:`, error)
          failed++
        }
      }
    } catch (error) {
      console.error('Repository sync error:', error)
      throw error
    }
    
    return { synced, failed }
  }
}

// Repository service functions
export const RepositoryService = {
  // Get user's repositories (from database)
  getUserRepositories(): Repository[] {
    const rows = statements.getRepositoriesByOwner.all() as any[]
    return rows.map(rowToRepository)
  },

  // Get repository by ID
  getRepositoryById(id: string): Repository | null {
    const row = statements.getRepositoryById.get(id) as any
    return row ? rowToRepository(row) : null
  },

  // Sync repositories for a user
  async syncRepositories(user: User): Promise<{ synced: number; failed: number }> {
    const github = GitHubService.createForUser(user)
    if (!github) {
      throw new Error('GitHub integration not available')
    }

    return github.syncRepositoriesToDatabase()
  },

  // Get repository branches
  async getRepositoryBranches(user: User, repositoryId: string): Promise<Branch[]> {
    const repository = this.getRepositoryById(repositoryId)
    if (!repository) {
      throw new Error('Repository not found')
    }

    const github = GitHubService.createForUser(user)
    if (!github) {
      throw new Error('GitHub integration not available')
    }

    const parts = repository.fullName.split('/')
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('Invalid repository fullName format')
    }
    const owner = parts[0]
    const repo = parts[1]
    const branches = await github.getRepositoryBranches(owner, repo)
    
    // Get repository details to set default branch
    const repoDetails = await github.getRepository(owner, repo)
    
    return branches.map(branch => ({
      ...branch,
      isDefault: branch.name === repoDetails.default_branch
    }))
  },

  // Get commits for changelog generation - works directly with GitHub API
  async getCommitsForDateRange(
    user: User,
    repositoryId: string, // Format: "owner/repo-name"
    branch: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const github = GitHubService.createForUser(user)
    if (!github) {
      throw new Error('GitHub integration not available')
    }

    // Parse owner/repo from repositoryId (format: "owner/repo-name")
    const parts = repositoryId.split('/')
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid repository format: ${repositoryId}`)
    }
    const owner = parts[0]
    const repo = parts[1]
    
    return github.getCommits(owner, repo, branch, startDate, endDate)
  },

  // Get detailed commit information - works directly with GitHub API
  async getCommitDetails(
    user: User,
    repositoryId: string, // Format: "owner/repo-name"
    sha: string
  ): Promise<any> {
    const github = GitHubService.createForUser(user)
    if (!github) {
      throw new Error('GitHub integration not available')
    }

    // Parse owner/repo from repositoryId (format: "owner/repo-name")
    const parts = repositoryId.split('/')
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid repository format: ${repositoryId}`)
    }
    const owner = parts[0]
    const repo = parts[1]
    
    return github.getCommitDetails(owner, repo, sha)
  }
}

// Export singleton instance
export const githubService = new GitHubService() 