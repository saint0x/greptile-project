"use client"

import { motion } from "framer-motion"
import { ArrowLeft, CalendarDays, Check, Folder, GitBranch, X, Calendar } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { GeneratedChangelog } from "@/types/changelog"

interface ChangelogPreviewProps {
  changelog: GeneratedChangelog
  onAccept: () => void
  onDeny: () => void
}

export function ChangelogPreview({ changelog, onAccept, onDeny }: ChangelogPreviewProps) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          {/* Header */}
          <header className="mb-12">
            <Button variant="ghost" onClick={onDeny} className="mb-6 text-gray-600 hover:text-gray-900 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Generator
            </Button>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Generated Changelog</h1>
              <p className="text-lg text-gray-600">Review and publish your AI-generated changelog.</p>

              <div className="flex items-center gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Folder className="w-4 h-4" />
                  {changelog.repository}
                </span>
                <span className="flex items-center gap-1">
                  <GitBranch className="w-4 h-4" />
                  {changelog.branch}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-4 h-4" />
                  {changelog.dateRange}
                </span>
              </div>
            </div>
          </header>

          {/* Changelog Content */}
          <div className="space-y-12">
            {/* Version Header */}
            <div className="bg-blue-50 rounded-lg border border-blue-100 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{changelog.version}</h2>
              <p className="text-lg text-gray-700">{changelog.title}</p>
            </div>

            {/* Date Section */}
            <div className="flex items-center gap-3 text-gray-600">
              <Calendar className="w-5 h-5" />
              <span className="text-lg font-medium">
                {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
            </div>

            {/* Changelog Sections */}
            <div className="space-y-12">
              {changelog.sections.map((section, sectionIndex) => (
                <section key={sectionIndex} className="space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900">{section.title}</h3>

                  <div className="space-y-6">
                    {section.changes.map((change, changeIndex) => (
                      <article key={changeIndex} className="flex items-start justify-between py-4">
                        <div className="flex-1 pr-6">
                          <p className="text-gray-800 leading-relaxed mb-3">{change.description}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {change.commits && change.commits[0] && (
                              <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">
                                {change.commits[0]}
                              </span>
                            )}
                            <span>by {change.author}</span>
                            {change.pullRequests && change.pullRequests[0] && <span>PR #{change.pullRequests[0]}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {change.tags.map((tag, tagIndex) => (
                            <Badge
                              key={tagIndex}
                              variant="secondary"
                              className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center pt-8 border-t border-gray-200">
              <Button
                onClick={onDeny}
                variant="outline"
                size="lg"
                className="px-6 py-3 text-sm font-medium border-gray-300 hover:bg-gray-50"
              >
                <X className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              <Button
                onClick={onAccept}
                size="lg"
                className="px-6 py-3 text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white"
              >
                <Check className="w-4 h-4 mr-2" />
                Publish Changelog
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
