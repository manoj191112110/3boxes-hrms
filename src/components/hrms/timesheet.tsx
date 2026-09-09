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
import { Timer, CheckCircle2, Clock, Plus, Calendar, BarChart3, Users, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { useHRMSStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

// Interfaces
interface TimesheetEntry {
  id: string
  companyId: string
  employeeId: string
  projectId?: string | null
  taskId?: string | null
  date: string
  hours: number
  billable: boolean
  description?: string | null
  status: string
  approvedById?: string | null
  approvedDate?: string | null
  createdAt: string
  employee?: { firstName: string; lastName: string; employeeCode: string }
  project?: { name: string; code: string }
}

interface ProjectData {
  id: string
  name: string
  code: string
  tasks?: { id: string; name: string }[]
}

interface TimesheetStats {
  activeProjects: number
  totalTasks: number
  completedTasks: number
  completionRate: number
}

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatStatus = (status: string) => {
  const map: Record<string, string> = {
    'pending': 'Pending', 'approved': 'Approved', 'rejected': 'Rejected',
    'submitted': 'Submitted', 'not_submitted': 'Not Submitted',
  }
  return map[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function Timesheet() {
  const { data: session } = useSession()
  const { currentCompanyId } = useHRMSStore()
  const { toast } = useToast()
  const companyId = currentCompanyId || (session?.user as any)?.companyId
  const employeeId = (session?.user as any)?.employeeId

  const [search, setSearch] = useState('')
  const [addDialog, setAddDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Data state
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([])
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [stats, setStats] = useState<TimesheetStats | null>(null)

  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0)

  // Form state
  const [form, setForm] = useState({
    projectId: '', taskId: '', date: '', hours: '', billable: 'true', description: ''
  })

  const getWeekRange = (offset: number) => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset + offset * 7)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { monday, sunday }
  }

  const formatDateInput = (d: Date) => d.toISOString().split('T')[0]

  const fetchData = useCallback(async () => {
    if (!companyId) return
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<{ timesheets: TimesheetEntry[]; projects: ProjectData[]; stats: TimesheetStats }>(
        '/projects', { companyId, include: 'all' }
      )
      setTimesheets(data.timesheets || [])
      setProjects((data.projects || []).map((p: any) => ({
        id: p.id, name: p.name, code: p.code,
        tasks: (p.tasks || []).map((t: any) => ({ id: t.id, name: t.name }))
      })))
      setStats(data.stats || null)
    } catch (err: any) {
      setError(err.message || 'Failed to load timesheet data')
      toast({ title: 'Error', description: 'Failed to load timesheet data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [companyId, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'Approved': 'bg-emerald-600/20 text-emerald-400',
      'approved': 'bg-emerald-600/20 text-emerald-400',
      'Submitted': 'bg-green-600/20 text-green-400',
      'submitted': 'bg-green-600/20 text-green-400',
      'Pending': 'bg-amber-600/20 text-amber-400',
      'pending': 'bg-amber-600/20 text-amber-400',
      'Rejected': 'bg-red-600/20 text-red-400',
      'rejected': 'bg-red-600/20 text-red-400',
      'Not Submitted': 'bg-slate-600/20 text-slate-400',
      'not_submitted': 'bg-slate-600/20 text-slate-400',
    }
    return map[status] || 'bg-slate-600/20 text-slate-400'
  }

  // My timesheet entries (current employee)
  const myTimesheets = timesheets.filter(t => t.employeeId === employeeId)

  // Current week entries
  const { monday, sunday } = getWeekRange(weekOffset)
  const weekStart = formatDateInput(monday)
  const weekEnd = formatDateInput(sunday)
  const weekLabel = `${monday.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const weekEntries = myTimesheets.filter(t => {
    const d = t.date.split('T')[0]
    return d >= weekStart && d <= weekEnd
  })

  // Build weekly grid (project rows x day columns)
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  // Group by project
  const projectGroups: Record<string, { project: string; billable: boolean; days: number[]; total: number; task: string }> = {}
  weekEntries.forEach(e => {
    const key = `${e.projectId || 'internal'}_${e.billable}`
    if (!projectGroups[key]) {
      projectGroups[key] = {
        project: e.project?.name || 'Internal',
        billable: e.billable,
        days: [0, 0, 0, 0, 0, 0, 0],
        total: 0,
        task: e.description || ''
      }
    }
    const dayIdx = weekDays.findIndex(d => formatDateInput(d) === e.date.split('T')[0])
    if (dayIdx >= 0) {
      projectGroups[key].days[dayIdx] += e.hours
      projectGroups[key].total += e.hours
    }
  })
  const myWeeklyRows = Object.values(projectGroups)

  // Daily totals
  const dailyTotals = [0, 0, 0, 0, 0, 0, 0]
  myWeeklyRows.forEach(r => r.days.forEach((h, i) => dailyTotals[i] += h))
  const totalWeeklyHours = myWeeklyRows.reduce((s, r) => s + r.total, 0)
  const billableHours = myWeeklyRows.filter(r => r.billable).reduce((s, r) => s + r.total, 0)

  // Team timesheets (non-self)
  const teamTimesheets = timesheets.filter(t => t.employeeId !== employeeId)

  // Group team entries by employee for team view
  const teamGrouped: Record<string, { name: string; code: string; project: string; weekHours: number; billableHours: number; status: string; submitted: string }> = {}
  teamTimesheets.forEach(t => {
    const empKey = t.employeeId
    if (!teamGrouped[empKey]) {
      teamGrouped[empKey] = {
        name: t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : '—',
        code: t.employee?.employeeCode || '—',
        project: t.project?.name || '—',
        weekHours: 0,
        billableHours: 0,
        status: t.status,
        submitted: formatDate(t.createdAt)
      }
    }
    const d = t.date.split('T')[0]
    if (d >= weekStart && d <= weekEnd) {
      teamGrouped[empKey].weekHours += t.hours
      if (t.billable) teamGrouped[empKey].billableHours += t.hours
      if (t.status === 'approved') teamGrouped[empKey].status = 'approved'
      else if (t.status === 'rejected') teamGrouped[empKey].status = 'rejected'
      else if (t.status === 'pending' && teamGrouped[empKey].status !== 'approved' && teamGrouped[empKey].status !== 'rejected') {
        teamGrouped[empKey].status = 'pending'
      }
    }
  })
  const teamRows = Object.entries(teamGrouped).map(([id, data]) => ({ id, ...data }))
  const filteredTeamRows = teamRows.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  // Pending approvals
  const pendingApprovals = timesheets.filter(t => t.status === 'pending')
  const pendingCount = pendingApprovals.length

  // Reports data
  const allHours = timesheets.reduce((s, t) => s + t.hours, 0)
  const allBillable = timesheets.filter(t => t.billable).reduce((s, t) => s + t.hours, 0)
  const allNonBillable = allHours - allBillable
  const overtimeHours = timesheets.filter(t => t.hours > 8).reduce((s, t) => s + (t.hours - 8), 0)
  const avgHours = timesheets.length > 0 ? Math.round(allHours / new Set(timesheets.map(t => t.employeeId)).size) : 0

  // Project utilization from timesheets
  const projectUtilization: Record<string, { name: string; billable: number; total: number }> = {}
  timesheets.forEach(t => {
    const pKey = t.projectId || 'internal'
    if (!projectUtilization[pKey]) {
      projectUtilization[pKey] = { name: t.project?.name || 'Internal', billable: 0, total: 0 }
    }
    projectUtilization[pKey].total += t.hours
    if (t.billable) projectUtilization[pKey].billable += t.hours
  })

  // Compliance metrics
  const totalEmployees = new Set(timesheets.map(t => t.employeeId)).size
  const approvedCount = timesheets.filter(t => t.status === 'approved').length
  const rejectedCount = timesheets.filter(t => t.status === 'rejected').length
  const complianceRate = timesheets.length > 0 ? Math.round((timesheets.filter(t => t.status !== 'not_submitted').length / timesheets.length) * 100) : 0
  const rejectionRate = timesheets.length > 0 ? Math.round((rejectedCount / timesheets.length) * 100) : 0

  // Top logger
  const loggerHours: Record<string, { name: string; hours: number }> = {}
  timesheets.forEach(t => {
    const eKey = t.employeeId
    if (!loggerHours[eKey]) {
      loggerHours[eKey] = { name: t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : '—', hours: 0 }
    }
    loggerHours[eKey].hours += t.hours
  })
  const topLogger = Object.values(loggerHours).sort((a, b) => b.hours - a.hours)[0]

  // Selected project tasks for form
  const selectedProject = projects.find(p => p.id === form.projectId)
  const projectTasks = selectedProject?.tasks || []

  const handleAddEntry = async () => {
    if (!form.date || !form.hours || !companyId) {
      toast({ title: 'Validation Error', description: 'Date and hours are required', variant: 'destructive' })
      return
    }
    try {
      await apiPost('/projects', {
        type: 'timesheet',
        companyId,
        employeeId,
        projectId: form.projectId || null,
        taskId: form.taskId || null,
        date: form.date,
        hours: parseFloat(form.hours),
        billable: form.billable === 'true',
        description: form.description || null,
      })
      toast({ title: 'Timesheet Logged', description: `${form.hours} hours logged successfully` })
      setAddDialog(false)
      setForm({ projectId: '', taskId: '', date: '', hours: '', billable: 'true', description: '' })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to log timesheet', variant: 'destructive' })
    }
  }

  const handleApproval = async (id: string, status: string) => {
    try {
      setActionLoading(id)
      await apiPut('/projects', {
        type: 'timesheet',
        id,
        status,
        approvedById: employeeId,
        approvedDate: new Date().toISOString(),
      })
      toast({ title: `Timesheet ${formatStatus(status)}`, description: `Entry has been ${status}` })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || `Failed to ${status} timesheet`, variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleSubmitForApproval = async () => {
    try {
      const pendingEntries = weekEntries.filter(e => e.status === 'pending')
      if (pendingEntries.length === 0) {
        toast({ title: 'No Entries', description: 'No pending entries to submit for this week', variant: 'destructive' })
        return
      }
      for (const entry of pendingEntries) {
        await apiPut('/projects', { type: 'timesheet', id: entry.id, status: 'submitted' })
      }
      toast({ title: 'Submitted', description: `${pendingEntries.length} entries submitted for approval` })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to submit', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="ml-3 text-slate-400">Loading timesheet data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-slate-400">{error}</p>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={fetchData}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Timer className="w-6 h-6 text-emerald-400" /> Timesheet Module
          </h1>
          <p className="text-slate-400 mt-1">Track daily and weekly hours, project time, and approvals</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Entry
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-600/20"><Clock className="w-5 h-5 text-emerald-400" /></div>
              <div><p className="text-sm text-slate-400">Weekly Hours</p><p className="text-2xl font-bold text-white">{totalWeeklyHours}h</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-600/20"><CheckCircle2 className="w-5 h-5 text-teal-400" /></div>
              <div><p className="text-sm text-slate-400">Billable</p><p className="text-2xl font-bold text-teal-400">{billableHours}h</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-600/20"><Timer className="w-5 h-5 text-amber-400" /></div>
              <div><p className="text-sm text-slate-400">Pending Approval</p><p className="text-2xl font-bold text-amber-400">{pendingCount}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-600/20"><BarChart3 className="w-5 h-5 text-teal-400" /></div>
              <div><p className="text-sm text-slate-400">Billable %</p><p className="text-2xl font-bold text-white">{totalWeeklyHours > 0 ? Math.round((billableHours / totalWeeklyHours) * 100) : 0}%</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="my-timesheet">
        <TabsList className="bg-slate-900 border border-slate-700 flex-wrap h-auto">
          <TabsTrigger value="my-timesheet" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">My Timesheet</TabsTrigger>
          <TabsTrigger value="team" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Team Timesheet</TabsTrigger>
          <TabsTrigger value="approval" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Approval</TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Reports</TabsTrigger>
        </TabsList>

        {/* My Timesheet */}
        <TabsContent value="my-timesheet">
          <Card className="bg-slate-900 border-slate-800 mt-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" /> Weekly Timesheet
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => setWeekOffset(w => w - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                  <span className="text-slate-300 text-sm font-medium">{weekLabel}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => setWeekOffset(w => w + 1)}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {myWeeklyRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Clock className="w-12 h-12 mb-3 opacity-50" />
                  <p>No timesheet entries for this week</p>
                  <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setAddDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Log Time
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">Project</TableHead>
                        <TableHead className="text-slate-400">Task</TableHead>
                        {dayNames.map(d => <TableHead key={d} className="text-slate-400 text-center">{d}</TableHead>)}
                        <TableHead className="text-slate-400 text-center">Total</TableHead>
                        <TableHead className="text-slate-400">Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myWeeklyRows.map((r, idx) => (
                        <TableRow key={idx} className="border-slate-800">
                          <TableCell className="text-white font-medium">{typeof r.project === 'object' && r.project ? r.project.name : (r.project || '—')}</TableCell>
                          <TableCell className="text-slate-300 text-sm">{r.task || '—'}</TableCell>
                          {r.days.map((h, di) => (
                            <TableCell key={di} className={`text-center ${h > 8 ? 'text-red-400' : di >= 5 && h > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                              {h || '-'}
                            </TableCell>
                          ))}
                          <TableCell className="text-emerald-400 font-semibold text-center">{r.total}</TableCell>
                          <TableCell><Badge className={r.billable ? 'bg-emerald-600/20 text-emerald-400' : 'bg-slate-600/20 text-slate-400'}>{r.billable ? 'Billable' : 'Non-Bill'}</Badge></TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-slate-700 bg-slate-800/30">
                        <TableCell className="text-white font-bold" colSpan={2}>Daily Total</TableCell>
                        {dailyTotals.map((h, i) => (
                          <TableCell key={i} className={`text-center font-semibold ${i >= 5 ? 'text-amber-400' : 'text-white'}`}>{h || '-'}</TableCell>
                        ))}
                        <TableCell className="text-emerald-400 text-center font-bold">{totalWeeklyHours}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="p-4 flex justify-end gap-2">
                <Button variant="outline" className="border-slate-700 text-slate-300">Save Draft</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSubmitForApproval}>Submit for Approval</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Timesheet */}
        <TabsContent value="team">
          <Card className="bg-slate-900 border-slate-800 mt-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" /> Team Timesheet Status
                </CardTitle>
                <Input placeholder="Search team..." className="max-w-xs bg-slate-800 border-slate-700 text-slate-300 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTeamRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Users className="w-12 h-12 mb-3 opacity-50" />
                  <p>No team timesheet data available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">Employee</TableHead>
                      <TableHead className="text-slate-400">Project</TableHead>
                      <TableHead className="text-slate-400 text-center">Week Hours</TableHead>
                      <TableHead className="text-slate-400 text-center">Billable %</TableHead>
                      <TableHead className="text-slate-400">Submitted</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeamRows.map((t) => {
                      const billPct = t.weekHours > 0 ? Math.round((t.billableHours / t.weekHours) * 100) : 0
                      return (
                        <TableRow key={t.id} className="border-slate-800">
                          <TableCell className="text-white font-medium">
                            <div>{t.name}</div>
                            <div className="text-xs text-slate-500">{t.code}</div>
                          </TableCell>
                          <TableCell className="text-slate-300">{typeof t.project === 'object' && t.project ? t.project.name : (t.project || '—')}</TableCell>
                          <TableCell className="text-white font-medium text-center">{t.weekHours}h</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Progress value={billPct} className="w-16 h-1.5 bg-slate-800" />
                              <span className="text-sm text-slate-300">{billPct}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-400 text-sm">{t.submitted}</TableCell>
                          <TableCell><Badge className={statusBadge(t.status)}>{formatStatus(t.status)}</Badge></TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approval */}
        <TabsContent value="approval">
          <Card className="bg-slate-900 border-slate-800 mt-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Pending Approvals
                </CardTitle>
                <Badge className="bg-amber-600/20 text-amber-400">{pendingCount} Pending</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {pendingApprovals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <CheckCircle2 className="w-12 h-12 mb-3 opacity-50" />
                  <p>No pending approvals</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">Employee</TableHead>
                      <TableHead className="text-slate-400">Project</TableHead>
                      <TableHead className="text-slate-400">Date</TableHead>
                      <TableHead className="text-slate-400 text-center">Hours</TableHead>
                      <TableHead className="text-slate-400 text-center">Billable</TableHead>
                      <TableHead className="text-slate-400">Description</TableHead>
                      <TableHead className="text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingApprovals.map((p) => {
                      const isBillable = p.billable
                      return (
                        <TableRow key={p.id} className="border-slate-800">
                          <TableCell className="text-white font-medium">
                            <div>{p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—'}</div>
                            <div className="text-xs text-slate-500">{p.employee?.employeeCode || ''}</div>
                          </TableCell>
                          <TableCell className="text-slate-300">{p.project?.name || '—'}</TableCell>
                          <TableCell className="text-slate-400 text-sm">{formatDate(p.date)}</TableCell>
                          <TableCell className="text-white font-medium text-center">{p.hours}h</TableCell>
                          <TableCell className="text-center"><Badge className={isBillable ? 'bg-emerald-600/20 text-emerald-400' : 'bg-slate-600/20 text-slate-400'}>{isBillable ? 'Yes' : 'No'}</Badge></TableCell>
                          <TableCell className="text-slate-400 text-sm max-w-32 truncate">{p.description || '—'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs" disabled={actionLoading === p.id} onClick={() => handleApproval(p.id, 'approved')}>
                                {actionLoading === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 border-red-800 text-red-400 hover:bg-red-600/20 text-xs" disabled={actionLoading === p.id} onClick={() => handleApproval(p.id, 'rejected')}>
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-emerald-600/20"><BarChart3 className="w-5 h-5 text-emerald-400" /></div>
                  <h3 className="text-white font-semibold">Hours Summary</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-slate-400 text-sm">Total Hours</span><span className="text-white font-medium">{allHours}h</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-sm">Billable</span><span className="text-emerald-400 font-medium">{allBillable}h ({allHours > 0 ? Math.round((allBillable / allHours) * 100) : 0}%)</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-sm">Non-Billable</span><span className="text-slate-300 font-medium">{allNonBillable}h ({allHours > 0 ? Math.round((allNonBillable / allHours) * 100) : 0}%)</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-sm">Overtime</span><span className="text-amber-400 font-medium">{overtimeHours}h</span></div>
                  <div className="border-t border-slate-800 pt-2 flex justify-between"><span className="text-slate-400 text-sm">Avg Hours/Person</span><span className="text-white font-medium">{avgHours}h</span></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-teal-600/20"><Timer className="w-5 h-5 text-teal-400" /></div>
                  <h3 className="text-white font-semibold">Project Utilization</h3>
                </div>
                <div className="space-y-3">
                  {Object.entries(projectUtilization).slice(0, 5).map(([key, p]) => {
                    const pct = p.total > 0 ? Math.round((p.billable / p.total) * 100) : 0
                    return (
                      <div key={key}>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400 text-sm">{p.name}</span>
                          <span className={`${pct >= 80 ? 'text-teal-400' : 'text-amber-400'} text-sm`}>{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-1.5 bg-slate-800" />
                      </div>
                    )
                  })}
                  {Object.keys(projectUtilization).length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-4">No project data</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-teal-600/20"><Users className="w-5 h-5 text-teal-400" /></div>
                  <h3 className="text-white font-semibold">Team Performance</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-slate-400 text-sm">Timesheet Compliance</span><span className="text-emerald-400 font-medium">{complianceRate}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-sm">Approval Rate</span><span className="text-emerald-400 font-medium">{timesheets.length > 0 ? Math.round((approvedCount / timesheets.length) * 100) : 0}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-sm">Rejection Rate</span><span className="text-amber-400 font-medium">{rejectionRate}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-sm">Total Entries</span><span className="text-white font-medium">{timesheets.length}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 text-sm">Top Logger</span><span className="text-white font-medium text-sm">{topLogger?.name || '—'}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Entry Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Add Timesheet Entry</DialogTitle>
            <DialogDescription className="text-slate-400">Log hours for a project task</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400 text-sm">Project</Label>
                <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v, taskId: '' }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400 text-sm">Task</Label>
                <Select value={form.taskId} onValueChange={v => setForm(f => ({ ...f, taskId: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue placeholder="Select task" /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {projectTasks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-slate-400 text-sm">Date</Label><Input type="date" className="bg-slate-800 border-slate-700 text-white mt-1" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-slate-400 text-sm">Hours</Label><Input type="number" className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="8" min="0" max="24" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} /></div>
              <div>
                <Label className="text-slate-400 text-sm">Type</Label>
                <Select value={form.billable} onValueChange={v => setForm(f => ({ ...f, billable: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="true">Billable</SelectItem>
                    <SelectItem value="false">Non-Billable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-slate-400 text-sm">Notes</Label><Textarea className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Optional notes..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddEntry}>Add Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
