"use client"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface FiltersProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  selectedProduct: string
  setSelectedProduct: (product: string) => void
  selectedCategory: string
  setSelectedCategory: (category: string) => void
  releaseChannel: string
}

export function Filters({
  searchQuery,
  setSearchQuery,
  selectedProduct,
  setSelectedProduct,
  selectedCategory,
  setSelectedCategory,
  releaseChannel,
}: FiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="relative flex-1 min-w-64">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white border-gray-300"
        />
      </div>

      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
        <SelectTrigger className="w-32 bg-white">
          <SelectValue placeholder="Product" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Products</SelectItem>
          <SelectItem value="payments">Payments</SelectItem>
          <SelectItem value="connect">Connect</SelectItem>
          <SelectItem value="billing">Billing</SelectItem>
        </SelectContent>
      </Select>

      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
        <SelectTrigger className="w-40 bg-white">
          <SelectValue placeholder="Breaking changes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Changes</SelectItem>
          <SelectItem value="breaking">Breaking</SelectItem>
          <SelectItem value="enhancement">Enhancement</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Release channel</span>
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          {releaseChannel}
        </Badge>
      </div>

      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
        <SelectTrigger className="w-32 bg-white">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="api">API</SelectItem>
          <SelectItem value="dashboard">Dashboard</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
