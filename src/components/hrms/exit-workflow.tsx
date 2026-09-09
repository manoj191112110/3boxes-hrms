'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  LogOut, FileCheck, Calculator, MessageSquare, Users, Search, Plus,
  ArrowRight, CheckCircle2, Clock, XCircle, AlertCircle, UserMinus, Building2, Loader2
} from 'lucide-react'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { useHRMSStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

interface EmployeeInfo {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  email: string
  department: { name: string } | null
  designation: { name: string } | null
}

interface ExitRequest {
  id: string
  companyId: string
  employeeId: string
  type: string
  reason: string | null
  noticePeriodEndDate: string | null
  lastWorkingDate: string | null
  status: string
  knowledgeTransfer: boolean
  projectHandover: boolean
  assetCleared: boolean
  itAccessRevoked: boolean
  payrollFnf: boolean
  exitInterviewDone: boolean
  relievingLetterIssued: boolean
  createdAt: string
  updatedAt: string
  employee: EmployeeInfo
}

interface ExitStats {
  pending: number
  inProgress: number
  completed: number
  total: number
}

const statusColor: Record<string, string> = {
  'in_progress': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'approved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'completed': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'pending': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'processed': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

const typeColor: Record<string, string> = {
  'resignation': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'termination': 'bg-red-500/10 text-red-400 border-red-500/20',
  'mutual': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
}

const CLEARANCE_ITEMS: { key: keyof ExitRequest; label: string }[] = [
  { key: 'knowledgeTransfer', label: 'Knowledge Transfer' },
  { key: 'projectHandover', label: 'Project Handover' },
  { key: 'assetCleared', label: 'Asset Return' },
  { key: 'itAccessRevoked', label: 'IT Access Revocation' },
  { key: 'payrollFnf', label: 'Payroll FNF' },
  { key: 'exitInterviewDone', label: 'Exit Interview' },
  { key: 'relievingLetterIssued', label: 'Relieving Letter' },
]

export default function ExitWorkflowModule() {
  const { currentCompanyId } = useHRMSStore()
  const { toast } = useToast()
  const companyId = currentCompanyId || ''

  const [activeTab, setActiveTab] = useState('resignations')
  const [search, setSearch] = useState('')
  const [resignDialog, setResignDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Data states
  const [requests, setRequests] = useState<ExitRequest[]>([])
  const [exitStats, setExitStats] = useState<ExitStats | null>(null)

  // Form state
  const [resignForm, setResignForm] = useState({
    employeeId: '',
    type: 'resignation',
    reason: '',
    noticePeriodEndDate: '',
    lastWorkingDate: '',
  })

  const fetchData = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<{ requests: ExitRequest[]; stats: ExitStats }>('/exit-workflow', { companyId })
      setRequests(data.requests || [])
      setExitStats(data.stats || null)
    } catch (err: any) {
      console.error('Failed to fetch exit workflow data:', err)
      setError(err.message || 'Failed to load exit workflow data')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmitResignation = async () => {
    if (!resignForm.employeeId) {
      toast({ title: 'Validation Error', description: 'Please select an employee', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await apiPost('/exit-workflow', {
        companyId,
        employeeId: resignForm.employeeId,
        type: resignForm.type,
        reason: resignForm.reason || undefined,
        noticePeriodEndDate: resignForm.noticePeriodEndDate || undefined,
        lastWorkingDate: resignForm.lastWorkingDate || undefined,
      })
      toast({ title: 'Success', description: 'Resignation submitted successfully' })
      setResignDialog(false)
      setResignForm({ employeeId: '', type: 'resignation', reason: '', noticePeriodEndDate: '', lastWorkingDate: '' })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to submit resignation', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleClearance = async (requestId: string, fieldKey: string, currentValue: boolean) => {
    setUpdatingId(requestId)
    try {
      await apiPut('/exit-workflow', {
        id: requestId,
        [fieldKey]: !currentValue,
      })
      toast({ title: currentValue ? 'Item Unchecked' : 'Item Completed', description: `${CLEARANCE_ITEMS.find(c => c.key === fieldKey)?.label} ${currentValue ? 'unchecked' : 'completed'}` })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update clearance', variant: 'destructive' })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleApproveReject = async (requestId: string, newStatus: string) => {
    setUpdatingId(requestId)
    try {
      await apiPut('/exit-workflow', {
        id: requestId,
        status: newStatus,
      })
      toast({ title: 'Status Updated', description: `Exit request ${newStatus === 'approved' ? 'approved' : newStatus === 'completed' ? 'marked as completed' : `changed to ${newStatus}`}` })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update status', variant: 'destructive' })
    } finally {
      setUpdatingId(null)
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch { return dateStr }
  }

  const formatStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Approval'
      case 'in_progress': return 'In Progress'
      case 'approved': return 'Approved'
      case 'completed': return 'Completed'
      default: return status
    }
  }

  const formatTypeLabel = (type: string) => {
    switch (type) {
      case 'resignation': return 'Voluntary'
      case 'termination': return 'Termination'
      case 'mutual': return 'Mutual'
      default: return type
    }
  }

  const filteredRequests = requests.filter(r =>
    `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    r.employee.department?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.type.toLowerCase().includes(search.toLowerCase())
  )

  const getClearanceProgress = (request: ExitRequest) => {
    const completed = CLEARANCE_ITEMS.filter(item => request[item.key] === true).length
    return Math.round((completed / CLEARANCE_ITEMS.length) * 100)
  }

  const stats = [
    { label: 'Pending Approval', value: exitStats?.pending ?? requests.filter(r => r.status === 'pending').length, icon: Clock, color: 'from-amber-500 to-amber-600' },
    { label: 'In Progress', value: exitStats?.inProgress ?? requests.filter(r => r.status === 'in_progress').length, icon: FileCheck, color: 'from-teal-500 to-teal-600' },
    { label: 'Completed', value: exitStats?.completed ?? requests.filter(r => r.status === 'completed').length, icon: CheckCircle2, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Total Requests', value: exitStats?.total ?? requests.length, icon: Users, color: 'from-teal-500 to-teal-600' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="ml-3 text-slate-400">Loading exit workflow data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-400">{error}</p>
        <Button onClick={fetchData} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Exit Workflow</h1>
          <p className="text-slate-400 mt-1">Manage employee exits, clearance, and settlements</p>
        </div>
        <Dialog open={resignDialog} onOpenChange={setResignDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="w-4 h-4" /> Initiate Resignation
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">Initiate Resignation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Employee ID</Label>
                <Input
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Enter employee ID"
                  value={resignForm.employeeId}
                  onChange={e => setResignForm(prev => ({ ...prev, employeeId: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Resignation Type</Label>
                  <Select value={resignForm.type} onValueChange={v => setResignForm(prev => ({ ...prev, type: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="resignation" className="text-slate-300">Voluntary</SelectItem>
                      <SelectItem value="termination" className="text-slate-300">Termination</SelectItem>
                      <SelectItem value="mutual" className="text-slate-300">Mutual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Notice Period End</Label>
                  <Input
                    type="date"
                    className="bg-slate-800 border-slate-700 text-white"
                    value={resignForm.noticePeriodEndDate}
                    onChange={e => setResignForm(prev => ({ ...prev, noticePeriodEndDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Last Working Date</Label>
                <Input
                  type="date"
                  className="bg-slate-800 border-slate-700 text-white"
                  value={resignForm.lastWorkingDate}
                  onChange={e => setResignForm(prev => ({ ...prev, lastWorkingDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Reason</Label>
                <Textarea
                  className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
                  placeholder="Enter reason for resignation..."
                  value={resignForm.reason}
                  onChange={e => setResignForm(prev => ({ ...prev, reason: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" className="border-slate-700 text-slate-300">Cancel</Button></DialogClose>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSubmitResignation} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Submit Resignation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
        <Input placeholder="Search by name, department..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-slate-900 border-slate-800 text-white" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-800 p-1 h-auto flex-wrap">
          <TabsTrigger value="resignations" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Resignations</TabsTrigger>
          <TabsTrigger value="clearance" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Clearance</TabsTrigger>
          <TabsTrigger value="alumni" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Alumni</TabsTrigger>
        </TabsList>

        {/* Resignations Tab */}
        <TabsContent value="resignations" className="mt-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0">
              {filteredRequests.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No exit requests found.</div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left text-xs font-medium text-slate-400 p-4">ID</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Employee</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Type</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Notice Period End</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Last Working Date</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Status</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map(r => (
                      <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-sm text-emerald-400 font-mono">{r.id.slice(-6).toUpperCase()}</td>
                        <td className="p-4">
                          <div className="text-sm text-white font-medium">{r.employee.firstName} {r.employee.lastName}</div>
                          <div className="text-xs text-slate-500">{r.employee.department?.name || '-'} · {r.employee.designation?.name || '-'}</div>
                        </td>
                        <td className="p-4"><Badge variant="outline" className={typeColor[r.type] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>{formatTypeLabel(r.type)}</Badge></td>
                        <td className="p-4 text-sm text-slate-300">{formatDate(r.noticePeriodEndDate)}</td>
                        <td className="p-4 text-sm text-slate-300">{formatDate(r.lastWorkingDate)}</td>
                        <td className="p-4"><Badge variant="outline" className={statusColor[r.status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>{formatStatusLabel(r.status)}</Badge></td>
                        <td className="p-4">
                          <div className="flex gap-1">
                            {r.status === 'pending' && (
                              <>
                                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApproveReject(r.id, 'approved')} disabled={updatingId === r.id}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs border-red-600/30 text-red-400 hover:bg-red-600/10" onClick={() => handleApproveReject(r.id, 'completed')} disabled={updatingId === r.id}>
                                  Reject
                                </Button>
                              </>
                            )}
                            {r.status === 'approved' && (
                              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApproveReject(r.id, 'in_progress')} disabled={updatingId === r.id}>
                                Start Process
                              </Button>
                            )}
                            {r.status === 'in_progress' && getClearanceProgress(r) === 100 && (
                              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApproveReject(r.id, 'completed')} disabled={updatingId === r.id}>
                                Complete
                              </Button>
                            )}
                            {updatingId === r.id && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clearance Checklist Tab */}
        <TabsContent value="clearance" className="mt-4">
          <div className="space-y-4">
            {requests.filter(r => r.status === 'in_progress' || r.status === 'approved').length === 0 ? (
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-8 text-center text-slate-500">
                  No active clearance processes. Approve a resignation to start the clearance process.
                </CardContent>
              </Card>
            ) : (
            requests.filter(r => r.status === 'in_progress' || r.status === 'approved')
              .filter(r =>
                `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
                r.employee.department?.name?.toLowerCase().includes(search.toLowerCase())
              )
              .map(r => {
                const pct = getClearanceProgress(r)
                const completedCount = CLEARANCE_ITEMS.filter(item => r[item.key] === true).length
                return (
                  <Card key={r.id} className="bg-slate-900 border-slate-800">
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <FileCheck className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="text-white font-medium">{r.employee.firstName} {r.employee.lastName}</h3>
                            <p className="text-xs text-slate-500">{r.employee.department?.name || '-'} · Last Date: {formatDate(r.lastWorkingDate)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-400">{completedCount}/{CLEARANCE_ITEMS.length}</span>
                          <Badge variant="outline" className={pct === 100 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : pct >= 50 ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}>
                            {pct}%
                          </Badge>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full mb-4 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-cyan-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {CLEARANCE_ITEMS.map(item => {
                          const checked = r[item.key] === true
                          return (
                            <div key={item.key} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => handleToggleClearance(r.id, item.key, checked)}
                                className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                disabled={updatingId === r.id}
                              />
                              <span className={`text-xs ${checked ? 'text-emerald-400' : 'text-slate-400'}`}>{item.label}</span>
                            </div>
                          )
                        })}
                      </div>
                      {pct === 100 && r.status === 'in_progress' && (
                        <div className="mt-4 pt-4 border-t border-slate-800">
                          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleApproveReject(r.id, 'completed')} disabled={updatingId === r.id}>
                            {updatingId === r.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Exit as Completed
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* Alumni Tab */}
        <TabsContent value="alumni" className="mt-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0">
              {requests.filter(r => r.status === 'completed').length === 0 ? (
                <div className="p-8 text-center text-slate-500">No alumni records yet.</div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Employee Code</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Name</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Department</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Last Working Date</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Type</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Reason</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Relieving Letter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.filter(r => r.status === 'completed').map(r => (
                      <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-sm text-emerald-400 font-mono">{r.employee.employeeCode}</td>
                        <td className="p-4">
                          <div className="text-sm text-white font-medium">{r.employee.firstName} {r.employee.lastName}</div>
                          <div className="text-xs text-slate-500">{r.employee.designation?.name || '-'}</div>
                        </td>
                        <td className="p-4 text-sm text-slate-300">{r.employee.department?.name || '-'}</td>
                        <td className="p-4 text-sm text-slate-300">{formatDate(r.lastWorkingDate)}</td>
                        <td className="p-4"><Badge variant="outline" className={typeColor[r.type] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>{formatTypeLabel(r.type)}</Badge></td>
                        <td className="p-4 text-sm text-slate-300">{r.reason || '-'}</td>
                        <td className="p-4">
                          {r.relievingLetterIssued ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Issued</Badge>
                          ) : (
                            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
