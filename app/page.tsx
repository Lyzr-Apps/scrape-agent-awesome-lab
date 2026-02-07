'use client'

import { useState, useEffect, useMemo } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, RefreshCw, Star, ExternalLink, Search, MapPin, Calendar, DollarSign } from 'lucide-react'

// TypeScript interfaces from actual test response
interface Job {
  title: string
  company: string
  location: string
  postedDate: string
  salaryRange: string
  link: string
  description: string
}

interface JobResponse {
  status: 'success' | 'error'
  result: {
    jobs: Job[]
  }
  metadata?: {
    agent_name?: string
    timestamp?: string
    total_jobs_found?: number
  }
}

type DateFilter = 'all' | 'today' | 'week'

// Job Card Component
function JobCard({
  job,
  isFavorite,
  onToggleFavorite,
  isNew
}: {
  job: Job
  isFavorite: boolean
  onToggleFavorite: () => void
  isNew: boolean
}) {
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-transparent hover:border-l-blue-500">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Title and Link */}
            <div className="flex items-start gap-3 mb-2">
              <a
                href={job.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors flex-1 group"
              >
                {job.title}
                <ExternalLink className="inline-block ml-2 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              {isNew && (
                <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full whitespace-nowrap">
                  New
                </span>
              )}
            </div>

            {/* Company */}
            <div className="text-lg text-gray-700 font-medium mb-3">
              {job.company}
            </div>

            {/* Metadata Row */}
            <div className="flex flex-wrap gap-4 mb-3 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{formatRelativeDate(job.postedDate)}</span>
              </div>
              {job.salaryRange && job.salaryRange !== 'Not specified' && (
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-medium text-green-700">{job.salaryRange}</span>
                </div>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-600 text-sm line-clamp-2">
              {job.description}
            </p>
          </div>

          {/* Favorite Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFavorite}
            className="flex-shrink-0"
          >
            <Star
              className={`w-5 h-5 transition-colors ${
                isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
              }`}
            />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Skeleton Loading Card
function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
          <div className="h-5 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="flex gap-4 mb-3">
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-200 rounded w-28"></div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </CardContent>
    </Card>
  )
}

// Utility: Format relative date
function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  } catch {
    return dateStr
  }
}

// Utility: Check if job is new (posted today)
function isJobNew(dateStr: string): boolean {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    return diffHours < 24
  } catch {
    return false
  }
}

// Main Component
export default function Home() {
  const AGENT_ID = '6986ecdab4092699af3c635c'

  // State
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  // Filter state
  const [searchKeyword, setSearchKeyword] = useState('')
  const [locationFilter, setLocationFilter] = useState<string[]>([])
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('job-favorites')
    if (saved) {
      try {
        setFavorites(new Set(JSON.parse(saved)))
      } catch {
        setFavorites(new Set())
      }
    }
  }, [])

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('job-favorites', JSON.stringify(Array.from(favorites)))
  }, [favorites])

  // Fetch jobs from agent
  const fetchJobs = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await callAIAgent(
        'Find current backend developer job openings in the United States. Include job title, company name, location, salary range if available, and application links.',
        AGENT_ID
      )

      if (result.success && result.response.status === 'success') {
        const jobResponse = result.response as JobResponse
        setJobs(jobResponse.result.jobs || [])
        setLastUpdated(new Date().toISOString())
      } else {
        setError(result.error || result.response.message || 'Failed to fetch jobs')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchJobs()
  }, [])

  // Toggle favorite
  const toggleFavorite = (jobLink: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(jobLink)) {
        newFavorites.delete(jobLink)
      } else {
        newFavorites.add(jobLink)
      }
      return newFavorites
    })
  }

  // Extract unique locations
  const availableLocations = useMemo(() => {
    const locations = new Set<string>()
    jobs.forEach(job => {
      if (job.location) locations.add(job.location)
    })
    return Array.from(locations).sort()
  }, [jobs])

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Keyword filter
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase()
        const matchesKeyword =
          job.title.toLowerCase().includes(keyword) ||
          job.company.toLowerCase().includes(keyword) ||
          job.description.toLowerCase().includes(keyword) ||
          job.location.toLowerCase().includes(keyword)
        if (!matchesKeyword) return false
      }

      // Location filter
      if (locationFilter.length > 0) {
        if (!locationFilter.includes(job.location)) return false
      }

      // Date filter
      if (dateFilter === 'today') {
        if (!isJobNew(job.postedDate)) return false
      } else if (dateFilter === 'week') {
        try {
          const date = new Date(job.postedDate)
          const now = new Date()
          const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
          if (diffDays > 7) return false
        } catch {
          return false
        }
      }

      return true
    })
  }, [jobs, searchKeyword, locationFilter, dateFilter])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Backend Dev Job Scout</h1>
              {lastUpdated && (
                <p className="text-sm text-gray-500 mt-1">
                  Last updated: {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
            <Button
              onClick={fetchJobs}
              disabled={loading}
              size="lg"
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Refresh Jobs
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Bar */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Filter by keyword..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Location Filter */}
              <div>
                <select
                  multiple
                  value={locationFilter}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value)
                    setLocationFilter(selected)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
                >
                  <option value="" disabled>Select locations (Ctrl+Click for multiple)</option>
                  {availableLocations.map(location => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex gap-2">
                <Button
                  variant={dateFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('all')}
                  className="flex-1"
                >
                  All Time
                </Button>
                <Button
                  variant={dateFilter === 'week' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('week')}
                  className="flex-1"
                >
                  This Week
                </Button>
                <Button
                  variant={dateFilter === 'today' ? 'default' : 'outline'}
                  onClick={() => setDateFilter('today')}
                  className="flex-1"
                >
                  Today
                </Button>
              </div>
            </div>

            {/* Active Filters Summary */}
            {(searchKeyword || locationFilter.length > 0 || dateFilter !== 'all') && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {filteredJobs.length} of {jobs.length} jobs
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchKeyword('')
                      setLocationFilter([])
                      setDateFilter('all')
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-800">Error: {error}</p>
            </CardContent>
          </Card>
        )}

        {/* Job List */}
        <div className="space-y-4">
          {loading ? (
            // Loading Skeletons
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filteredJobs.length === 0 ? (
            // Empty State
            <Card>
              <CardContent className="p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <Search className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No Jobs Found
                </h3>
                <p className="text-gray-500">
                  {jobs.length === 0
                    ? 'Click "Refresh Jobs" to load job listings'
                    : 'Try adjusting your filters to see more results'}
                </p>
              </CardContent>
            </Card>
          ) : (
            // Job Cards
            filteredJobs.map((job, index) => (
              <JobCard
                key={`${job.link}-${index}`}
                job={job}
                isFavorite={favorites.has(job.link)}
                onToggleFavorite={() => toggleFavorite(job.link)}
                isNew={isJobNew(job.postedDate)}
              />
            ))
          )}
        </div>

        {/* Summary Footer */}
        {!loading && jobs.length > 0 && (
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} displayed
              {favorites.size > 0 && ` • ${favorites.size} favorite${favorites.size !== 1 ? 's' : ''} saved`}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
