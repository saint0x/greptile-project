"use client"

import { ChevronRight, ExternalLink, Calendar, Tag } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useChangelogs } from "@/hooks/use-changelog-api"
import { LoadingSkeleton } from "@/components/changelog/loading-skeleton"
import { ErrorMessage } from "@/components/changelog/error-message"
import { tagColors } from "@/types/changelog"
import { env, getRSSFeedUrl } from "@/lib/env"

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })
}

export default function HomePage() {
  // Fetch just a few recent changelogs for the homepage
  const { 
    data: recentChangelogsResponse, 
    isLoading, 
    error 
  } = useChangelogs({ 
    page: 1, 
    limit: 3, 
    sortBy: 'publishedAt', 
    sortOrder: 'desc' 
  })

  const recentChangelogs = recentChangelogsResponse?.changelogs || []

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <LoadingSkeleton type="list" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <ErrorMessage 
            message={error.message || "Failed to load changelogs"}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Changelog
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Keep track of new features, improvements, and important updates.
            </p>

            <div className="flex justify-center gap-4">
              <Link href="/changelog">
                <Button size="lg" className="gap-2">
                  View All Changelogs
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
              
              {env.FEATURES.RSS_FEED && (
                <Link href={getRSSFeedUrl()} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="gap-2">
                    <ExternalLink className="w-4 h-4" />
                    RSS Feed
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Updates Preview */}
      {recentChangelogs.length > 0 && (
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Recent Updates</h2>
            <Link href="/changelog">
              <Button variant="ghost" className="gap-2">
                View All
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="space-y-4">
            {recentChangelogs.map((changelog: any) => (
              <Card key={changelog.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className="text-sm">
                      {changelog.version}
                    </Badge>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(changelog.publishedAt)}</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg">{changelog.title}</CardTitle>
                  {changelog.description && (
                    <p className="text-gray-600 text-sm mt-2 line-clamp-2">
                      {changelog.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Tag className="w-4 h-4" />
                      <span>{changelog.repository.owner}/{changelog.repository.name}</span>
                    </div>
                    <Link href={`/changelog/${changelog.id}`}>
                      <Button variant="outline" size="sm" className="gap-2">
                        View
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                  {changelog.tags && changelog.tags.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-3">
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
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
