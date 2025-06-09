import { openaiService } from './openai.ts'
import { GitHubService, RepositoryService } from './github.ts'
import { statements, generateId, db } from '../lib/database.ts'
import type { 
  User, 
  ChangelogRequest, 
  ChangelogGeneration, 
  CommitAnalysis,
  Changelog,
  ChangelogSection,
  ChangelogChange 
} from '../types/index.ts'

export class ChangelogIntegrationService {
  // Start a new changelog generation process
  async startGeneration(
    user: User,
    request: ChangelogRequest
  ): Promise<ChangelogGeneration> {
    // Validate repository access
    const repository = RepositoryService.getRepositoryById(request.repositoryId)
    if (!repository) {
      throw new Error('Repository not found')
    }

    // Create generation record
    const generationId = generateId()
    const generation: ChangelogGeneration = {
      id: generationId,
      repositoryId: request.repositoryId,
      branch: request.branch,
      dateRange: {
        start: request.startDate,
        end: request.endDate
      },
      status: 'processing',
      progress: 0,
      commits: [],
      generatedContent: null,
      aiMetadata: {
        model: '',
        promptTokens: 0,
        completionTokens: 0,
        processingTime: 0,
        confidence: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Store initial generation record
    this.saveGeneration(generation)

    // Start background processing
    this.processGeneration(user, generation, request).catch(error => {
      console.error('Generation processing error:', error)
      this.updateGenerationStatus(generationId, 'failed')
    })

    return generation
  }

  // Process the changelog generation
  private async processGeneration(
    user: User,
    generation: ChangelogGeneration,
    request: ChangelogRequest
  ): Promise<void> {
    try {
      // Step 1: Fetch commits from GitHub (20% progress)
      this.updateGenerationProgress(generation.id, 20)
      
      const commits = await RepositoryService.getCommitsForDateRange(
        user,
        request.repositoryId,
        request.branch,
        request.startDate,
        request.endDate
      )

      if (commits.length === 0) {
        throw new Error('No commits found in the specified date range')
      }

      // Step 2: Analyze commits with AI (60% progress)
      this.updateGenerationProgress(generation.id, 60)
      
      const analyses = await openaiService.analyzeCommits(commits)
      
      // Update generation with commit analyses
      generation.commits = analyses
      this.saveGeneration(generation)

      // Step 3: Generate changelog content (80% progress)
      this.updateGenerationProgress(generation.id, 80)
      
      const repository = RepositoryService.getRepositoryById(request.repositoryId)!
      const generatedContent = await openaiService.generateChangelog(
        analyses,
        request,
        repository.name
      )

      // Step 4: Complete and save (100% progress)
      generation.generatedContent = generatedContent
      generation.status = 'completed'
      generation.progress = 100
      generation.updatedAt = new Date().toISOString()
      generation.aiMetadata = generatedContent.metadata

      this.saveGeneration(generation)

    } catch (error) {
      console.error('Generation processing failed:', error)
      generation.status = 'failed'
      generation.updatedAt = new Date().toISOString()
      this.saveGeneration(generation)
    }
  }

  // Convert generated content to changelog
  async createChangelogFromGeneration(
    generationId: string,
    userId: string,
    customizations?: {
      title?: string
      description?: string
      tags?: string[]
    }
  ): Promise<Changelog> {
    const generation = this.getGeneration(generationId)
    if (!generation) {
      throw new Error('Generation not found')
    }

    if (generation.status !== 'completed') {
      throw new Error('Generation is not completed')
    }

    const repository = RepositoryService.getRepositoryById(generation.repositoryId)!
    const generated = generation.generatedContent

    // Create changelog sections from generated content
    const sections: ChangelogSection[] = generated.sections.map((section: any, index: number) => ({
      id: generateId(),
      title: section.title,
      order: index,
      changes: section.changes.map((change: any) => ({
        id: generateId(),
        description: change.description,
        type: change.category || 'enhancement',
        impact: this.determineImpact(change.category),
        tags: change.tags || [],
        commits: [change.commit],
        author: change.author,
        affectedComponents: [],
        migrationGuide: undefined,
        codeExamples: undefined
      } as ChangelogChange))
    }))

    // Calculate metadata
    const totalCommits = generation.commits.length
    const contributors = new Set(generation.commits.map(c => c.sha)).size // Simplified
    const filesChanged = 0 // Would need to aggregate from commit details
    const linesAdded = 0
    const linesRemoved = 0

    const changelog: Changelog = {
      id: generateId(),
      version: customizations?.title || generated.version,
      title: customizations?.title || generated.title,
      description: customizations?.description || generated.description,
      repositoryId: generation.repositoryId,
      branch: generation.branch,
      dateRange: generation.dateRange,
      sections,
      metadata: {
        totalCommits,
        contributors,
        filesChanged,
        linesAdded,
        linesRemoved,
        generationMethod: 'ai',
        aiGenerationId: generationId
      },
      status: 'draft',
      tags: customizations?.tags || [],
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save to database
    this.saveChangelog(changelog)

    return changelog
  }

  // Get generation status
  getGeneration(id: string): ChangelogGeneration | null {
    try {
      const stmt = db.prepare('SELECT * FROM ai_generations WHERE id = ?')
      const row = stmt.get(id) as any
      
      if (!row) return null

      return {
        id: row.id,
        repositoryId: row.repository_id,
        branch: row.branch,
        dateRange: {
          start: row.date_start,
          end: row.date_end
        },
        status: row.status,
        progress: row.progress,
        commits: row.commits_data ? JSON.parse(row.commits_data) : [],
        generatedContent: row.generated_content ? JSON.parse(row.generated_content) : null,
        aiMetadata: row.ai_metadata ? JSON.parse(row.ai_metadata) : {
          model: '',
          promptTokens: 0,
          completionTokens: 0,
          processingTime: 0,
          confidence: 0
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    } catch (error) {
      console.error('Error getting generation:', error)
      return null
    }
  }

  // Save generation to database
  private saveGeneration(generation: ChangelogGeneration): void {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO ai_generations (
          id, repository_id, branch, date_start, date_end, status, progress,
          commits_data, generated_content, ai_metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      
      stmt.run(
        generation.id,
        generation.repositoryId,
        generation.branch,
        generation.dateRange.start,
        generation.dateRange.end,
        generation.status,
        generation.progress,
        JSON.stringify(generation.commits),
        generation.generatedContent ? JSON.stringify(generation.generatedContent) : null,
        JSON.stringify(generation.aiMetadata),
        generation.createdAt,
        generation.updatedAt
      )
    } catch (error) {
      console.error('Error saving generation:', error)
      throw error
    }
  }

  // Update generation progress
  private updateGenerationProgress(id: string, progress: number): void {
    try {
      const stmt = db.prepare(`
        UPDATE ai_generations 
        SET progress = ?, updated_at = ? 
        WHERE id = ?
      `)
      stmt.run(progress, new Date().toISOString(), id)
    } catch (error) {
      console.error('Error updating generation progress:', error)
    }
  }

  // Update generation status
  private updateGenerationStatus(id: string, status: string): void {
    try {
      const stmt = db.prepare(`
        UPDATE ai_generations 
        SET status = ?, updated_at = ? 
        WHERE id = ?
      `)
      stmt.run(status, new Date().toISOString(), id)
    } catch (error) {
      console.error('Error updating generation status:', error)
    }
  }

  // Save changelog to database
  private saveChangelog(changelog: Changelog): void {
    try {
      statements.createChangelog.run(
        changelog.id,
        changelog.version,
        changelog.title,
        changelog.description || null,
        changelog.repositoryId,
        changelog.branch,
        changelog.dateRange.start,
        changelog.dateRange.end,
        changelog.status,
        changelog.publishedAt || null,
        changelog.publishedBy || null,
        JSON.stringify(changelog.metadata),
        JSON.stringify(changelog.tags),
        changelog.createdBy
      )

      // Save sections and changes
      changelog.sections.forEach(section => {
        statements.createChangelogSection.run(
          section.id,
          changelog.id,
          section.title,
          section.order
        )

        section.changes.forEach(change => {
          statements.createChangelogChange.run(
            change.id,
            section.id,
            change.description,
            change.type,
            change.impact,
            JSON.stringify(change.tags),
            JSON.stringify(change.commits || []),
            JSON.stringify(change.pullRequests || []),
            change.author || null,
            JSON.stringify(change.affectedComponents || []),
            change.migrationGuide || null,
            JSON.stringify(change.codeExamples || {})
          )
        })
      })
    } catch (error) {
      console.error('Error saving changelog:', error)
      throw error
    }
  }

  // Helper method to determine impact from category
  private determineImpact(category: string): 'major' | 'minor' | 'patch' {
    switch (category) {
      case 'breaking':
        return 'major'
      case 'feature':
        return 'minor'
      case 'bugfix':
      case 'security':
      default:
        return 'patch'
    }
  }

  // Enhance description using AI
  async enhanceDescription(description: string): Promise<{ enhanced: string; suggestions: string[] }> {
    return openaiService.enhanceDescription(description)
  }

  // Suggest tags using AI
  async suggestTags(description: string): Promise<string[]> {
    return openaiService.suggestTags(description)
  }
}

// Export singleton instance
export const changelogIntegrationService = new ChangelogIntegrationService() 