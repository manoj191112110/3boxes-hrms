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
import { FolderKanban, Plus, Users, Target, Calendar, DollarSign, GripVertical, ArrowUpRight, Briefcase, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { useHRMSStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

// Interfaces
interface Project {
  id: string
  companyId: string
  clientId?: string | null
  name: string
  code: string
  projectManagerId?: string | null
  startDate?: string | null
  endDate?: string | null
  billingType: string
  currency: string
  budget: number
  estimatedHours: number
  status: string
  description?: string | null
  createdAt: string
  client?: { name: string } | null
  allocations?: Allocation[]
  tasks?: Task[]
  milestones?: Milestone[]
}

interface Task {
  id: string
  projectId: string
  milestoneId?: string | null
  name: string
  category?: string | null
  assignedEmployeeId?: string | null
  plannedStartDate?: string | null
  plannedEndDate?: string | null
  estimatedHours: number
  priority: string
  status: string
  billable: boolean
  description?: string | null
  project?: { name: string; code: string }
  employee?: { firstName: string; lastName: string; employeeCode: string }
}

interface Milestone {
  id: string
  projectId: string
  name: string
  plannedDate?: string | null
  actualDate?: string | null
  billingAmount: number
  completionPercentage: number
  approvalStatus: string
  invoiceStatus: string
  project?: { name: string }
}

interface Allocation {
  id: string
  projectId: string
  employeeId: string
  role?: string | null
  allocationPercentage: number
  startDate?: string | null
  endDate?: string | null
  billingRate: number
  internalCostRate: number
  status: string
  employee?: { firstName: string; lastName: string; employeeCode: string }
}

interface Timesheet {
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
  employee?: { firstName: string; lastName: string; employeeCode: string }
  project?: { name: string; code: string }
}

interface ProjectStats {
  activeProjects: number
  totalTasks: number
  completedTasks: number
  completionRate: number
}

export default function ProjectsModule() {
  const { data: session } = useSession()
  const { currentCompanyId } = useHRMSStore()
  const { toast } = useToast()

  const companyId = currentCompanyId || (session?.user as any)?.companyId

  const [search, setSearch] = useState('')
  const [addProjectDialog, setAddProjectDialog] = useState(false)
  const [addTaskDialog, setAddTaskDialog] = useState(false)
  const [logTimesheetDialog, setLogTimesheetDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Data state
  const [projects, setProjects] = useState<Project[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [timesheets, setTimesheets] = useState<Timesheet[]>([])
  const [stats, setStats] = useState<ProjectStats | null>(null)

  // Form state for Add Project
  const [projectForm, setProjectForm] = useState({
    name: '', code: '', clientId: '', priority: 'medium',
    startDate: '', endDate: '', budget: '', billingType: 't_and_m', description: ''
  })

  // Form state for Add Task
  const [taskForm, setTaskForm] = useState({
    projectId: '', name: '', priority: 'medium',
    plannedEndDate: '', estimatedHours: '', description: ''
  })

  // Form state for Log Timesheet
  const [timesheetForm, setTimesheetForm] = useState({
    projectId: '', taskId: '', date: '', hours: '', billable: true, description: ''
  })

  const fetchData = useCallback(async () => {
    if (!companyId) return
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<{ projects: Project[]; timesheets: Timesheet[]; stats: ProjectStats }>(
        '/projects', { companyId, include: 'all' }
      )
      setProjects(data.projects || [])
      setTimesheets(data.timesheets || [])
      setStats(data.stats || null)

      // Extract tasks, milestones, allocations from projects
      const tasks: Task[] = []
      const mstones: Milestone[] = []
      const allocs: Allocation[] = []
      ;(data.projects || []).forEach((p: Project) => {
        ;(p.tasks || []).forEach((t: Task) => {
          tasks.push({ ...t, project: { name: p.name, code: p.code } })
        })
        ;(p.milestones || []).forEach((m: Milestone) => {
          mstones.push({ ...m, project: { name: p.name } })
        })
        ;(p.allocations || []).forEach((a: Allocation) => {
          allocs.push(a)
        })
      })
      setAllTasks(tasks)
      setMilestones(mstones)
      setAllocations(allocs)
    } catch (err: any) {
      setError(err.message || 'Failed to load project data')
      toast({ title: 'Error', description: 'Failed to load project data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [companyId, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'active': 'bg-emerald-600/20 text-emerald-400',
      'in_progress': 'bg-emerald-600/20 text-emerald-400',
      'completed': 'bg-emerald-600/20 text-emerald-400',
      'draft': 'bg-green-600/20 text-green-400',
      'planning': 'bg-green-600/20 text-green-400',
      'on_hold': 'bg-amber-600/20 text-amber-400',
      'closed': 'bg-slate-600/20 text-slate-400',
      'todo': 'bg-slate-600/20 text-slate-400',
      'pending': 'bg-amber-600/20 text-amber-400',
      'approved': 'bg-emerald-600/20 text-emerald-400',
      'rejected': 'bg-red-600/20 text-red-400',
      'at_risk': 'bg-red-600/20 text-red-400',
    }
    return map[status] || 'bg-slate-600/20 text-slate-400'
  }

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      'active': 'Active', 'in_progress': 'In Progress', 'completed': 'Completed',
      'draft': 'Draft', 'planning': 'Planning', 'on_hold': 'On Hold',
      'closed': 'Closed', 'todo': 'To Do', 'pending': 'Pending',
      'approved': 'Approved', 'rejected': 'Rejected', 'at_risk': 'At Risk',
    }
    return map[status] || status
  }

  const priorityBadge = (priority: string) => {
    const map: Record<string, string> = {
      'high': 'bg-red-600/20 text-red-400',
      'critical': 'bg-red-600/20 text-red-400',
      'medium': 'bg-amber-600/20 text-amber-400',
      'low': 'bg-slate-600/20 text-slate-400',
    }
    return map[priority] || 'bg-slate-600/20 text-slate-400'
  }

  const priorityLabel = (priority: string) => {
    const map: Record<string, string> = {
      'high': 'High', 'critical': 'Critical', 'medium': 'Medium', 'low': 'Low',
    }
    return map[priority] || priority
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Compute kanban from tasks
  const kanbanGroups = {
    todo: allTasks.filter(t => t.status === 'todo'),
    inProgress: allTasks.filter(t => t.status === 'in_progress'),
    done: allTasks.filter(t => t.status === 'completed'),
  }

  const handleCreateProject = async () => {
    if (!projectForm.name || !projectForm.code || !companyId) {
      toast({ title: 'Validation Error', description: 'Name and code are required', variant: 'destructive' })
      return
    }
    try {
      await apiPost('/projects', {
        type: 'project',
        companyId,
        name: projectForm.name,
        code: projectForm.code,
        clientId: projectForm.clientId || null,
        startDate: projectForm.startDate || null,
        endDate: projectForm.endDate || null,
        budget: parseFloat(projectForm.budget) || 0,
        billingType: projectForm.billingType,
        description: projectForm.description || null,
        status: 'active',
      })
      toast({ title: 'Project Created', description: `"${projectForm.name}" has been created` })
      setAddProjectDialog(false)
      setProjectForm({ name: '', code: '', clientId: '', priority: 'medium', startDate: '', endDate: '', budget: '', billingType: 't_and_m', description: '' })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create project', variant: 'destructive' })
    }
  }

  const handleCreateTask = async () => {
    if (!taskForm.name || !taskForm.projectId || !companyId) {
      toast({ title: 'Validation Error', description: 'Task name and project are required', variant: 'destructive' })
      return
    }
    try {
      await apiPost('/projects', {
        type: 'task',
        projectId: taskForm.projectId,
        name: taskForm.name,
        priority: taskForm.priority,
        plannedEndDate: taskForm.plannedEndDate || null,
        estimatedHours: parseFloat(taskForm.estimatedHours) || 0,
        description: taskForm.description || null,
      })
      toast({ title: 'Task Created', description: `"${taskForm.name}" has been added` })
      setAddTaskDialog(false)
      setTaskForm({ projectId: '', name: '', priority: 'medium', plannedEndDate: '', estimatedHours: '', description: '' })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create task', variant: 'destructive' })
    }
  }

  const handleLogTimesheet = async () => {
    if (!timesheetForm.date || !timesheetForm.hours || !companyId) {
      toast({ title: 'Validation Error', description: 'Date and hours are required', variant: 'destructive' })
      return
    }
    try {
      const employeeId = (session?.user as any)?.employeeId
      await apiPost('/projects', {
        type: 'timesheet',
        companyId,
        employeeId,
        projectId: timesheetForm.projectId || null,
        taskId: timesheetForm.taskId || null,
        date: timesheetForm.date,
        hours: parseFloat(timesheetForm.hours),
        billable: timesheetForm.billable,
        description: timesheetForm.description || null,
      })
      toast({ title: 'Timesheet Logged', description: `${timesheetForm.hours} hours logged` })
      setLogTimesheetDialog(false)
      setTimesheetForm({ projectId: '', taskId: '', date: '', hours: '', billable: true, description: '' })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to log timesheet', variant: 'destructive' })
    }
  }

  const handleTaskStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      await apiPut('/projects', { type: 'task', id: taskId, status: newStatus })
      toast({ title: 'Task Updated', description: `Status changed to ${statusLabel(newStatus)}` })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update task', variant: 'destructive' })
    }
  }

  // Compute project progress
  const getProjectProgress = (project: Project) => {
    if (!project.tasks || project.tasks.length === 0) return 0
    const completed = project.tasks.filter(t => t.status === 'completed').length
    return Math.round((completed / project.tasks.length) * 100)
  }

  // Compute total budget
  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0)

  // Compute total team from allocations
  const uniqueAllocatedEmployees = new Set(allocations.filter(a => a.status === 'active').map(a => a.employeeId)).size

  // Active milestones
  const activeMilestones = milestones.filter(m => m.completionPercentage < 100)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="ml-3 text-slate-400">Loading project data...</span>
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
            <FolderKanban className="w-6 h-6 text-emerald-400" /> Project Management
          </h1>
          <p className="text-slate-400 mt-1">Manage projects, tasks, milestones, and team allocation</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setAddProjectDialog(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Project
          </Button>
          <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setAddTaskDialog(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Task
          </Button>
          <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setLogTimesheetDialog(true)}>
            <Clock className="w-4 h-4 mr-2" /> Log Time
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-600/20"><Briefcase className="w-5 h-5 text-emerald-400" /></div>
              <div><p className="text-sm text-slate-400">Active Projects</p><p className="text-2xl font-bold text-white">{stats?.activeProjects ?? projects.filter(p => p.status === 'active').length}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-600/20"><DollarSign className="w-5 h-5 text-teal-400" /></div>
              <div><p className="text-sm text-slate-400">Total Budget</p><p className="text-2xl font-bold text-teal-400">{totalBudget >= 10000000 ? `₹${(totalBudget / 10000000).toFixed(2)} Cr` : formatCurrency(totalBudget)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-600/20"><Users className="w-5 h-5 text-teal-400" /></div>
              <div><p className="text-sm text-slate-400">Team Members</p><p className="text-2xl font-bold text-white">{uniqueAllocatedEmployees}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-600/20"><Target className="w-5 h-5 text-amber-400" /></div>
              <div><p className="text-sm text-slate-400">Milestones Due</p><p className="text-2xl font-bold text-amber-400">{activeMilestones.length}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="projects">
        <TabsList className="bg-slate-900 border border-slate-700 flex-wrap h-auto">
          <TabsTrigger value="projects" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Project List</TabsTrigger>
          <TabsTrigger value="kanban" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Kanban Board</TabsTrigger>
          <TabsTrigger value="tasks" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Tasks</TabsTrigger>
          <TabsTrigger value="milestones" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Milestones</TabsTrigger>
          <TabsTrigger value="allocation" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Team Allocation</TabsTrigger>
          <TabsTrigger value="timesheets" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Timesheets</TabsTrigger>
        </TabsList>

        {/* Project List */}
        <TabsContent value="projects">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <FolderKanban className="w-12 h-12 mb-3 opacity-50" />
              <p>No projects found. Create your first project!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
              {projects.map((p) => {
                const progress = getProjectProgress(p)
                const taskCount = p.tasks?.length || 0
                const completedTasks = p.tasks?.filter(t => t.status === 'completed').length || 0
                return (
                  <Card key={p.id} className="bg-slate-900 border-slate-800 hover:border-emerald-800/50 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-white font-semibold text-lg">{p.name}</h3>
                        <Badge className={statusBadge(p.status)}>{statusLabel(p.status)}</Badge>
                      </div>
                      <p className="text-slate-400 text-sm mb-4">Client: {p.client?.name || 'Internal'}</p>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-slate-400 text-sm">Progress</span>
                            <span className="text-emerald-400 text-sm font-medium">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2 bg-slate-800" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div><span className="text-slate-500">Budget</span><p className="text-white font-medium">{formatCurrency(p.budget)}</p></div>
                          <div><span className="text-slate-500">Tasks</span><p className="text-white font-medium">{completedTasks}/{taskCount}</p></div>
                          <div><span className="text-slate-500">Code</span><p className="text-white">{p.code}</p></div>
                          <div><span className="text-slate-500">Billing</span><p className="text-white capitalize">{p.billingType.replace('_', ' ')}</p></div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-800">
                          <Calendar className="w-3 h-3" /> {formatDate(p.startDate)} — {formatDate(p.endDate)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Kanban Board */}
        <TabsContent value="kanban">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {Object.entries(kanbanGroups).map(([col, tasks]) => (
              <div key={col}>
                <div className="flex items-center gap-2 mb-3">
                  {col === 'todo' && <AlertCircle className="w-4 h-4 text-slate-400" />}
                  {col === 'inProgress' && <Clock className="w-4 h-4 text-amber-400" />}
                  {col === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  <h3 className="text-white font-semibold text-sm capitalize">{col === 'inProgress' ? 'In Progress' : col === 'todo' ? 'To Do' : 'Done'}</h3>
                  <Badge className="bg-slate-700 text-slate-300 text-xs">{tasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <Card key={t.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 cursor-pointer transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium mb-1">{t.name}</p>
                            <p className="text-slate-500 text-xs mb-2">{t.project?.name || '—'}</p>
                            <div className="flex items-center justify-between">
                              <Badge className={priorityBadge(t.priority)}>{priorityLabel(t.priority)}</Badge>
                              <span className="text-slate-500 text-xs">{t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : 'Unassigned'}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {tasks.length === 0 && (
                    <div className="text-center py-6 text-slate-600 text-xs">No tasks</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks">
          <Card className="bg-slate-900 border-slate-800 mt-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-lg">All Tasks</CardTitle>
                <Input placeholder="Search tasks..." className="max-w-xs bg-slate-800 border-slate-700 text-slate-300 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">Task</TableHead>
                      <TableHead className="text-slate-400">Project</TableHead>
                      <TableHead className="text-slate-400">Assignee</TableHead>
                      <TableHead className="text-slate-400">Priority</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Due Date</TableHead>
                      <TableHead className="text-slate-400 text-right">Estimate</TableHead>
                      <TableHead className="text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTasks.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || (t.project?.name || '').toLowerCase().includes(search.toLowerCase())).map((t) => (
                      <TableRow key={t.id} className="border-slate-800">
                        <TableCell className="text-white font-medium">{t.name}</TableCell>
                        <TableCell className="text-slate-300 text-sm">{t.project?.name || '—'}</TableCell>
                        <TableCell className="text-slate-300 text-sm">{t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : 'Unassigned'}</TableCell>
                        <TableCell><Badge className={priorityBadge(t.priority)}>{priorityLabel(t.priority)}</Badge></TableCell>
                        <TableCell><Badge className={statusBadge(t.status)}>{statusLabel(t.status)}</Badge></TableCell>
                        <TableCell className="text-slate-400 text-sm">{formatDate(t.plannedEndDate)}</TableCell>
                        <TableCell className="text-white text-right text-sm">{t.estimatedHours}h</TableCell>
                        <TableCell>
                          <Select
                            value={t.status}
                            onValueChange={(val) => handleTaskStatusUpdate(t.id, val)}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs bg-slate-800 border-slate-700 text-slate-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              <SelectItem value="todo">To Do</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Milestones */}
        <TabsContent value="milestones">
          {milestones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Target className="w-12 h-12 mb-3 opacity-50" />
              <p>No milestones found</p>
            </div>
          ) : (
            <Card className="bg-slate-900 border-slate-800 mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" /> Project Milestones
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">Milestone</TableHead>
                      <TableHead className="text-slate-400">Project</TableHead>
                      <TableHead className="text-slate-400">Target Date</TableHead>
                      <TableHead className="text-slate-400">Completion</TableHead>
                      <TableHead className="text-slate-400">Approval</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {milestones.map((m) => (
                      <TableRow key={m.id} className="border-slate-800">
                        <TableCell className="text-white font-medium">{m.name}</TableCell>
                        <TableCell className="text-slate-300 text-sm">{m.project?.name || '—'}</TableCell>
                        <TableCell className="text-slate-300 text-sm">{formatDate(m.plannedDate)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Progress value={m.completionPercentage} className="w-20 h-2 bg-slate-800" />
                            <span className="text-sm text-white font-medium">{m.completionPercentage}%</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge className={statusBadge(m.approvalStatus)}>{statusLabel(m.approvalStatus)}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Team Allocation */}
        <TabsContent value="allocation">
          {allocations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Users className="w-12 h-12 mb-3 opacity-50" />
              <p>No team allocations found</p>
            </div>
          ) : (
            <Card className="bg-slate-900 border-slate-800 mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" /> Team Allocation
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">Employee</TableHead>
                        <TableHead className="text-slate-400">Role</TableHead>
                        <TableHead className="text-slate-400">Allocation</TableHead>
                        <TableHead className="text-slate-400 text-center">Billing Rate</TableHead>
                        <TableHead className="text-slate-400">Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocations.filter(a => a.status === 'active').map((a) => (
                        <TableRow key={a.id} className="border-slate-800">
                          <TableCell className="text-white font-medium">{a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : a.employeeId}</TableCell>
                          <TableCell className="text-slate-300 text-sm">{a.role || '—'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={a.allocationPercentage} className="w-16 h-1.5 bg-slate-800" />
                              <span className={`text-sm font-medium ${a.allocationPercentage >= 100 ? 'text-red-400' : a.allocationPercentage >= 80 ? 'text-amber-400' : 'text-emerald-400'}`}>{a.allocationPercentage}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-white text-center">{a.billingRate > 0 ? formatCurrency(a.billingRate) : '—'}</TableCell>
                          <TableCell className="text-slate-400 text-xs">{formatDate(a.startDate)} — {formatDate(a.endDate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timesheets */}
        <TabsContent value="timesheets">
          {timesheets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Clock className="w-12 h-12 mb-3 opacity-50" />
              <p>No timesheet entries found</p>
            </div>
          ) : (
            <Card className="bg-slate-900 border-slate-800 mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" /> Recent Timesheets
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">Employee</TableHead>
                        <TableHead className="text-slate-400">Project</TableHead>
                        <TableHead className="text-slate-400">Date</TableHead>
                        <TableHead className="text-slate-400">Hours</TableHead>
                        <TableHead className="text-slate-400">Billable</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-slate-400">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timesheets.map((ts) => (
                        <TableRow key={ts.id} className="border-slate-800">
                          <TableCell className="text-white font-medium">{ts.employee ? `${ts.employee.firstName} ${ts.employee.lastName}` : '—'}</TableCell>
                          <TableCell className="text-slate-300 text-sm">{ts.project?.name || '—'}</TableCell>
                          <TableCell className="text-slate-300 text-sm">{formatDate(ts.date)}</TableCell>
                          <TableCell className="text-white text-sm">{ts.hours}h</TableCell>
                          <TableCell><Badge className={ts.billable ? 'bg-emerald-600/20 text-emerald-400' : 'bg-slate-600/20 text-slate-400'}>{ts.billable ? 'Yes' : 'No'}</Badge></TableCell>
                          <TableCell><Badge className={statusBadge(ts.status)}>{statusLabel(ts.status)}</Badge></TableCell>
                          <TableCell className="text-slate-400 text-sm max-w-48 truncate">{ts.description || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Project Dialog */}
      <Dialog open={addProjectDialog} onOpenChange={setAddProjectDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Add Project</DialogTitle>
            <DialogDescription className="text-slate-400">Create a new project</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-slate-400 text-sm">Project Name *</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Enter project name" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label className="text-slate-400 text-sm">Project Code *</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="e.g., PRJ-001" value={projectForm.code} onChange={e => setProjectForm(f => ({ ...f, code: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400 text-sm">Billing Type</Label>
                <Select value={projectForm.billingType} onValueChange={v => setProjectForm(f => ({ ...f, billingType: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="t_and_m">T&M</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="retainer">Retainer</SelectItem>
                    <SelectItem value="non_billable">Non-Billable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-slate-400 text-sm">Budget (₹)</Label><Input type="number" className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="0" value={projectForm.budget} onChange={e => setProjectForm(f => ({ ...f, budget: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-slate-400 text-sm">Start Date</Label><Input type="date" className="bg-slate-800 border-slate-700 text-white mt-1" value={projectForm.startDate} onChange={e => setProjectForm(f => ({ ...f, startDate: e.target.value }))} /></div>
              <div><Label className="text-slate-400 text-sm">End Date</Label><Input type="date" className="bg-slate-800 border-slate-700 text-white mt-1" value={projectForm.endDate} onChange={e => setProjectForm(f => ({ ...f, endDate: e.target.value }))} /></div>
            </div>
            <div><Label className="text-slate-400 text-sm">Description</Label><Textarea className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Project description..." value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setAddProjectDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreateProject}>Create Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={addTaskDialog} onOpenChange={setAddTaskDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Add Task</DialogTitle>
            <DialogDescription className="text-slate-400">Create a new task</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-slate-400 text-sm">Task Title *</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Enter task title" value={taskForm.name} onChange={e => setTaskForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label className="text-slate-400 text-sm">Project *</Label>
              <Select value={taskForm.projectId} onValueChange={v => setTaskForm(f => ({ ...f, projectId: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400 text-sm">Priority</Label>
                <Select value={taskForm.priority} onValueChange={v => setTaskForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-slate-400 text-sm">Due Date</Label><Input type="date" className="bg-slate-800 border-slate-700 text-white mt-1" value={taskForm.plannedEndDate} onChange={e => setTaskForm(f => ({ ...f, plannedEndDate: e.target.value }))} /></div>
            </div>
            <div><Label className="text-slate-400 text-sm">Estimate (hours)</Label><Input type="number" className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="8" value={taskForm.estimatedHours} onChange={e => setTaskForm(f => ({ ...f, estimatedHours: e.target.value }))} /></div>
            <div><Label className="text-slate-400 text-sm">Description</Label><Textarea className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Task description..." value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setAddTaskDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreateTask}>Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Timesheet Dialog */}
      <Dialog open={logTimesheetDialog} onOpenChange={setLogTimesheetDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Log Timesheet</DialogTitle>
            <DialogDescription className="text-slate-400">Record your work hours</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-400 text-sm">Project</Label>
              <Select value={timesheetForm.projectId} onValueChange={v => setTimesheetForm(f => ({ ...f, projectId: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400 text-sm">Task</Label>
              <Select value={timesheetForm.taskId} onValueChange={v => setTimesheetForm(f => ({ ...f, taskId: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue placeholder="Select task (optional)" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {allTasks.filter(t => !timesheetForm.projectId || t.projectId === timesheetForm.projectId).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-slate-400 text-sm">Date *</Label><Input type="date" className="bg-slate-800 border-slate-700 text-white mt-1" value={timesheetForm.date} onChange={e => setTimesheetForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><Label className="text-slate-400 text-sm">Hours *</Label><Input type="number" step="0.5" className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="8" value={timesheetForm.hours} onChange={e => setTimesheetForm(f => ({ ...f, hours: e.target.value }))} /></div>
            </div>
            <div><Label className="text-slate-400 text-sm">Description</Label><Textarea className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Work description..." value={timesheetForm.description} onChange={e => setTimesheetForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setLogTimesheetDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleLogTimesheet}>Log Hours</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
