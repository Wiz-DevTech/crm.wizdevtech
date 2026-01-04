'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  FileText, 
  Users, 
  TrendingUp, 
  Settings, 
  Plus, 
  Search,
  Filter,
  Edit,
  Eye,
  Trash2,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Target,
  Globe,
  Image,
  Layers,
  Zap,
  Archive
} from 'lucide-react'

export default function CMSDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [pages, setPages] = useState([
    {
      id: '1',
      title: 'Homepage',
      slug: '/',
      status: 'PUBLISHED',
      type: 'HOMEPAGE',
      author: 'Admin',
      lastModified: '2024-01-15',
      seoScore: 92,
      wordCount: 2500
    },
    {
      id: '2',
      title: 'Project Rescue Services',
      slug: '/services/project-rescue',
      status: 'DRAFT',
      type: 'SERVICE',
      author: 'John Doe',
      lastModified: '2024-01-14',
      seoScore: 78,
      wordCount: 2100
    },
    {
      id: '3',
      title: 'Why Projects Fail: 7 Common Reasons',
      slug: '/blog/why-projects-fail',
      status: 'PUBLISHED',
      type: 'BLOG',
      author: 'Jane Smith',
      lastModified: '2024-01-13',
      seoScore: 88,
      wordCount: 1900
    }
  ])

  const stats = {
    totalPages: 8,
    publishedPages: pages.filter(p => p.status === 'PUBLISHED').length,
    draftPages: pages.filter(p => p.status === 'DRAFT').length,
    scheduledPages: pages.filter(p => p.status === 'SCHEDULED').length,
    totalWords: pages.reduce((acc, page) => acc + (page.wordCount || 0), 0),
    avgSeoScore: pages.length > 0 ? Math.round(pages.reduce((acc, page) => acc + (page.seoScore || 0), 0) / pages.length) : 0,
    totalKeywords: 24,
    imagesUploaded: 6
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: React.ReactNode }> = {
      published: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
      draft: { color: 'bg-yellow-100 text-yellow-800', icon: <Edit className="w-3 h-3" /> },
      scheduled: { color: 'bg-blue-100 text-blue-800', icon: <Calendar className="w-3 h-3" /> },
      archived: { color: 'bg-gray-100 text-gray-800', icon: <Archive className="w-3 h-3" /> }
    }
    
    const variant = variants[status] || variants.draft
    return (
      <Badge className={variant.color}>
        <span className="flex items-center gap-1">
          {variant.icon}
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </Badge>
    )
  }

  const getTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      homepage: 'bg-purple-100 text-purple-800',
      service: 'bg-blue-100 text-blue-800',
      blog: 'bg-green-100 text-green-800',
      page: 'bg-gray-100 text-gray-800',
      landing: 'bg-orange-100 text-orange-800'
    }
    
    return (
      <Badge className={variants[type] || 'bg-gray-100 text-gray-800'}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    )
  }

  const getSeoScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Layers className="w-8 h-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">WizDevTech CMS</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Page
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Pages</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalPages}</div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <span className="text-green-600">{stats.publishedPages} published</span>
                    <span>•</span>
                    <span className="text-yellow-600">{stats.draftPages} drafts</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Words</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalWords.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    ~19,000 words target content
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg SEO Score</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getSeoScoreColor(stats.avgSeoScore)}`}>
                    {stats.avgSeoScore}
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <Progress value={stats.avgSeoScore} className="flex-1" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Keywords</CardTitle>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalKeywords}</div>
                  <p className="text-xs text-muted-foreground">
                    20+ keywords across all pages
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Pages</CardTitle>
                  <CardDescription>Latest content updates</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pages.slice(0, 3).map((page) => (
                    <div key={page.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        <div>
                          <p className="font-medium">{page.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {page.author} • {page.lastModified}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(page.status)}
                        {getTypeBadge(page.type)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>SEO Performance</CardTitle>
                  <CardDescription>Search optimization metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Technical SEO</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={92} className="w-20" />
                      <span className="text-sm font-medium">92%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Content Optimization</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={78} className="w-20" />
                      <span className="text-sm font-medium">78%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Meta Tags</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={85} className="w-20" />
                      <span className="text-sm font-medium">85%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Schema Markup</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={70} className="w-20" />
                      <span className="text-sm font-medium">70%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pages Tab */}
          <TabsContent value="pages" className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search pages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Page
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-medium">Page</th>
                        <th className="text-left p-4 font-medium">Type</th>
                        <th className="text-left p-4 font-medium">Status</th>
                        <th className="text-left p-4 font-medium">Author</th>
                        <th className="text-left p-4 font-medium">SEO Score</th>
                        <th className="text-left p-4 font-medium">Words</th>
                        <th className="text-left p-4 font-medium">Modified</th>
                        <th className="text-left p-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pages.map((page) => (
                        <tr key={page.id} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{page.title}</p>
                              <p className="text-sm text-muted-foreground">{page.slug}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            {getTypeBadge(page.type)}
                          </td>
                          <td className="p-4">
                            {getStatusBadge(page.status)}
                          </td>
                          <td className="p-4 text-sm">{page.author}</td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <span className={`font-medium ${getSeoScoreColor(page.seoScore)}`}>
                                {page.seoScore}
                              </span>
                              <Progress value={page.seoScore} className="w-12" />
                            </div>
                          </td>
                          <td className="p-4 text-sm">{page.wordCount.toLocaleString()}</td>
                          <td className="p-4 text-sm">{page.lastModified}</td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>SEO Overview</CardTitle>
                  <CardDescription>Search optimization status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium">Technical SEO</span>
                    </div>
                    <span className="text-green-600 font-bold">92/100</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                      <span className="font-medium">Content Optimization</span>
                    </div>
                    <span className="text-yellow-600 font-bold">78/100</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                      <span className="font-medium">Meta Tags</span>
                    </div>
                    <span className="text-yellow-600 font-bold">85/100</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="font-medium">Schema Markup</span>
                    </div>
                    <span className="text-red-600 font-bold">70/100</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Keyword Tracking</CardTitle>
                  <CardDescription>Monitor keyword performance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">project rescue services</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-green-600">↑ 3</span>
                        <span className="text-sm text-muted-foreground">#12</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">failing projects</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-green-600">↑ 5</span>
                        <span className="text-sm text-muted-foreground">#8</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">technical audit</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-red-600">↓ 2</span>
                        <span className="text-sm text-muted-foreground">#15</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">embedded execution team</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">-</span>
                        <span className="text-sm text-muted-foreground">#22</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value="media" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Media Library</h2>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Upload Media
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="aspect-video bg-gray-100 flex items-center justify-center">
                    <Image className="w-8 h-8 text-gray-400" />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium truncate">image-{i}.jpg</h3>
                    <p className="text-sm text-muted-foreground">1.2 MB • 1920x1080</p>
                    <p className="text-xs text-muted-foreground mt-1">Uploaded 2 days ago</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Page Performance</CardTitle>
                  <CardDescription>Traffic and engagement metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Page Views</span>
                    <span className="text-sm font-medium">2,847</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Unique Visitors</span>
                    <span className="text-sm font-medium">1,234</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg. Time on Page</span>
                    <span className="text-sm font-medium">3m 24s</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Bounce Rate</span>
                    <span className="text-sm font-medium">42%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Conversions</span>
                    <span className="text-sm font-medium">28</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Conversion Events</CardTitle>
                  <CardDescription>GA4 event tracking</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Contact Form Submissions</span>
                    <span className="text-sm font-medium">12</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Service Page Views</span>
                    <span className="text-sm font-medium">456</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Blog Post Reads</span>
                    <span className="text-sm font-medium">789</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">CTA Button Clicks</span>
                    <span className="text-sm font-medium">67</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Newsletter Signups</span>
                    <span className="text-sm font-medium">23</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">User Management</h2>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-medium">User</th>
                        <th className="text-left p-4 font-medium">Role</th>
                        <th className="text-left p-4 font-medium">Email</th>
                        <th className="text-left p-4 font-medium">Pages</th>
                        <th className="text-left p-4 font-medium">Last Active</th>
                        <th className="text-left p-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-gray-50">
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                            <span className="font-medium">Admin User</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className="bg-purple-100 text-purple-800">Admin</Badge>
                        </td>
                        <td className="p-4 text-sm">admin@wizdevtech.com</td>
                        <td className="p-4 text-sm">3</td>
                        <td className="p-4 text-sm">2 hours ago</td>
                        <td className="p-4">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                      <tr className="border-b hover:bg-gray-50">
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                            <span className="font-medium">John Doe</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className="bg-blue-100 text-blue-800">Author</Badge>
                        </td>
                        <td className="p-4 text-sm">john@wizdevtech.com</td>
                        <td className="p-4 text-sm">2</td>
                        <td className="p-4 text-sm">1 day ago</td>
                        <td className="p-4">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}