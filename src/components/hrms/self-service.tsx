'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import {
  User, CalendarDays, DollarSign, Clock, FileText, Plus,
  Download, CheckCircle2, XCircle, AlertCircle, ArrowRight
} from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { useHRMSStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

// ── Types ──
interface EmployeeData {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  gender?: string
  dateOfBirth?: string
  nationality?: string
  address?: string
  city?: string
  status: string
  joiningDate?: string
  department?: { id: string; name: string }
  designation?: { id: string; name: string }
  branch?: { id: string; name: string; city?: string }
  company?: { name: string; code: string }
  reportingManagerId?: string
  employmentType?: string
}

interface LeaveType {
  id: string
  name: string
  code: string
  isPaid: boolean
  maxPerYear: number
  carryForward: boolean
  encashable: boolean
}

interface LeaveApplication {
  id: string
  companyId: string
  employeeId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  totalDays: number
  halfDay: boolean
  reason?: string
  status: string
  createdAt: string
  leaveType: { id: string; name: string; code: string }
  employee: { id: string; firstName: string; lastName: string; employeeCode: string }
}

interface AttendanceRecord {
  id: string
  date: string
  firstPunchIn?: string
  lastPunchOut?: string
  workedHours: number
  status: string
  lateMark: boolean
  source: string
}

interface PayrollRunData {
  id: string
  month: number
  year: number
  status: string
  processedDate?: string
  transactions: PayrollTransactionData[]
}

interface PayrollTransactionData {
  id: string
  employeeId: string
  grossEarnings: number
  totalDeductions: number
  netPay: number
  basic: number
  hra: number
  specialAllowance: number
  pf: number
  professionalTax: number
  currency: string
  employee: { id: string; firstName: string; lastName: string; employeeCode: string }
}

interface EmployeeDocument {
  id: string
  name: string
  type: string
  fileUrl?: string
  status: string
  createdAt: string
}

const leaveStatusColor: Record<string, string> = {
  'Approved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'approved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Pending': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'pending': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Rejected': 'bg-red-500/10 text-red-400 border-red-500/20',
  'rejected': 'bg-red-500/10 text-red-400 border-red-500/20',
}

const reqStatusColor: Record<string, string> = {
  'In Progress': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'in_progress': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Resolved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'resolved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Closed': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'closed': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Open': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'open': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const docStatusColor: Record<string, string> = {
  'Verified': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'active': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Pending': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const fmtCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtStatus = (s: string) => s.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')

export default function SelfServiceModule() {
  const { data: session } = useSession()
  const { currentCompanyId } = useHRMSStore()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<EmployeeData | null>(null)
  const [employees, setEmployees] = useState<EmployeeData[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [leaveApps, setLeaveApps] = useState<LeaveApplication[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, late: 0, halfDay: 0, total: 0 })
  const [payslipRuns, setPayslipRuns] = useState<PayrollRunData[]>([])
  const [myPayslips, setMyPayslips] = useState<PayrollTransactionData[]>([])
  const [documents, setDocuments] = useState<EmployeeDocument[]>([])
  const [tickets, setTickets] = useState<any[]>([])

  // Leave application dialog
  const [leaveDialog, setLeaveDialog] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '', halfDay: false })
  const [submittingLeave, setSubmittingLeave] = useState(false)

  // Attendance dialog
  const [attendanceDialog, setAttendanceDialog] = useState(false)
  const [attendanceForm, setAttendanceForm] = useState({ date: new Date().toISOString().split('T')[0], punchIn: '09:00', punchOut: '18:00', status: 'present' })
  const [submittingAttendance, setSubmittingAttendance] = useState(false)

  // Request dialog
  const [requestDialog, setRequestDialog] = useState(false)
  const [requestForm, setRequestForm] = useState({ category: '', priority: '', subject: '', description: '' })
  const [submittingRequest, setSubmittingRequest] = useState(false)

  const companyId = currentCompanyId || (session?.user as any)?.companyId

  // Find current employee from session
  const currentEmployeeId = employees.find(e => e.email === session?.user?.email)?.id

  const fetchData = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [empRes, leaveRes, attendRes, payrollRes] = await Promise.all([
        apiGet<{ employees: EmployeeData[]; total: number }>('/api/employees', { companyId, limit: '100' }),
        apiGet<{ leaveTypes: LeaveType[]; applications: LeaveApplication[] }>('/api/leave', { companyId, include: 'all' }),
        apiGet<{ records: AttendanceRecord[]; stats: { present: number; absent: number; late: number; halfDay: number; total: number } }>('/api/attendance', { companyId }),
        apiGet<{ runs: PayrollRunData[] }>('/api/payroll', { companyId, include: 'runs' }),
      ])

      setEmployees(empRes.employees)
      setLeaveTypes(leaveRes.leaveTypes || [])
      setLeaveApps(leaveRes.applications || [])
      setAttendanceRecords(attendRes.records || [])
      setAttendanceStats(attendRes.stats || { present: 0, absent: 0, late: 0, halfDay: 0, total: 0 })
      setPayslipRuns(payrollRes.runs || [])

      // Find current user's employee record
      const currentEmp = empRes.employees.find((e: EmployeeData) => e.email === session?.user?.email)
      if (currentEmp) {
        setEmployee(currentEmp)

        // Filter leave applications for this employee
        // (will be done in render)

        // Filter attendance for this employee
        const myAttendance = (attendRes.records || []).filter((r: AttendanceRecord) => r.employeeId === currentEmp.id)
        setAttendanceRecords(myAttendance)

        // Compute attendance stats from my records
        const myPresent = myAttendance.filter((r: AttendanceRecord) => r.status === 'present').length
        const myAbsent = myAttendance.filter((r: AttendanceRecord) => r.status === 'absent').length
        const myLate = myAttendance.filter((r: AttendanceRecord) => r.lateMark).length
        const myHalfDay = myAttendance.filter((r: AttendanceRecord) => r.status === 'half_day').length
        setAttendanceStats({ present: myPresent, absent: myAbsent, late: myLate, halfDay: myHalfDay, total: myAttendance.length })

        // Filter payroll transactions for this employee
        const myPayTxns: PayrollTransactionData[] = []
        for (const run of payrollRes.runs || []) {
          if (run.status === 'completed') {
            const txns = (run.transactions || []).filter((t: PayrollTransactionData) => t.employeeId === currentEmp.id)
            myPayTxns.push(...txns.map((t: PayrollTransactionData) => ({ ...t, runMonth: run.month, runYear: run.year, runProcessedDate: run.processedDate })))
          }
        }
        setMyPayslips(myPayTxns)

        // Fetch documents
        try {
          const docRes = await apiGet<{ employees: EmployeeData[] }>('/api/employees', { companyId, search: currentEmp.email, limit: '1' })
          // Documents come from EmployeeDocument model - we'll use helpdesk tickets as a proxy for requests
        } catch {}

        // Fetch helpdesk tickets for this employee as "requests"
        try {
          const helpRes = await apiGet<{ tickets: any[] }>('/api/helpdesk', { companyId })
          const myTickets = (helpRes.tickets || []).filter((t: any) => t.requesterId === currentEmp.id)
          setTickets(myTickets)
        } catch {}
      }
    } catch (error: any) {
      console.error('Self-service fetch error:', error)
      toast({ title: 'Error', description: 'Failed to load self-service data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [companyId, session?.user?.email, toast])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Leave balance computation ──
  const leaveBalance = leaveTypes.map(lt => {
    const used = leaveApps
      .filter(a => a.leaveTypeId === lt.id && (a.status === 'approved' || a.status === 'Approved') && a.employeeId === currentEmployeeId)
      .reduce((sum, a) => sum + a.totalDays, 0)
    return {
      type: lt.name,
      total: lt.maxPerYear,
      used: Math.round(used),
      balance: Math.max(0, lt.maxPerYear - Math.round(used)),
      color: ['bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-teal-500', 'bg-amber-500'][leaveTypes.indexOf(lt) % 5],
    }
  })

  // ── My leave applications ──
  const myLeaves = leaveApps.filter(a => a.employeeId === currentEmployeeId)

  // ── Submit leave ──
  const handleSubmitLeave = async () => {
    if (!leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate) {
      toast({ title: 'Validation', description: 'Please fill all required fields', variant: 'destructive' })
      return
    }
    setSubmittingLeave(true)
    try {
      const start = new Date(leaveForm.startDate)
      const end = new Date(leaveForm.endDate)
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
      await apiPost('/api/leave', {
        companyId,
        employeeId: currentEmployeeId,
        leaveTypeId: leaveForm.leaveTypeId,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        totalDays: days,
        halfDay: leaveForm.halfDay,
        reason: leaveForm.reason,
      })
      toast({ title: 'Success', description: 'Leave application submitted' })
      setLeaveDialog(false)
      setLeaveForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '', halfDay: false })
      fetchData()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to submit leave', variant: 'destructive' })
    } finally {
      setSubmittingLeave(false)
    }
  }

  // ── Mark attendance ──
  const handleMarkAttendance = async () => {
    if (!attendanceForm.date) {
      toast({ title: 'Validation', description: 'Please select a date', variant: 'destructive' })
      return
    }
    setSubmittingAttendance(true)
    try {
      const punchInDT = new Date(`${attendanceForm.date}T${attendanceForm.punchIn}:00`)
      const punchOutDT = new Date(`${attendanceForm.date}T${attendanceForm.punchOut}:00`)
      const workedHours = Math.max(0, (punchOutDT.getTime() - punchInDT.getTime()) / (1000 * 60 * 60))
      const isLate = attendanceForm.punchIn > '09:15'

      await apiPost('/api/attendance', {
        companyId,
        employeeId: currentEmployeeId,
        date: attendanceForm.date,
        firstPunchIn: punchInDT.toISOString(),
        lastPunchOut: punchOutDT.toISOString(),
        workedHours: Math.round(workedHours * 100) / 100,
        status: attendanceForm.status,
        source: 'web',
        lateMark: isLate,
      })
      toast({ title: 'Success', description: 'Attendance marked successfully' })
      setAttendanceDialog(false)
      fetchData()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to mark attendance', variant: 'destructive' })
    } finally {
      setSubmittingAttendance(false)
    }
  }

  // ── Submit request (helpdesk ticket) ──
  const handleSubmitRequest = async () => {
    if (!requestForm.subject || !requestForm.category) {
      toast({ title: 'Validation', description: 'Please fill category and subject', variant: 'destructive' })
      return
    }
    setSubmittingRequest(true)
    try {
      await apiPost('/api/helpdesk', {
        companyId,
        requesterId: currentEmployeeId,
        category: requestForm.category,
        priority: requestForm.priority || 'medium',
        subject: requestForm.subject,
        description: requestForm.description,
      })
      toast({ title: 'Success', description: 'Request submitted successfully' })
      setRequestDialog(false)
      setRequestForm({ category: '', priority: '', subject: '', description: '' })
      fetchData()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to submit request', variant: 'destructive' })
    } finally {
      setSubmittingRequest(false)
    }
  }

  // ── Month name helper ──
  const monthName = (m: number) => ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m] || ''

  const initials = employee ? `${employee.firstName[0] || ''}${employee.lastName[0] || ''}`.toUpperCase() : '??'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-slate-400">Loading self-service data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Employee Self-Service</h1>
        <p className="text-slate-400 mt-1">Access your information and raise requests</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-800 p-1 h-auto flex-wrap">
          <TabsTrigger value="profile" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">My Profile</TabsTrigger>
          <TabsTrigger value="leaves" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">My Leaves</TabsTrigger>
          <TabsTrigger value="payslips" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">My Payslips</TabsTrigger>
          <TabsTrigger value="attendance" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">My Attendance</TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">My Documents</TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Raise Request</TabsTrigger>
        </TabsList>

        {/* My Profile */}
        <TabsContent value="profile" className="mt-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              {employee ? (
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white">{employee.firstName} {employee.lastName}</h2>
                    <p className="text-emerald-400 mt-1">{employee.designation?.name || 'N/A'}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                      <div><p className="text-xs text-slate-500">Employee ID</p><p className="text-sm text-white">{employee.employeeCode}</p></div>
                      <div><p className="text-xs text-slate-500">Department</p><p className="text-sm text-white">{employee.department?.name || 'N/A'}</p></div>
                      <div><p className="text-xs text-slate-500">Location</p><p className="text-sm text-white">{employee.branch?.city || employee.city || 'N/A'}</p></div>
                      <div><p className="text-xs text-slate-500">Date of Joining</p><p className="text-sm text-white">{employee.joiningDate ? fmtDate(employee.joiningDate) : 'N/A'}</p></div>
                      <div><p className="text-xs text-slate-500">Email</p><p className="text-sm text-white">{employee.email}</p></div>
                      <div><p className="text-xs text-slate-500">Phone</p><p className="text-sm text-white">{employee.phone || 'N/A'}</p></div>
                      <div><p className="text-xs text-slate-500">Company</p><p className="text-sm text-white">{employee.company?.name || 'N/A'}</p></div>
                      <div><p className="text-xs text-slate-500">Status</p><Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{fmtStatus(employee.status)}</Badge></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <User className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p>No employee record found for your account.</p>
                  <p className="text-xs text-slate-500 mt-1">Please contact HR to link your employee profile.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Leaves */}
        <TabsContent value="leaves" className="mt-4">
          <div className="flex justify-end mb-4">
            <Dialog open={leaveDialog} onOpenChange={setLeaveDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  <Plus className="w-4 h-4" /> Apply Leave
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-white">Apply for Leave</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Leave Type</Label>
                    <Select value={leaveForm.leaveTypeId} onValueChange={v => setLeaveForm(p => ({ ...p, leaveTypeId: v }))}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="Select leave type" /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {leaveTypes.map(lt => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">From Date</Label>
                      <Input type="date" className="bg-slate-800 border-slate-700 text-white" value={leaveForm.startDate} onChange={e => setLeaveForm(p => ({ ...p, startDate: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">To Date</Label>
                      <Input type="date" className="bg-slate-800 border-slate-700 text-white" value={leaveForm.endDate} onChange={e => setLeaveForm(p => ({ ...p, endDate: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Reason</Label>
                    <Textarea className="bg-slate-800 border-slate-700 text-white min-h-[80px]" placeholder="Reason for leave..." value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline" className="border-slate-700 text-slate-300">Cancel</Button></DialogClose>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSubmitLeave} disabled={submittingLeave}>
                    {submittingLeave && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Submit Application
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {leaveBalance.map(lb => (
              <Card key={lb.type} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500 mb-2">{lb.type}</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white">{lb.balance}</span>
                    <span className="text-sm text-slate-500 mb-0.5">/ {lb.total}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
                    <div className={`h-full ${lb.color} rounded-full`} style={{ width: `${lb.total > 0 ? (lb.used / lb.total) * 100 : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{lb.used} used</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Recent Applications</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Type</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">From</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">To</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Days</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Reason</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLeaves.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-500">No leave applications found</td></tr>
                    ) : myLeaves.map(l => (
                      <tr key={l.id} className="border-b border-slate-800/50">
                        <td className="p-4 text-sm text-white">{l.leaveType?.name || 'Unknown'}</td>
                        <td className="p-4 text-sm text-slate-300">{fmtDate(l.startDate)}</td>
                        <td className="p-4 text-sm text-slate-300">{fmtDate(l.endDate)}</td>
                        <td className="p-4 text-sm text-slate-300">{l.totalDays}</td>
                        <td className="p-4 text-sm text-slate-400">{l.reason || '-'}</td>
                        <td className="p-4"><Badge variant="outline" className={leaveStatusColor[l.status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>{fmtStatus(l.status)}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Payslips */}
        <TabsContent value="payslips" className="mt-4">
          <div className="space-y-3">
            {myPayslips.length === 0 ? (
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-8 text-center text-slate-500">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p>No payslip data available.</p>
                  <p className="text-xs text-slate-500 mt-1">Payslips will appear after payroll is processed.</p>
                </CardContent>
              </Card>
            ) : myPayslips.map(ps => (
              <Card key={ps.id} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{monthName((ps as any).runMonth || 0)} {(ps as any).runYear || ''}</h3>
                        <p className="text-xs text-slate-500">Paid on: {(ps as any).runProcessedDate ? fmtDate((ps as any).runProcessedDate) : '-'}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">Gross</p>
                        <p className="text-sm text-white font-medium">{fmtCurrency(ps.grossEarnings)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">Deductions</p>
                        <p className="text-sm text-red-400 font-medium">{fmtCurrency(ps.totalDeductions)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">Net Pay</p>
                        <p className="text-sm text-emerald-400 font-bold">{fmtCurrency(ps.netPay)}</p>
                      </div>
                      <Button variant="outline" size="sm" className="text-emerald-400 border-slate-700 hover:text-emerald-300 text-xs h-7">
                        <Download className="w-3 h-3 mr-1" />Download
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* My Attendance */}
        <TabsContent value="attendance" className="mt-4">
          <div className="flex justify-end mb-4">
            <Dialog open={attendanceDialog} onOpenChange={setAttendanceDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  <Clock className="w-4 h-4" /> Mark Attendance
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-white">Mark Attendance</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Date</Label>
                    <Input type="date" className="bg-slate-800 border-slate-700 text-white" value={attendanceForm.date} onChange={e => setAttendanceForm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Punch In</Label>
                      <Input type="time" className="bg-slate-800 border-slate-700 text-white" value={attendanceForm.punchIn} onChange={e => setAttendanceForm(p => ({ ...p, punchIn: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Punch Out</Label>
                      <Input type="time" className="bg-slate-800 border-slate-700 text-white" value={attendanceForm.punchOut} onChange={e => setAttendanceForm(p => ({ ...p, punchOut: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Status</Label>
                    <Select value={attendanceForm.status} onValueChange={v => setAttendanceForm(p => ({ ...p, status: v }))}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="wfh">Work From Home</SelectItem>
                        <SelectItem value="half_day">Half Day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline" className="border-slate-700 text-slate-300">Cancel</Button></DialogClose>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleMarkAttendance} disabled={submittingAttendance}>
                    {submittingAttendance && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Mark Attendance
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Total Records', value: attendanceStats.total, color: 'text-white' },
              { label: 'Present', value: attendanceStats.present, color: 'text-emerald-400' },
              { label: 'Late', value: attendanceStats.late, color: 'text-amber-400' },
              { label: 'Half Day', value: attendanceStats.halfDay, color: 'text-cyan-400' },
              { label: 'Absent', value: attendanceStats.absent, color: 'text-red-400' },
            ].map(s => (
              <Card key={s.label} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Recent Logs</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Date</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Status</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Check In</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Check Out</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-500">No attendance records found</td></tr>
                    ) : attendanceRecords.slice(0, 20).map(a => (
                      <tr key={a.id} className="border-b border-slate-800/50">
                        <td className="p-4 text-sm text-white">{fmtDate(a.date)}</td>
                        <td className="p-4">
                          <Badge variant="outline" className={
                            a.status === 'present' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            a.status === 'absent' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            a.status === 'wfh' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                            a.status === 'half_day' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          }>
                            {a.lateMark ? 'Late' : fmtStatus(a.status)}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-slate-300">{a.firstPunchIn ? new Date(a.firstPunchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="p-4 text-sm text-slate-300">{a.lastPunchOut ? new Date(a.lastPunchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="p-4 text-sm text-slate-300">{a.workedHours > 0 ? `${a.workedHours.toFixed(1)}h` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Documents */}
        <TabsContent value="documents" className="mt-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Document</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Type</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Uploaded</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Status</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employee ? (
                      <>
                        {employee.panNumber && (
                          <tr className="border-b border-slate-800/50">
                            <td className="p-4 text-sm text-white">PAN Card</td>
                            <td className="p-4 text-sm text-slate-300">Identity</td>
                            <td className="p-4 text-sm text-slate-400">{employee.joiningDate ? fmtDate(employee.joiningDate) : '-'}</td>
                            <td className="p-4"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Verified</Badge></td>
                            <td className="p-4"><Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 text-xs h-7"><Download className="w-3 h-3 mr-1" />Download</Button></td>
                          </tr>
                        )}
                        {employee.bankName && (
                          <tr className="border-b border-slate-800/50">
                            <td className="p-4 text-sm text-white">Bank Details - {employee.bankName}</td>
                            <td className="p-4 text-sm text-slate-300">Financial</td>
                            <td className="p-4 text-sm text-slate-400">{employee.joiningDate ? fmtDate(employee.joiningDate) : '-'}</td>
                            <td className="p-4"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Verified</Badge></td>
                            <td className="p-4"><Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 text-xs h-7"><Download className="w-3 h-3 mr-1" />Download</Button></td>
                          </tr>
                        )}
                        {employee.address && (
                          <tr className="border-b border-slate-800/50">
                            <td className="p-4 text-sm text-white">Address Proof</td>
                            <td className="p-4 text-sm text-slate-300">Identity</td>
                            <td className="p-4 text-sm text-slate-400">{employee.joiningDate ? fmtDate(employee.joiningDate) : '-'}</td>
                            <td className="p-4"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Verified</Badge></td>
                            <td className="p-4"><Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 text-xs h-7"><Download className="w-3 h-3 mr-1" />Download</Button></td>
                          </tr>
                        )}
                        <tr className="border-b border-slate-800/50">
                          <td className="p-4 text-sm text-white">Offer Letter</td>
                          <td className="p-4 text-sm text-slate-300">Employment</td>
                          <td className="p-4 text-sm text-slate-400">{employee.joiningDate ? fmtDate(employee.joiningDate) : '-'}</td>
                          <td className="p-4"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Verified</Badge></td>
                          <td className="p-4"><Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 text-xs h-7"><Download className="w-3 h-3 mr-1" />Download</Button></td>
                        </tr>
                        <tr className="border-b border-slate-800/50">
                          <td className="p-4 text-sm text-white">ID Proof</td>
                          <td className="p-4 text-sm text-slate-300">Identity</td>
                          <td className="p-4 text-sm text-slate-400">{employee.joiningDate ? fmtDate(employee.joiningDate) : '-'}</td>
                          <td className="p-4"><Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">Pending</Badge></td>
                          <td className="p-4"><Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 text-xs h-7"><Download className="w-3 h-3 mr-1" />Download</Button></td>
                        </tr>
                      </>
                    ) : (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-500">No documents found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Raise Request */}
        <TabsContent value="requests" className="mt-4">
          <div className="flex justify-end mb-4">
            <Dialog open={requestDialog} onOpenChange={setRequestDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  <Plus className="w-4 h-4" /> Raise Request
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-white">Raise New Request</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Category</Label>
                      <Select value={requestForm.category} onValueChange={v => setRequestForm(p => ({ ...p, category: v }))}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700"><SelectItem value="hr">HR</SelectItem><SelectItem value="it">IT</SelectItem><SelectItem value="admin">Admin</SelectItem><SelectItem value="finance">Finance</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Priority</Label>
                      <Select value={requestForm.priority} onValueChange={v => setRequestForm(p => ({ ...p, priority: v }))}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700"><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Subject</Label>
                    <Input className="bg-slate-800 border-slate-700 text-white" placeholder="Brief description" value={requestForm.subject} onChange={e => setRequestForm(p => ({ ...p, subject: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Description</Label>
                    <Textarea className="bg-slate-800 border-slate-700 text-white min-h-[80px]" placeholder="Describe your request..." value={requestForm.description} onChange={e => setRequestForm(p => ({ ...p, description: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline" className="border-slate-700 text-slate-300">Cancel</Button></DialogClose>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSubmitRequest} disabled={submittingRequest}>
                    {submittingRequest && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Submit Request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left text-xs font-medium text-slate-400 p-4">ID</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Category</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Subject</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Date</th>
                      <th className="text-left text-xs font-medium text-slate-400 p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-500">No requests found</td></tr>
                    ) : tickets.map(r => (
                      <tr key={r.id} className="border-b border-slate-800/50">
                        <td className="p-4 text-sm text-emerald-400 font-mono">{r.id.slice(-6).toUpperCase()}</td>
                        <td className="p-4"><Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">{fmtStatus(r.category)}</Badge></td>
                        <td className="p-4 text-sm text-white">{r.subject}</td>
                        <td className="p-4 text-sm text-slate-400">{fmtDate(r.createdAt)}</td>
                        <td className="p-4"><Badge variant="outline" className={reqStatusColor[r.status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>{fmtStatus(r.status)}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
