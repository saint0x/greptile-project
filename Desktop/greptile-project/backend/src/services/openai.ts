import { env, features } from '../lib/env.ts'
import { CHANGELOG_SYSTEM_PROMPT } from '../lib/prompts.ts'
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
    
    // Prepare commit data for analysis
    const commitData = analyses.map(analysis => ({
      sha: analysis.sha,
      message: analysis.description,
      type: analysis.type,
      impact: analysis.impact,
      breakingChange: analysis.breakingChange,
      userFacing: analysis.userFacing,
      confidence: analysis.confidence
    }))

    const structuredExample = `{
  "version": "2025-01-07.cedar",
  "title": "Enhanced Authentication & Performance Improvements",
  "summary": "This release introduces OAuth2 authentication, improves API performance by 40%, and fixes critical security vulnerabilities.",
  "sections": [
    {
      "id": "features",
      "title": "✨ New Features",
      "order": 1,
      "changes": [
        {
          "id": "feat-auth-oauth2",
          "description": "Add OAuth2 authentication with GitHub integration",
          "type": "feature",
          "impact": "minor",
          "tags": ["authentication", "oauth", "security"],
          "commits": ["abc123", "def456"],
          "pullRequests": [42],
          "author": "John Doe",
          "affectedComponents": ["authentication", "api"],
          "migrationGuide": "Update your authentication configuration to use the new OAuth2 flow",
          "codeExamples": {
            "before": "// Old authentication\\nauth.login(username, password)",
            "after": "// New OAuth2 flow\\nauth.loginWithOAuth('github')"
          }
        }
      ]
    },
    {
      "id": "bugfixes",
      "title": "🐛 Bug Fixes",
      "order": 2,
      "changes": [
        {
          "id": "fix-memory-leak",
          "description": "Fix memory leak in data processing pipeline",
          "type": "bugfix",
          "impact": "patch",
          "tags": ["performance", "memory", "backend"],
          "commits": ["ghi789"],
          "pullRequests": [43],
          "author": "Jane Smith",
          "affectedComponents": ["data-processing"],
          "migrationGuide": "",
          "codeExamples": {}
        }
      ]
    }
  ],
  "metadata": {
    "totalCommits": 15,
    "contributors": 3,
    "filesChanged": 25,
    "linesAdded": 450,
    "linesRemoved": 120,
    "generationMethod": "ai",
    "breakingChanges": 0,
    "newFeatures": 2,
    "bugFixes": 3,
    "confidence": 0.85
  },
  "migrationGuide": "## Migration Guide\\n\\nFor OAuth2 authentication, update your configuration...",
  "acknowledgments": ["@johndoe", "@janesmith"]
}`

    const userPrompt = `Generate a comprehensive changelog for repository "${repositoryName}".

**Repository Context:**
- Name: ${repositoryName}
- Branch: ${request.branch}
- Date Range: ${request.startDate} to ${request.endDate}
- Target Audience: ${options.targetAudience}
- Options: ${JSON.stringify(options)}

**Commit Analysis Data:**
${JSON.stringify(commitData, null, 2)}

**Analysis Requirements:**
1. Categorize each commit by type and impact
2. Group changes into logical sections with emoji icons
3. Write user-focused descriptions (benefits, not implementation)
4. Generate comprehensive metadata
5. Include migration guidance for breaking changes
6. Add code examples where relevant

**Expected Output Structure:**
Use this EXACT JSON structure (no markdown blocks, just raw JSON):

${structuredExample}

**Instructions:**
- Transform commit messages into clear, benefit-focused descriptions
- Group similar changes together
- Use semantic versioning for version number
- Include all metadata fields with calculated values
- Sort sections by importance (breaking → features → fixes → enhancements)
- Generate unique IDs for each change
- Extract author names from commit data
- Create meaningful tags for each change
- Write migration guides for breaking changes only
- Calculate confidence based on commit analysis quality`

    try {
      console.log('🤖 Generating changelog with comprehensive prompt...')
      
      const response = await this.makeRequest([
        { role: 'system', content: CHANGELOG_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ], 0.7)

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      console.log('📝 Raw AI response length:', content.length)

      // Clean up markdown code blocks if present
      let cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()
      
      // Additional cleanup for any remaining markdown
      cleanContent = cleanContent.replace(/```\n?|\n?```/g, '').trim()
      
      // Parse JSON response
      const changelog = JSON.parse(cleanContent)
      
      console.log('✅ Parsed changelog structure:', {
        version: changelog.version,
        sectionsCount: changelog.sections?.length || 0,
        totalChanges: changelog.sections?.reduce((sum: number, section: any) => sum + (section.changes?.length || 0), 0) || 0
      })
      
      // Ensure required metadata fields
      const metadata = {
        model: this.model,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        processingTime: Date.now(),
        confidence: changelog.metadata?.confidence || Math.min(...analyses.map(a => a.confidence)),
        totalCommits: analyses.length,
        contributors: new Set(analyses.map(a => a.sha.substring(0, 7))).size,
        filesChanged: changelog.metadata?.filesChanged || 0,
        linesAdded: changelog.metadata?.linesAdded || 0,
        linesRemoved: changelog.metadata?.linesRemoved || 0,
        generationMethod: 'ai',
        breakingChanges: analyses.filter(a => a.breakingChange).length,
        newFeatures: analyses.filter(a => a.type === 'feature').length,
        bugFixes: analyses.filter(a => a.type === 'bugfix').length
      }
      
      return {
        ...changelog,
        metadata
      }
    } catch (error) {
      console.error('❌ Changelog generation error:', error)
      console.error('Error details:', error instanceof Error ? error.message : String(error))
      throw new Error('Failed to generate changelog: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }


}

// Export singleton instance
export const openaiService = new OpenAIService() 