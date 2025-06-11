"use client"

import { ArrowLeft, ExternalLink, Calendar, Tag, Copy, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { useChangelogDetail } from "@/hooks/use-changelog-api"
import { LoadingSkeleton } from "@/components/changelog/loading-skeleton"
import { ErrorMessage } from "@/components/changelog/error-message"
import { TagBadge } from "@/components/changelog/tag-badge"
import { tagColors } from "@/types/changelog"
import { memo, useState } from "react"

// Memoized code example component with copy functionality
const CodeExample = memo(function CodeExample({ 
  language, 
  code, 
  changelogId 
}: { 
  language: string
  code: string
  changelogId: string 
}) {
  const [copied, setCopied] = useState(false)
  // Remove code copy tracking - analytics not implemented

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy code:', error)
    }
  }

  return (
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-200"
        onClick={handleCopy}
      >
        {copied ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    </div>
  )
})

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

const formatDateRange = (start: string, end: string) => {
  const startDate = new Date(start)
  const endDate = new Date(end)
  
  if (startDate.toDateString() === endDate.toDateString()) {
    return formatDate(start)
  }
  
  return `${formatDate(start)} - ${formatDate(end)}`
}

export default function ChangelogDetailPage({ params }: { params: { id: string } }) {
  const { data, isLoading, error } = useChangelogDetail(params.id)
  const changelog = data

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <LoadingSkeleton type="detail" />
        </div>
      </div>
    )
  }

  if (error || !changelog) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <ErrorMessage 
            message={error?.message || "The requested changelog could not be found."}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-gray-700">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/changelog" className="hover:text-gray-700">
            Changelog
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{changelog.version}</span>
        </nav>

        {/* Back Button */}
        <Link href="/changelog" className="mb-6 inline-block">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Changelog
          </Button>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Badge variant="outline" className="text-sm">
              {changelog.version}
            </Badge>
            {changelog.publishedAt && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(changelog.publishedAt)}</span>
              </div>
            )}
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">{changelog.title}</h1>
          
          {changelog.description && (
            <p className="text-lg text-gray-600 mb-4">{changelog.description}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              <span>{changelog.repository.owner}/{changelog.repository.name}</span>
            </div>
            <div>
              {formatDateRange(changelog.dateRange.start, changelog.dateRange.end)}
            </div>
          </div>

          {changelog.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {changelog.tags.map((tag: string) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className={`${
                    tagColors[tag as keyof typeof tagColors] || tagColors.default
                  } text-sm font-medium`}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Changelog Sections - Only show sections with changes */}
        <div className="space-y-8">
          {changelog.sections
            .filter((section: any) => section.changes && section.changes.length > 0)
            .map((section: any) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="text-xl">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {section.changes.map((change: any) => (
                    <div key={change.id} className="border-l-4 border-blue-200 pl-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{change.description}</h4>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge
                            variant="secondary"
                            className={`${
                              tagColors[change.type as keyof typeof tagColors] || tagColors.default
                            } text-xs`}
                          >
                            {change.type}
                          </Badge>
                          {change.impact && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                change.impact === 'major' ? 'border-red-300 text-red-700' :
                                change.impact === 'minor' ? 'border-yellow-300 text-yellow-700' :
                                'border-green-300 text-green-700'
                              }`}
                            >
                              {change.impact}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Tags */}
                      {change.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mb-3">
                          {change.tags.map((tag: string) => (
                            <TagBadge key={tag} tag={tag} />
                          ))}
                        </div>
                      )}

                      {change.affectedComponents && change.affectedComponents.length > 0 && (
                        <div className="mb-3">
                          <span className="text-sm text-gray-600">Affected components: </span>
                          <span className="text-sm font-mono text-gray-800">
                            {change.affectedComponents.join(', ')}
                          </span>
                        </div>
                      )}

                      {change.author && (
                        <div className="mb-3">
                          <span className="text-sm text-gray-600">Author: </span>
                          <span className="text-sm text-gray-800">{change.author}</span>
                        </div>
                      )}

                      {change.migrationGuide && (
                        <Card className="mt-4">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Migration Guide</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-2">
                            <p className="text-sm text-gray-700">{change.migrationGuide}</p>
                          </CardContent>
                        </Card>
                      )}

                      {/* Code Examples */}
                      {change.codeExamples && Object.keys(change.codeExamples).length > 0 && (
                        <div className="mt-4">
                          <Tabs defaultValue="before" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="before">Before</TabsTrigger>
                              <TabsTrigger value="after">After</TabsTrigger>
                            </TabsList>
                            <TabsContent value="before" className="mt-2">
                              <CodeExample
                                language="typescript"
                                code={change.codeExamples.before as string || "// No example provided"}
                                changelogId={changelog.id}
                              />
                            </TabsContent>
                            <TabsContent value="after" className="mt-2">
                              <CodeExample
                                language="typescript"
                                code={change.codeExamples.after as string || "// No example provided"}
                                changelogId={changelog.id}
                              />
                            </TabsContent>
                          </Tabs>
                        </div>
                      )}

                      {/* Related Commits */}
                      {change.commits && change.commits.length > 0 && (
                        <div className="text-sm text-gray-600 mt-3">
                          <span className="font-medium">Commits: </span>
                          <div className="inline">
                            {change.commits.map((commit: string) => (
                              <code key={commit} className="bg-gray-100 px-1 py-0.5 rounded mr-2 text-xs">
                                {commit.substring(0, 7)}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Related Pull Requests */}
                      {change.pullRequests && change.pullRequests.length > 0 && (
                        <div className="text-sm text-gray-600 mt-2">
                          <span className="font-medium">Pull Requests: </span>
                          {change.pullRequests.map((pr: number, index: number) => (
                            <span key={pr}>
                              #{pr}
                              {index < change.pullRequests.length - 1 && ", "}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Repository Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Repository Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-600">Repository: </span>
                <a 
                  href={`https://github.com/${changelog.repository.owner}/${changelog.repository.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                >
                  {changelog.repository.fullName}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div>
                <span className="text-sm text-gray-600">Branch: </span>
                <span className="text-sm font-mono text-gray-800">{changelog.branch}</span>
              </div>
              {changelog.repository.description && (
                <div className="md:col-span-2">
                  <span className="text-sm text-gray-600">Description: </span>
                  <span className="text-sm text-gray-800">{changelog.repository.description}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

                 {/* Navigation */}
         <div className="mt-8 pt-6 border-t border-gray-200">
           <Link href="/changelog">
             <Button variant="outline">
               <ArrowLeft className="w-4 h-4 mr-2" />
               Back to All Changelogs
             </Button>
           </Link>
         </div>
      </div>
    </div>
  )
}
