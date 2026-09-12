'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { GraduationCap, BookOpen, Award, Calendar, Clock, CheckCircle2, Play, Star, Users, Download, ExternalLink, Plus, Loader2 } from 'lucide-react'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { useHRMSStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

interface CourseData {
  id: string
  companyId: string
  title: string
  description: string | null
  type: string
  category: string | null
  duration: number
  trainer: string | null
  status: string
  createdAt: string
  enrollments: EnrollmentData[]
}

interface EnrollmentData {
  id: string
  courseId: string
  employeeId: string
  enrolledDate: string
  completedDate: string | null
  score: number | null
  status: string
  course?: CourseData
  employee?: {
    firstName: string
    lastName: string
    employeeCode: string
    department?: { name: string }
  }
}

interface TrainingStats {
  totalCourses: number
  activeEnrollments: number
  completedEnrollments: number
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TrainingModule() {
  const { data: session } = useSession()
  const { currentCompanyId } = useHRMSStore()
  const { toast } = useToast()

  const companyId = currentCompanyId || (session?.user as any)?.companyId || ''

  const [search, setSearch] = useState('')
  const [enrollDialog, setEnrollDialog] = useState(false)
  const [courseDialog, setCourseDialog] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [selectedCourseTitle, setSelectedCourseTitle] = useState<string>('')

  // Data state
  const [courses, setCourses] = useState<CourseData[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentData[]>([])
  const [trainingStats, setTrainingStats] = useState<TrainingStats>({ totalCourses: 0, activeEnrollments: 0, completedEnrollments: 0 })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [completingId, setCompletingId] = useState<string | null>(null)

  // Enroll form state
  const [enrollEmployeeId, setEnrollEmployeeId] = useState('')

  // Course form state
  const [courseTitle, setCourseTitle] = useState('')
  const [courseDescription, setCourseDescription] = useState('')
  const [courseType, setCourseType] = useState('online')
  const [courseCategory, setCourseCategory] = useState('')
  const [courseDuration, setCourseDuration] = useState('')
  const [courseTrainer, setCourseTrainer] = useState('')

  const fetchData = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const data = await apiGet<{
        courses: CourseData[]
        enrollments: EnrollmentData[]
        stats: TrainingStats
      }>('/training', { companyId, include: 'all' })
      setCourses(data.courses || [])
      setEnrollments(data.enrollments || [])
      setTrainingStats(data.stats || { totalCourses: 0, activeEnrollments: 0, completedEnrollments: 0 })
    } catch (err: any) {
      console.error('Failed to fetch training data:', err)
      toast({ title: 'Error', description: 'Failed to load training data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [companyId, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const levelBadge = (category: string | null) => {
    if (!category) return 'bg-slate-600/20 text-slate-400'
    const map: Record<string, string> = {
      'Compliance': 'bg-emerald-600/20 text-emerald-400',
      'Technical': 'bg-red-600/20 text-red-400',
      'Soft Skills': 'bg-amber-600/20 text-amber-400',
      'Management': 'bg-teal-600/20 text-teal-400',
    }
    return map[category] || 'bg-slate-600/20 text-slate-400'
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'active': 'bg-emerald-600/20 text-emerald-400',
      'Active': 'bg-emerald-600/20 text-emerald-400',
      'upcoming': 'bg-green-600/20 text-green-400',
      'Upcoming': 'bg-green-600/20 text-green-400',
      'enrolled': 'bg-green-600/20 text-green-400',
      'in_progress': 'bg-green-600/20 text-green-400',
      'In Progress': 'bg-green-600/20 text-green-400',
      'completed': 'bg-emerald-600/20 text-emerald-400',
      'Completed': 'bg-emerald-600/20 text-emerald-400',
      'dropped': 'bg-red-600/20 text-red-400',
    }
    return map[status] || 'bg-slate-600/20 text-slate-400'
  }

  const formatStatus = (status: string) => {
    if (status === 'in_progress') return 'In Progress'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const handleEnrollClick = (courseId: string, courseTitle: string) => {
    setSelectedCourseId(courseId)
    setSelectedCourseTitle(courseTitle)
    setEnrollDialog(true)
  }

  // Handle create course
  const handleCreateCourse = async () => {
    if (!companyId || !courseTitle) {
      toast({ title: 'Validation Error', description: 'Please fill in the course title', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      await apiPost('/training', {
        type: 'course',
        companyId,
        title: courseTitle,
        description: courseDescription,
        courseType,
        category: courseCategory,
        duration: courseDuration ? parseInt(courseDuration) : 60,
        trainer: courseTrainer,
      })
      toast({ title: 'Success', description: 'Course created successfully' })
      setCourseDialog(false)
      setCourseTitle('')
      setCourseDescription('')
      setCourseType('online')
      setCourseCategory('')
      setCourseDuration('')
      setCourseTrainer('')
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create course', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // Handle enroll employee
  const handleEnroll = async () => {
    if (!companyId || !selectedCourseId || !enrollEmployeeId) {
      toast({ title: 'Validation Error', description: 'Please enter an employee ID', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      await apiPost('/training', {
        type: 'enrollment',
        companyId,
        courseId: selectedCourseId,
        employeeId: enrollEmployeeId,
      })
      toast({ title: 'Success', description: 'Employee enrolled successfully' })
      setEnrollDialog(false)
      setEnrollEmployeeId('')
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to enroll employee', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // Handle complete enrollment
  const handleCompleteEnrollment = async (enrollmentId: string) => {
    setCompletingId(enrollmentId)
    try {
      await apiPut('/training', {
        type: 'enrollment',
        id: enrollmentId,
        status: 'completed',
        completedDate: new Date().toISOString(),
      })
      toast({ title: 'Success', description: 'Training marked as completed' })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to complete training', variant: 'destructive' })
    } finally {
      setCompletingId(null)
    }
  }

  // My learning - active enrollments
  const myLearning = enrollments.filter(e => e.status === 'enrolled' || e.status === 'in_progress')

  // Completed enrollments for certification view
  const completedEnrollments = enrollments.filter(e => e.status === 'completed')

  // Computed stats
  const totalCourses = courses.length
  const activeEnrollments = enrollments.filter(e => e.status === 'enrolled' || e.status === 'in_progress').length
  const completedCerts = completedEnrollments.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="ml-3 text-slate-400 text-lg">Loading training data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-emerald-400" /> Training / LMS
          </h1>
          <p className="text-slate-400 mt-1">Manage courses, learning paths, and certifications</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCourseDialog(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Course
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-600/20"><BookOpen className="w-5 h-5 text-emerald-400" /></div>
              <div><p className="text-sm text-slate-400">Available Courses</p><p className="text-2xl font-bold text-white">{totalCourses}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-600/20"><Play className="w-5 h-5 text-teal-400" /></div>
              <div><p className="text-sm text-slate-400">Active Enrollments</p><p className="text-2xl font-bold text-teal-400">{activeEnrollments}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-600/20"><Award className="w-5 h-5 text-teal-400" /></div>
              <div><p className="text-sm text-slate-400">Completed</p><p className="text-2xl font-bold text-teal-400">{completedCerts}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-600/20"><Clock className="w-5 h-5 text-amber-400" /></div>
              <div><p className="text-sm text-slate-400">Completion Rate</p><p className="text-2xl font-bold text-amber-400">{enrollments.length > 0 ? Math.round((completedCerts / enrollments.length) * 100) : 0}%</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="catalog">
        <TabsList className="bg-slate-900 border border-slate-700 flex-wrap h-auto">
          <TabsTrigger value="catalog" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Course Catalog</TabsTrigger>
          <TabsTrigger value="learning" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Enrollments</TabsTrigger>
          <TabsTrigger value="certifications" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Completed</TabsTrigger>
          <TabsTrigger value="manage" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Manage Courses</TabsTrigger>
        </TabsList>

        {/* Course Catalog */}
        <TabsContent value="catalog">
          <div className="mb-4">
            <Input placeholder="Search courses..." className="max-w-xs bg-slate-800 border-slate-700 text-slate-300" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {courses.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No courses available. Create one to get started.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {courses.filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || (c.category || '').toLowerCase().includes(search.toLowerCase())).map((c) => {
                const enrolled = c.enrollments?.length || 0
                const maxSeats = 20
                return (
                  <Card key={c.id} className="bg-slate-900 border-slate-800 hover:border-emerald-800/50 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <Badge className={levelBadge(c.category)}>{c.category || 'General'}</Badge>
                        <Badge className={c.status === 'active' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-green-600/20 text-green-400'}>{formatStatus(c.status)}</Badge>
                      </div>
                      <h3 className="text-white font-semibold text-lg mb-1">{c.title}</h3>
                      <p className="text-slate-400 text-sm mb-3">{c.type === 'online' ? 'Online' : 'Classroom'}</p>
                      <div className="space-y-2 mb-4">
                        {c.trainer && (
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Users className="w-3.5 h-3.5" /> {c.trainer}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Clock className="w-3.5 h-3.5" /> {c.duration} min
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> {enrolled} enrolled
                        </div>
                      </div>
                      <div className="mb-4">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-slate-500">Seats</span>
                          <span className="text-xs text-slate-400">{enrolled}/{maxSeats}</span>
                        </div>
                        <Progress value={(enrolled / maxSeats) * 100} className="h-1.5 bg-slate-800" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-semibold text-sm">Free</span>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8" onClick={() => handleEnrollClick(c.id, c.title)}>
                          Enroll Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Enrollments (My Learning) */}
        <TabsContent value="learning">
          {myLearning.length === 0 ? (
            <div className="text-center py-12 text-slate-500 mt-4">No active enrollments found</div>
          ) : (
            <div className="space-y-4 mt-4">
              {myLearning.map((e) => {
                const courseTitle = e.course?.title || 'Unknown Course'
                return (
                  <Card key={e.id} className="bg-slate-900 border-slate-800">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-white font-semibold text-lg">{courseTitle}</h3>
                            <Badge className={statusBadge(e.status)}>{formatStatus(e.status)}</Badge>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                            <div><p className="text-xs text-slate-500">Employee</p><p className="text-slate-300 text-sm">{e.employee ? `${e.employee.firstName} ${e.employee.lastName}` : '-'}</p></div>
                            <div><p className="text-xs text-slate-500">Enrolled Date</p><p className="text-slate-300 text-sm">{formatDate(e.enrolledDate)}</p></div>
                            <div><p className="text-xs text-slate-500">Course Type</p><p className="text-slate-300 text-sm">{e.course?.type === 'online' ? 'Online' : 'Classroom'}</p></div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={e.status === 'in_progress' ? 50 : 10} className="flex-1 h-2.5 bg-slate-800" />
                            <span className="text-emerald-400 font-semibold text-sm">{e.status === 'in_progress' ? '50%' : '10%'}</span>
                          </div>
                        </div>
                        <Button
                          className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                          disabled={completingId === e.id}
                          onClick={() => handleCompleteEnrollment(e.id)}
                        >
                          {completingId === e.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                          Complete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Completed / Certifications */}
        <TabsContent value="certifications">
          {completedEnrollments.length === 0 ? (
            <div className="text-center py-12 text-slate-500 mt-4">No completed courses yet</div>
          ) : (
            <div className="space-y-4 mt-4">
              {completedEnrollments.map((e) => {
                const courseTitle = e.course?.title || 'Unknown Course'
                return (
                  <Card key={e.id} className="bg-slate-900 border-slate-800">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-emerald-600/20 shrink-0">
                            <Award className="w-8 h-8 text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="text-white font-semibold text-lg">{courseTitle}</h3>
                            <p className="text-slate-400 text-sm">Employee: {e.employee ? `${e.employee.firstName} ${e.employee.lastName}` : '-'}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3">
                              <div><p className="text-xs text-slate-500">Enrolled</p><p className="text-slate-300 text-sm">{formatDate(e.enrolledDate)}</p></div>
                              <div><p className="text-xs text-slate-500">Completed</p><p className="text-slate-300 text-sm">{formatDate(e.completedDate)}</p></div>
                              <div><p className="text-xs text-slate-500">Score</p><p className="text-emerald-400 text-sm font-semibold">{e.score !== null ? `${e.score}%` : 'N/A'}</p></div>
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-emerald-600/20 text-emerald-400">Completed</Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Manage Courses */}
        <TabsContent value="manage">
          {courses.length === 0 ? (
            <div className="text-center py-12 text-slate-500 mt-4">No courses found</div>
          ) : (
            <Card className="bg-slate-900 border-slate-800 mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-400" /> All Courses & Enrollments
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">Course</TableHead>
                      <TableHead className="text-slate-400">Type</TableHead>
                      <TableHead className="text-slate-400">Category</TableHead>
                      <TableHead className="text-slate-400">Duration</TableHead>
                      <TableHead className="text-slate-400">Trainer</TableHead>
                      <TableHead className="text-slate-400 text-center">Enrolled</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map((c) => (
                      <TableRow key={c.id} className="border-slate-800">
                        <TableCell className="text-white font-medium">{c.title}</TableCell>
                        <TableCell><Badge className={c.type === 'online' ? 'bg-green-600/20 text-green-400' : 'bg-teal-600/20 text-teal-400'}>{c.type === 'online' ? 'Online' : 'Classroom'}</Badge></TableCell>
                        <TableCell><Badge className="bg-slate-700 text-slate-300">{c.category || 'General'}</Badge></TableCell>
                        <TableCell className="text-slate-300 text-sm">{c.duration} min</TableCell>
                        <TableCell className="text-slate-300 text-sm">{c.trainer || '-'}</TableCell>
                        <TableCell className="text-slate-300 text-center">{c.enrollments?.length || 0}</TableCell>
                        <TableCell><Badge className={statusBadge(c.status)}>{formatStatus(c.status)}</Badge></TableCell>
                        <TableCell>
                          <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={() => handleEnrollClick(c.id, c.title)}>
                            <Plus className="w-3 h-3 mr-1" /> Enroll
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Enroll Dialog */}
      <Dialog open={enrollDialog} onOpenChange={setEnrollDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Enroll Employee</DialogTitle>
            <DialogDescription className="text-slate-400">Enroll an employee in {selectedCourseTitle}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <h4 className="text-white font-medium mb-2">{selectedCourseTitle}</h4>
                <div className="space-y-1 text-sm text-slate-400">
                  <p>✓ Full access to all course modules</p>
                  <p>✓ Assessment and certification included</p>
                  <p>✓ Lifetime access to course materials</p>
                  <p>✓ Certificate upon completion</p>
                </div>
              </CardContent>
            </Card>
            <div>
              <Label className="text-slate-400 text-sm">Employee ID *</Label>
              <Input
                className="bg-slate-800 border-slate-700 text-white mt-1"
                placeholder="Enter employee ID to enroll"
                value={enrollEmployeeId}
                onChange={e => setEnrollEmployeeId(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">By enrolling, the employee agrees to complete the course within the deadline.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setEnrollDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleEnroll} disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enrolling...</> : 'Confirm Enrollment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Course Dialog */}
      <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Create Course</DialogTitle>
            <DialogDescription className="text-slate-400">Add a new training course</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-slate-400 text-sm">Course Title *</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Enter course title" value={courseTitle} onChange={e => setCourseTitle(e.target.value)} /></div>
            <div><Label className="text-slate-400 text-sm">Description</Label><Textarea className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Course description..." value={courseDescription} onChange={e => setCourseDescription(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400 text-sm">Type</Label>
                <Select value={courseType} onValueChange={setCourseType}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="classroom">Classroom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400 text-sm">Category</Label>
                <Select value={courseCategory} onValueChange={setCourseCategory}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="Technical">Technical</SelectItem>
                    <SelectItem value="Soft Skills">Soft Skills</SelectItem>
                    <SelectItem value="Management">Management</SelectItem>
                    <SelectItem value="Compliance">Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-slate-400 text-sm">Duration (minutes)</Label><Input type="number" className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="60" value={courseDuration} onChange={e => setCourseDuration(e.target.value)} /></div>
              <div><Label className="text-slate-400 text-sm">Trainer</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Trainer name" value={courseTrainer} onChange={e => setCourseTrainer(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setCourseDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreateCourse} disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : 'Create Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
