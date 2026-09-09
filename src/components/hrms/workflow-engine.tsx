'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  GitBranch, Play, LayoutTemplate, Search, Plus,
  ArrowRight, CheckCircle2, Clock, AlertCircle, User, Zap, Loader2,
  Shield, FileText, Briefcase
} from 'lucide-react'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { useHRMSStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

interface AuditLog {
  id: string
  companyId?: string | null
  userId?: string | null
  action: string
  entity: string
  entityId?: string | null
  details?: string | null
  ipAddress?: string | null
  createdAt: string
  user?: { name: string; email: string; role: string } | null
}

interface PendingApprovals {
  leaves: number
  requisitions: number
  tickets: number
  timesheets: number
}

interface WorkflowData {
  recentActions: AuditLog[]
  actionSummary: Record<string, number>
  pendingApprovals: PendingApprovals
  totalPending: number
}

const actionColor: Record<string, string> = {
  'CREATE': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'UPDATE': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'DELETE': 'bg-red-500/10 text-red-400 border-red-500/20',
  'APPROVE': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'REJECT': 'bg-red-500/10 text-red-400 border-red-500/20',
  'NOTIFICATION_CREATED': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
}

const entityIcon: Record<string, any> = {
  'LeaveApplication': Clock,
  'Requisition': Briefcase,
  'Ticket': FileText,
  'Timesheet': Clock,
  'Notification': Zap,
  'Employee': User,
  'Project': GitBranch,
}

export default function WorkflowEngineModule() {
  const { data: session } = useSession()
  const { currentCompanyId } = useHRMSStore()
  const { toast } = useToast()

  const companyId = currentCompanyId || (session?.user as any)?.companyId

  const [activeTab, setActiveTab] = useState('pending')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [workflowData, setWorkflowData] = useState<WorkflowData | null>(null)

  const fetchData = useCallback(async () => {
    if (!companyId) return
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<WorkflowData>('/workflows', { companyId })
      setWorkflowData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load workflow data')
      toast({ title: 'Error', description: 'Failed to load workflow data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [companyId, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredActions = (workflowData?.recentActions || []).filter(a =>
    a.action.toLowerCase().includes(search.toLowerCase()) ||
    a.entity.toLowerCase().includes(search.toLowerCase()) ||
    (a.details || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.user?.name || '').toLowerCase().includes(search.toLowerCase())
  )

  const actionSummary = workflowData?.actionSummary || {}
  const pendingApprovals = workflowData?.pendingApprovals || { leaves: 0, requisitions: 0, tickets: 0, timesheets: 0 }
  const totalPending = workflowData?.totalPending || 0

  const stats = [
    { label: 'Pending Approvals', value: totalPending, icon: AlertCircle, color: 'from-amber-500 to-amber-600' },
    { label: 'Pending Leaves', value: pendingApprovals.leaves, icon: Clock, color: 'from-cyan-500 to-cyan-600' },
    { label: 'Pending Requisitions', value: pendingApprovals.requisitions, icon: Briefcase, color: 'from-teal-500 to-teal-600' },
    { label: 'Audit Actions', value: (workflowData?.recentActions || []).length, icon: Play, color: 'from-teal-500 to-teal-600' },
  ]

  // Approve a leave
  const handleApproveLeave = async (leaveId: string) => {
    setActionLoading(leaveId)
    try {
      await apiPut('/leave', { id: leaveId, status: 'approved', approvedById: (session?.user as any)?.employeeId })
      await apiPost('/notifications', { companyId, type: 'leave', title: 'Leave Approved', message: `Leave request has been approved` })
      toast({ title: 'Leave Approved', description: 'The leave request has been approved' })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to approve leave', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  // Approve a requisition
  const handleApproveRequisition = async (reqId: string) => {
    setActionLoading(reqId)
    try {
      await apiPut('/recruitment', { type: 'requisition', id: reqId, approvalStatus: 'approved' })
      await apiPost('/notifications', { companyId, type: 'recruitment', title: 'Requisition Approved', message: `Requisition has been approved` })
      toast({ title: 'Requisition Approved', description: 'The requisition has been approved' })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to approve requisition', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  // Approve timesheet
  const handleApproveTimesheet = async (tsId: string) => {
    setActionLoading(tsId)
    try {
      await apiPut('/projects', { type: 'timesheet', id: tsId, status: 'approved', approvedById: (session?.user as any)?.employeeId })
      await apiPost('/notifications', { companyId, type: 'timesheet', title: 'Timesheet Approved', message: `Timesheet entry has been approved` })
      toast({ title: 'Timesheet Approved', description: 'The timesheet has been approved' })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to approve timesheet', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="ml-3 text-slate-400">Loading workflow data...</span>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Workflow Engine</h1>
          <p className="text-slate-400 mt-1">Manage approvals and workflow actions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-white">{s.value}</span>
                </div>
                <p className="text-sm text-slate-400">{s.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input placeholder="Search actions, entities..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-slate-900 border-slate-800 text-white" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-800 p-1 h-auto flex-wrap">
          <TabsTrigger value="pending" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Pending Approvals</TabsTrigger>
          <TabsTrigger value="audit" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Action History</TabsTrigger>
          <TabsTrigger value="summary" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Action Summary</TabsTrigger>
          <TabsTrigger value="builder" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Workflow Builder</TabsTrigger>
        </TabsList>

        {/* Pending Approvals Tab */}
        <TabsContent value="pending" className="mt-4">
          <div className="space-y-4">
            {/* Pending Leaves */}
            {pendingApprovals.leaves > 0 && (
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" /> Pending Leave Approvals
                    </CardTitle>
                    <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">{pendingApprovals.leaves}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <p className="text-white font-medium">{pendingApprovals.leaves} leave requests awaiting approval</p>
                      <p className="text-xs text-slate-500 mt-1">Go to Leave module to view and approve individual requests</p>
                    </div>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs" onClick={() => { useHRMSStore.getState().selectModuleWithSubItem('leave', 'requests') }}>View Leaves</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pending Requisitions */}
            {pendingApprovals.requisitions > 0 && (
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-teal-400" /> Pending Requisitions
                    </CardTitle>
                    <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20">{pendingApprovals.requisitions}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <p className="text-white font-medium">{pendingApprovals.requisitions} requisitions awaiting approval</p>
                      <p className="text-xs text-slate-500 mt-1">Go to Recruitment module to view and approve requisitions</p>
                    </div>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs" onClick={() => { useHRMSStore.getState().selectModule('recruitment') }}>View Requisitions</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pending Tickets */}
            {pendingApprovals.tickets > 0 && (
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-400" /> Open Tickets
                    </CardTitle>
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">{pendingApprovals.tickets}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <p className="text-white font-medium">{pendingApprovals.tickets} open helpdesk tickets</p>
                      <p className="text-xs text-slate-500 mt-1">Go to Helpdesk module to resolve tickets</p>
                    </div>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs" onClick={() => { useHRMSStore.getState().selectModule('helpdesk') }}>View Tickets</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pending Timesheets */}
            {pendingApprovals.timesheets > 0 && (
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <Clock className="w-4 h-4 text-teal-400" /> Pending Timesheets
                    </CardTitle>
                    <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20">{pendingApprovals.timesheets}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <p className="text-white font-medium">{pendingApprovals.timesheets} timesheet entries awaiting approval</p>
                      <p className="text-xs text-slate-500 mt-1">Go to Projects module to view and approve timesheets</p>
                    </div>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs" onClick={() => { useHRMSStore.getState().selectModule('projects') }}>View Timesheets</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {totalPending === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <CheckCircle2 className="w-12 h-12 mb-3 text-emerald-400 opacity-50" />
                <p>All caught up! No pending approvals.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Audit / Action History Tab */}
        <TabsContent value="audit" className="mt-4">
          {filteredActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Zap className="w-12 h-12 mb-3 opacity-50" />
              <p>No action history found</p>
            </div>
          ) : (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left text-xs font-medium text-slate-400 p-4">Timestamp</th>
                        <th className="text-left text-xs font-medium text-slate-400 p-4">Action</th>
                        <th className="text-left text-xs font-medium text-slate-400 p-4">Entity</th>
                        <th className="text-left text-xs font-medium text-slate-400 p-4">User</th>
                        <th className="text-left text-xs font-medium text-slate-400 p-4">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActions.slice(0, 50).map(log => {
                        const IconComp = entityIcon[log.entity] || Zap
                        return (
                          <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="p-4 text-sm text-slate-400 font-mono text-xs">{formatDate(log.createdAt)}</td>
                            <td className="p-4">
                              <Badge variant="outline" className={actionColor[log.action] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>
                                {log.action}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <IconComp className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-sm text-white">{log.entity}</span>
                              </div>
                            </td>
                            <td className="p-4 text-sm text-slate-300">{log.user?.name || 'System'}</td>
                            <td className="p-4 text-sm text-slate-400 max-w-64 truncate">{log.details || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Action Summary Tab */}
        <TabsContent value="summary" className="mt-4">
          {Object.keys(actionSummary).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <LayoutTemplate className="w-12 h-12 mb-3 opacity-50" />
              <p>No action summary data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Object.entries(actionSummary).sort(([, a], [, b]) => (b as number) - (a as number)).map(([action, count]) => (
                <Card key={action} className="bg-slate-900 border-slate-800">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-white font-medium text-sm">{action}</h3>
                          <p className="text-xs text-slate-500">Action type</p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-white">{count as number}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(((count as number) / Math.max(...Object.values(actionSummary) as number[])) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Workflow Builder Tab */}
        <TabsContent value="builder" className="mt-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-lg">Leave Approval Workflow</CardTitle>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">5 Steps</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {[
                  { step: 1, label: 'Initiator', description: 'Employee submits request', type: 'start' },
                  { step: 2, label: 'Reporting Manager', description: 'First-level approval', type: 'approval' },
                  { step: 3, label: 'Department Head', description: 'Second-level approval', type: 'approval' },
                  { step: 4, label: 'HR Review', description: 'HR verification & processing', type: 'review' },
                  { step: 5, label: 'Completed', description: 'Request processed', type: 'end' },
                ].map((step, idx) => {
                  const stepTypeColor: Record<string, string> = {
                    'start': 'bg-emerald-500', 'approval': 'bg-amber-500', 'review': 'bg-cyan-500', 'end': 'bg-emerald-500',
                  }
                  return (
                    <div key={step.step} className="relative">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full ${stepTypeColor[step.type]} flex items-center justify-center text-white text-sm font-bold shadow-lg`}>
                            {step.step}
                          </div>
                          {idx < 4 && <div className="w-0.5 h-12 bg-slate-700" />}
                        </div>
                        <div className="flex-1 pb-6">
                          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-white font-medium text-sm">{step.label}</h4>
                                <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                              </div>
                              <Badge variant="outline" className={`text-[10px] ${step.type === 'start' || step.type === 'end' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : step.type === 'approval' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}`}>
                                {step.type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
