"use client"

import { useState } from "react"
import { Plus, Trash2, Sparkles, Check, X, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { AuthGuard } from "@/components/auth-guard"

interface UpdateEntry {
  id: string
  description: string
  tag: string
}

const tagOptions = [
  { value: "feature", label: "Feature", color: "bg-green-100 text-green-800" },
  { value: "bugfix", label: "Bug Fix", color: "bg-red-100 text-red-800" },
  { value: "enhancement", label: "Enhancement", color: "bg-blue-100 text-blue-800" },
  { value: "breaking", label: "Breaking Change", color: "bg-orange-100 text-orange-800" },
  { value: "deprecation", label: "Deprecation", color: "bg-yellow-100 text-yellow-800" },
  { value: "security", label: "Security", color: "bg-purple-100 text-purple-800" },
]

const mockGeneratedChangelog = {
  version: "2025-01-07.cedar",
  title: "Enhanced User Experience and Performance Improvements",
  sections: [
    {
      title: "New Features",
      changes: [
        {
          description: "Introduced advanced search functionality with real-time filtering",
          tags: ["Search", "UI/UX"],
          category: "feature",
        },
        {
          description: "Added dark mode support across all dashboard components",
          tags: ["UI/UX", "Accessibility"],
          category: "feature",
        },
      ],
    },
    {
      title: "Bug Fixes and Improvements",
      changes: [
        {
          description: "Resolved pagination issues in data tables",
          tags: ["Data", "Performance"],
          category: "bugfix",
        },
        {
          description: "Optimized API response times by 40%",
          tags: ["API", "Performance"],
          category: "enhancement",
        },
      ],
    },
  ],
}

function ChangelogDashboardContent() {
  const [entries, setEntries] = useState<UpdateEntry[]>([{ id: "1", description: "", tag: "" }])
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerated, setShowGenerated] = useState(false)
  const [generatedChangelog, setGeneratedChangelog] = useState(mockGeneratedChangelog)

  const addEntry = () => {
    const newEntry: UpdateEntry = {
      id: Date.now().toString(),
      description: "",
      tag: "",
    }
    setEntries([...entries, newEntry])
  }

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter((entry) => entry.id !== id))
    }
  }

  const updateEntry = (id: string, field: keyof UpdateEntry, value: string) => {
    setEntries(entries.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)))
  }

  const handleSubmit = async () => {
    const validEntries = entries.filter((entry) => entry.description.trim() && entry.tag)
    if (validEntries.length === 0) return

    setIsGenerating(true)

    // Simulate AI generation delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setIsGenerating(false)
    setShowGenerated(true)
  }

  const handleAccept = () => {
    // Here you would typically save the changelog to your backend
    console.log("Changelog accepted:", generatedChangelog)
    // Reset form or redirect
    setShowGenerated(false)
    setEntries([{ id: "1", description: "", tag: "" }])
  }

  const handleDeny = () => {
    setShowGenerated(false)
  }

  const getTagColor = (tagValue: string) => {
    const tag = tagOptions.find((t) => t.value === tagValue)
    return tag?.color || "bg-gray-100 text-gray-800"
  }

  const getTagLabel = (tagValue: string) => {
    const tag = tagOptions.find((t) => t.value === tagValue)
    return tag?.label || tagValue
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="relative mb-6">
            <Sparkles className="w-16 h-16 mx-auto text-blue-600 animate-pulse" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="absolute inset-0"
            >
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
            </motion.div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Generating Changelog</h2>
          <p className="text-gray-600">AI is crafting your changelog entry...</p>
        </motion.div>
      </div>
    )
  }

  if (showGenerated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            {/* Header */}
            <div className="mb-8">
              <Button variant="ghost" onClick={handleDeny} className="mb-4 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Editor
              </Button>
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-blue-600" />
                <h1 className="text-3xl font-bold text-gray-900">AI Generated Changelog</h1>
              </div>
              <p className="text-gray-600">Review the generated changelog and make your choice.</p>
            </div>

            {/* Generated Changelog Preview */}
            <Card className="mb-8">
              <CardContent className="p-0">
                {/* Release Header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-xl font-bold text-gray-900">{generatedChangelog.version}</h3>
                  <p className="text-gray-600 mt-1">{generatedChangelog.title}</p>
                </div>

                {/* Release Content */}
                <div className="p-6 space-y-8">
                  {generatedChangelog.sections.map((section, sectionIndex) => (
                    <div key={sectionIndex}>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">{section.title}</h4>
                      <div className="space-y-3">
                        {section.changes.map((change, changeIndex) => (
                          <div
                            key={changeIndex}
                            className="flex items-start justify-between py-3 border-b border-gray-100 last:border-b-0"
                          >
                            <p className="text-gray-700 flex-1 pr-4">{change.description}</p>
                            <div className="flex gap-2 flex-shrink-0">
                              {change.tags.map((tag, tagIndex) => (
                                <Badge
                                  key={tagIndex}
                                  variant="secondary"
                                  className="bg-blue-100 text-blue-800 text-xs font-medium"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <Button onClick={handleDeny} variant="outline" size="lg" className="px-8">
                <X className="w-4 h-4 mr-2" />
                Deny & Edit
              </Button>
              <Button onClick={handleAccept} size="lg" className="px-8 bg-green-600 hover:bg-green-700">
                <Check className="w-4 h-4 mr-2" />
                Accept & Publish
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Create Changelog Entry</h1>
            <p className="text-lg text-gray-600">Add your updates and let AI generate a professional changelog.</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">What updates have been made?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <AnimatePresence>
              {entries.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex gap-4 items-start"
                >
                  <div className="flex-1 space-y-3">
                    <Textarea
                      placeholder="Describe the update or change made..."
                      value={entry.description}
                      onChange={(e) => updateEntry(entry.id, "description", e.target.value)}
                      className="min-h-[80px] resize-none"
                    />
                    <Select value={entry.tag} onValueChange={(value) => updateEntry(entry.id, "tag", value)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select tag" />
                      </SelectTrigger>
                      <SelectContent>
                        {tagOptions.map((tag) => (
                          <SelectItem key={tag.value} value={tag.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${tag.color.split(" ")[0]}`}></div>
                              {tag.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    {entries.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEntry(entry.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    {index === entries.length - 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={addEntry}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Preview of current entries */}
            {entries.some((entry) => entry.description.trim() && entry.tag) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-8 p-4 bg-gray-50 rounded-lg border"
              >
                <h3 className="font-semibold text-gray-900 mb-3">Preview:</h3>
                <div className="space-y-2">
                  {entries
                    .filter((entry) => entry.description.trim() && entry.tag)
                    .map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between py-2">
                        <p className="text-sm text-gray-700 flex-1 pr-4">{entry.description}</p>
                        <Badge variant="secondary" className={`${getTagColor(entry.tag)} text-xs font-medium`}>
                          {getTagLabel(entry.tag)}
                        </Badge>
                      </div>
                    ))}
                </div>
              </motion.div>
            )}

            <div className="flex justify-end pt-6">
              <Button
                onClick={handleSubmit}
                size="lg"
                disabled={!entries.some((entry) => entry.description.trim() && entry.tag)}
                className="px-8"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Changelog
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ChangelogDashboard() {
  return (
    <AuthGuard>
      <ChangelogDashboardContent />
    </AuthGuard>
  )
}
