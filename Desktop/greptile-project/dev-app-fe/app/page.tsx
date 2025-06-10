"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { fetchRepositories, fetchBranches, setAuthToken } from "@/lib/api"
import { useGenerateChangelog, useGenerationStatus, useAcceptGeneration } from "@/hooks/useChangelogGeneration"
import { RepositorySelector } from "@/components/repository-selector"
import { DateRangeSelector } from "@/components/date-range-selector"
import { LoadingState } from "@/components/loading-state"
import { ChangelogPreview } from "@/components/changelog-preview"
import { GenerateButton } from "@/components/generate-button"
import { PageHeader } from "@/components/page-header"
import { AuthGuard } from "@/components/auth-guard"

import type { ChangelogRequest } from "@/types/changelog"

function ChangelogCreatorContent() {
  const { data: session } = useSession()
  const [selectedRepo, setSelectedRepo] = useState<string>("")
  const [selectedBranch, setSelectedBranch] = useState<string>("")
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [generationId, setGenerationId] = useState<string>("")

  const queryClient = useQueryClient()

  // Data fetching queries - session is guaranteed to exist due to AuthGuard
  const { data: repositories = [], isLoading: isLoadingRepositories } = useQuery({
    queryKey: ["repositories"],
    queryFn: () => {
      console.log("🚀 fetchRepositories called")
      return fetchRepositories()
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: branches = [], isLoading: isLoadingBranches } = useQuery({
    queryKey: ["branches", selectedRepo],
    queryFn: () => {
      console.log("🚀 fetchBranches called for repo:", selectedRepo)
      const selectedRepository = repositories.find((repo) => repo.id === selectedRepo)
      return fetchBranches(selectedRepo, selectedRepository?.defaultBranch)
    },
    enabled: !!selectedRepo,
    staleTime: 2 * 60 * 1000,
  })

  // Changelog generation hooks
  const generateMutation = useGenerateChangelog()
  const acceptMutation = useAcceptGeneration()
  const { data: generationStatus, isLoading: isPolling } = useGenerationStatus(generationId)
  
  // Computed states
  const isGenerating = generateMutation.isPending || (generationStatus?.status === 'processing')
  const hasCompletedGeneration = generationStatus?.status === 'completed' && generationStatus?.generatedContent
  const showGenerated = Boolean(hasCompletedGeneration)

  // Debug generation state
  console.log("🤖 Generation state:", {
    generationId,
    generationStatus: generationStatus?.status,
    progress: generationStatus?.progress,
    isGenerating,
    showGenerated,
    hasGeneratedContent: !!generationStatus?.generatedContent
  })

  // Set auth token for API calls when session changes
  useEffect(() => {
    if (session?.accessToken) {
      console.log("Setting GitHub token:", session.accessToken?.substring(0, 10) + "...")
      setAuthToken(session.accessToken)
    }
  }, [session?.accessToken])

  // Watch for generation status changes to show notifications
  useEffect(() => {
    if (generationStatus?.status === 'completed') {
      toast.success("🎉 Changelog generated successfully!", {
        description: "Review and publish your changelog below."
      })
    } else if (generationStatus?.status === 'failed') {
      // Generic error message since we don't store specific error details
      toast.error("❌ Generation failed", {
        description: "This might be due to no commits in the date range or API issues. Try a different date range."
      })
    }
  }, [generationStatus?.status])

  // Event handlers
  const handleRepositoryChange = (repositoryId: string) => {
    setSelectedRepo(repositoryId)
    setSelectedBranch("")
  }

  const handleSubmit = () => {
    if (!isFormValid) return

    const request: ChangelogRequest = {
      repositoryId: selectedRepo,
      branch: selectedBranch,
      startDate: startDate!.toISOString(),
      endDate: endDate!.toISOString(),
      options: {
        groupBy: 'type',
        includeBreakingChanges: true,
        includeBugFixes: true,
        includeFeatures: true,
        includeDocumentation: false,
        excludePatterns: [],
        targetAudience: 'developers'
      }
    }

    generateMutation.mutate(request, {
      onSuccess: (generation) => {
        console.log("🚀 Generation started:", generation.id)
        setGenerationId(generation.id)
        toast.info("🤖 Generating changelog...", {
          description: "This may take a few moments."
        })
      },
      onError: (error) => {
        console.error("❌ Failed to start generation:", error)
        toast.error("❌ Failed to start generation", {
          description: error instanceof Error ? error.message : "Unknown error occurred"
        })
      }
    })
  }

  const handleAccept = () => {
    if (!generationId) return
    
    acceptMutation.mutate(generationId, {
      onSuccess: (changelog) => {
        console.log("✅ Changelog published successfully:", changelog.id)
        toast.success("🚀 Changelog published!", {
          description: "Your changelog is now live and visible to users."
        })
        resetForm()
      },
      onError: (error) => {
        console.error("❌ Failed to publish changelog:", error)
        toast.error("❌ Failed to publish changelog", {
          description: error instanceof Error ? error.message : "Unknown error occurred"
        })
      }
    })
  }

  const handleDeny = () => {
    toast.info("📝 Changelog discarded", {
      description: "You can generate a new one anytime."
    })
    resetForm()
  }

  const resetForm = () => {
    setGenerationId("")
    setSelectedRepo("")
    setSelectedBranch("")
    setStartDate(undefined)
    setEndDate(undefined)
  }

  // Computed values
  const selectedRepository = repositories.find((repo) => repo.id === selectedRepo)
  const isFormValid = selectedRepo && selectedBranch && startDate && endDate

  // Render states
  if (isGenerating) {
    return <LoadingState 
      repository={selectedRepository} 
      branch={selectedBranch} 
      generationStatus={generationStatus}
    />
  }

  if (showGenerated && generationStatus?.generatedContent) {
    return <ChangelogPreview changelog={generationStatus.generatedContent} onAccept={handleAccept} onDeny={handleDeny} />
  }

  return (
    <div className="min-h-screen bg-white">
      <PageHeader />

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Repository & Branch Selection - Blue Container */}
        <div className="bg-blue-50 rounded-lg border border-blue-100 p-8">
          <RepositorySelector
            repositories={repositories}
            branches={branches}
            selectedRepo={selectedRepo}
            selectedBranch={selectedBranch}
            isLoadingRepositories={isLoadingRepositories}
            isLoadingBranches={isLoadingBranches}
            onRepositoryChange={handleRepositoryChange}
            onBranchChange={setSelectedBranch}
          />
        </div>

        {/* Date Range Selection - Outside Container */}
        <DateRangeSelector
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />

        {/* Generate Button - At Bottom */}
        <div className="pt-8">
          <GenerateButton isDisabled={!isFormValid} onClick={handleSubmit} />
        </div>
      </main>
    </div>
  )
}

export default function ChangelogCreator() {
  return (
    <AuthGuard>
      <ChangelogCreatorContent />
    </AuthGuard>
  )
}
