"use client"

import { useState } from "react"
import { ExternalLink, ChevronRight, Calendar, Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useChangelogs } from "@/hooks/use-changelog-api"
import { tagColors } from "@/types/changelog"
import { ErrorMessage } from "@/components/changelog/error-message"
import { LoadingSkeleton } from "@/components/changelog/loading-skeleton"
import { env, getRSSFeedUrl } from "@/lib/env"

const formatReleaseDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

export default function ChangelogPage() {
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch changelogs
  const { 
    data: changelogsResponse, 
    isLoading, 
    error,
    refetch
  } = useChangelogs({
    page: currentPage,
    limit: 10,
    sortBy: 'publishedAt',
    sortOrder: 'desc'
  })

  // Extract data from response
  const changelogs = changelogsResponse?.changelogs || []
  const pagination = changelogsResponse?.pagination

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <LoadingSkeleton type="list" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <ErrorMessage 
            message={error.message || "Failed to load changelogs"}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Title */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-3">Changelog</h1>
              <p className="text-lg text-gray-600">
                Keep track of changes and upgrades to our APIs and services.
              </p>
            </div>
            
            {env.FEATURES.RSS_FEED && (
              <Link href={getRSSFeedUrl()} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  RSS Feed
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Changelog List */}
        <div className="space-y-6">
          {changelogs.map((changelog: any) => {
            const hasDescription = changelog.description && changelog.description.trim().length > 0
            
            return (
              <Card key={changelog.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline" className="text-sm">
                          {changelog.version}
                        </Badge>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          <span>{formatReleaseDate(changelog.publishedAt)}</span>
                        </div>
                      </div>
                      <CardTitle className="text-xl mb-1">{changelog.title}</CardTitle>
                      {hasDescription && (
                        <p className="text-gray-600 text-sm mb-3">{changelog.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4" />
                          <span>{changelog.repository.owner}/{changelog.repository.name}</span>
                        </div>
                      </div>
                      {changelog.tags && changelog.tags.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {changelog.tags.slice(0, 3).map((tag: string) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className={`${
                                tagColors[tag as keyof typeof tagColors] || tagColors.default
                              } text-xs`}
                            >
                              {tag}
                            </Badge>
                          ))}
                          {changelog.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{changelog.tags.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </div>

        {/* Empty State */}
        {changelogs.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No changelogs yet</h3>
            <p className="text-gray-600">Check back later for updates!</p>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.hasPrev}
            >
              Previous
            </Button>
            
            <span className="text-sm text-gray-600 mx-4">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!pagination.hasNext}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
