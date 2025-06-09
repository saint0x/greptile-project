import { env, features } from '../lib/env.ts'
import type { CommitAnalysis, ChangelogRequest } from '../types/index.ts'

export class OpenAIService {
  private apiKey: string
  private model: string

  constructor() {
    this.apiKey = env.OPENAI_API_KEY || ''
    this.model = env.OPENAI_MODEL
  }

  static isAvailable(): boolean {
    return features.ai
  }

  private async makeRequest(messages: any[], temperature = 0.7): Promise<any> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        max_tokens: 2000,
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${error}`)
    }

    return response.json()
  }

  // Analyze commits and categorize them
  async analyzeCommits(commits: any[]): Promise<CommitAnalysis[]> {
    const commitTexts = commits.map(commit => 
      `${commit.sha.substring(0, 7)}: ${commit.commit.message}`
    ).join('\n')

    const prompt = `Analyze these Git commits and categorize each one. Return a JSON array where each object has:
- sha: the commit SHA
- type: one of "feature", "bugfix", "breaking", "docs", "refactor", "test", "chore"
- description: cleaned up commit message (user-friendly)
- impact: "major", "minor", or "patch"
- breakingChange: boolean
- affectedComponents: array of component names mentioned
- userFacing: boolean (is this change visible to end users?)
- confidence: number 0-1 (how confident you are in the categorization)

Commits to analyze:
${commitTexts}

Return only valid JSON array, no markdown or explanations.`

    try {
      const response = await this.makeRequest([
        { role: 'system', content: 'You are an expert at analyzing Git commits and categorizing software changes.' },
        { role: 'user', content: prompt }
      ])

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      // Clean up markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()

      // Parse JSON response
      const analyses = JSON.parse(cleanContent)
      
      // Validate and clean up the response
      return analyses.map((analysis: any, index: number) => ({
        sha: commits[index]?.sha || analysis.sha,
        type: analysis.type || 'chore',
        scope: analysis.scope,
        description: analysis.description || commits[index]?.commit?.message || '',
        impact: analysis.impact || 'patch',
        breakingChange: Boolean(analysis.breakingChange),
        affectedComponents: Array.isArray(analysis.affectedComponents) ? analysis.affectedComponents : [],
        userFacing: Boolean(analysis.userFacing),
        confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.5
      }))
    } catch (error) {
      console.error('Commit analysis error:', error)
      
      // Fallback: basic categorization
      return commits.map(commit => ({
        sha: commit.sha,
        type: 'chore' as const,
        description: commit.commit.message,
        impact: 'patch' as const,
        breakingChange: false,
        affectedComponents: [],
        userFacing: false,
        confidence: 0.3
      }))
    }
  }

  // Generate changelog from analyzed commits
  async generateChangelog(
    analyses: CommitAnalysis[],
    request: ChangelogRequest,
    repositoryName: string
  ): Promise<any> {
    const { options } = request
    
    // Group commits by type
    const groupedCommits = analyses.reduce((groups: any, analysis) => {
      if (!groups[analysis.type]) {
        groups[analysis.type] = []
      }
      groups[analysis.type].push(analysis)
      return groups
    }, {})

    const prompt = `Generate a professional changelog for the repository "${repositoryName}" based on these categorized commits.

Repository: ${repositoryName}
Branch: ${request.branch}
Date Range: ${request.startDate} to ${request.endDate}
Target Audience: ${options.targetAudience}

Grouped Commits:
${Object.entries(groupedCommits).map(([type, commits]: [string, any]) => 
  `${type.toUpperCase()}:\n${commits.map((c: any) => `- ${c.description}`).join('\n')}`
).join('\n\n')}

Generate a changelog with:
1. A descriptive version number (e.g., "2025-01-07.cedar")
2. A compelling title summarizing the release
3. Sections grouped by change type with user-friendly titles
4. Each change should be clear and benefit-focused

Return JSON in this exact format:
{
  "version": "version-string",
  "title": "release-title",
  "sections": [
    {
      "title": "section-title",
      "changes": [
        {
          "description": "user-friendly-description",
          "tags": ["tag1", "tag2"],
          "category": "feature|bugfix|enhancement|breaking|deprecation|security",
          "commit": "sha",
          "author": "author-name"
        }
      ]
    }
  ]
}

Focus on benefits to users, not technical implementation details.`

    try {
      const response = await this.makeRequest([
        { role: 'system', content: 'You are an expert technical writer who creates clear, user-focused changelogs.' },
        { role: 'user', content: prompt }
      ], 0.8)

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      // Clean up markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()
      
      // Parse JSON response
      const changelog = JSON.parse(cleanContent)
      
      return {
        ...changelog,
        metadata: {
          model: this.model,
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          processingTime: Date.now(),
          confidence: Math.min(...analyses.map(a => a.confidence))
        }
      }
    } catch (error) {
      console.error('Changelog generation error:', error)
      throw new Error('Failed to generate changelog')
    }
  }

  // Enhance a single description
  async enhanceDescription(description: string): Promise<{ enhanced: string; suggestions: string[] }> {
    const prompt = `Improve this changelog entry to be more user-friendly and benefit-focused:

"${description}"

Provide:
1. An enhanced version that's clear and focuses on user benefits
2. 2-3 alternative suggestions

Return JSON:
{
  "enhanced": "improved-description",
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}`

    try {
      const response = await this.makeRequest([
        { role: 'system', content: 'You are an expert at writing user-friendly changelog entries that focus on benefits rather than technical details.' },
        { role: 'user', content: prompt }
      ])

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      // Clean up markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()

      return JSON.parse(cleanContent)
    } catch (error) {
      console.error('Description enhancement error:', error)
      return {
        enhanced: description,
        suggestions: [description]
      }
    }
  }

  // Suggest tags for a description
  async suggestTags(description: string): Promise<string[]> {
    const prompt = `Suggest 2-4 relevant tags for this changelog entry:

"${description}"

Consider these common tag categories:
- Product areas: API, UI, Dashboard, Mobile, etc.
- Change types: Performance, Security, Accessibility, etc.
- Technologies: React, Database, Authentication, etc.

Return only a JSON array of strings: ["tag1", "tag2", "tag3"]`

    try {
      const response = await this.makeRequest([
        { role: 'system', content: 'You are an expert at categorizing software changes with relevant tags.' },
        { role: 'user', content: prompt }
      ])

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      // Clean up markdown code blocks if present  
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()

      const tags = JSON.parse(cleanContent)
      return Array.isArray(tags) ? tags : []
    } catch (error) {
      console.error('Tag suggestion error:', error)
      return []
    }
  }
}

// Export singleton instance
export const openaiService = new OpenAIService() 