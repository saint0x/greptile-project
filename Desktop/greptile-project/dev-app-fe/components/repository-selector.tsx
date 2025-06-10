"use client"

import { motion } from "framer-motion"
import { Folder, GitBranch } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Repository, Branch } from "@/types/changelog"

interface RepositorySelectorProps {
  repositories: Repository[]
  branches: Branch[]
  selectedRepo: string
  selectedBranch: string
  isLoadingRepositories: boolean
  isLoadingBranches: boolean
  onRepositoryChange: (repositoryId: string) => void
  onBranchChange: (branch: string) => void
}

export function RepositorySelector({
  repositories,
  branches,
  selectedRepo,
  selectedBranch,
  isLoadingRepositories,
  isLoadingBranches,
  onRepositoryChange,
  onBranchChange,
}: RepositorySelectorProps) {
  const selectedRepository = repositories.find((repo) => repo.id === selectedRepo)

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg border border-gray-200">
          <Folder className="w-5 h-5 text-gray-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Repository</h3>
          <p className="text-sm text-gray-600">Select the repository and branch to analyze</p>
        </div>
      </div>

      {/* Repository Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Repository</label>
        <Select value={selectedRepo} onValueChange={onRepositoryChange} disabled={isLoadingRepositories}>
          <SelectTrigger className="h-12 bg-white border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-left">
            <SelectValue placeholder={isLoadingRepositories ? "Loading repositories..." : "Choose a repository"} />
          </SelectTrigger>
          <SelectContent>
            {repositories.map((repo) => (
              <SelectItem key={repo.id} value={repo.id} className="py-3">
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">
                    {repo.owner}/{repo.name}
                  </span>
                  {repo.description && <span className="text-sm text-gray-500">{repo.description}</span>}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Branch Selection - Hierarchical */}
      {selectedRepository && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="ml-6 pl-6 border-l-2 border-blue-200 space-y-3"
        >
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-gray-500" />
            <label className="block text-sm font-medium text-gray-700">Branch</label>
          </div>
          <Select value={selectedBranch} onValueChange={onBranchChange} disabled={isLoadingBranches}>
            <SelectTrigger className="h-12 bg-white border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              <SelectValue placeholder={isLoadingBranches ? "Loading branches..." : "Choose a branch"} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.name} value={branch.name} className="py-3">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-gray-400" />
                      <span className="font-mono text-sm">{branch.name}</span>
                    </div>
                    {branch.isDefault && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                        default
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      )}
    </div>
  )
}
