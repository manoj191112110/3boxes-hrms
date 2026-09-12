'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, UserPlus, Search, Eye, Edit, Trash2, ArrowRightLeft, TrendingUp, FileText, Building2, ChevronRight, Mail, Phone, MapPin, Plus, Loader2, AlertCircle } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { useHRMSStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

// Interfaces
interface EmployeeData {
  id: string
  companyId: string
  branchId?: string | null
  departmentId?: string | null
  designationId?: string | null
  gradeId?: string | null
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  gender?: string | null
  dateOfBirth?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  employmentType: string
  status: string
  joiningDate?: string | null
  salary: number
  reportingManagerId?: string | null
  bankName?: string | null
  bankAccount?: string | null
  panNumber?: string | null
  createdAt: string
  department?: { id: string; name: string } | null
  designation?: { id: string; name: string } | null
  branch?: { id: string; name: string; city?: string } | null
  company?: { name: string; code: string } | null
}

interface EmployeeDocument {
  id: string
  name: string
  type: string
  status: string
  createdAt: string
}

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatStatus = (status: string) => {
  const map: Record<string, string> = {
    'active': 'Active', 'inactive': 'Inactive', 'onboarding': 'Onboarding',
    'exited': 'Exited', 'on_leave': 'On Leave', 'probation': 'Probation',
  }
  return map[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function OrgNode({ node, depth = 0 }: { node: { name: string; children?: any[] }; depth?: number }) {
  const isTop = depth === 0
  const isSecond = depth === 1
  return (
    <div className="flex flex-col items-center">
      <div className={`px-4 py-2 rounded-lg border text-sm font-medium ${isTop ? 'bg-emerald-600/20 border-emerald-600/30 text-emerald-400' : isSecond ? 'bg-teal-600/20 border-teal-600/30 text-teal-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
        {node.name}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="flex flex-col items-center mt-1">
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex gap-4 flex-wrap justify-center">
            {node.children.map((child: any, i: number) => (
              <div key={i} className="flex flex-col items-center">
                {i === 0 && <div className="w-px h-3 bg-slate-700" />}
                <OrgNode node={child} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function EmployeeManagement() {
  const { data: session } = useSession()
  const { currentCompanyId } = useHRMSStore()
  const { toast } = useToast()
  const companyId = currentCompanyId || (session?.user as any)?.companyId

  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewEmployee, setViewEmployee] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [addFormTab, setAddFormTab] = useState('personal')
  const pageSize = 10

  // Data state
  const [employees, setEmployees] = useState<EmployeeData[]>([])
  const [totalEmployees, setTotalEmployees] = useState(0)

  // Form state
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '',
    gender: '', companyId: '', departmentId: '', designation: '',
    joiningDate: '', salary: '', reportingManager: '', branch: '',
    bankName: '', bankAccount: '', ifscCode: '', panNumber: '',
    taxRegime: '', aadhaarNumber: '',
  })

  const fetchData = useCallback(async () => {
    if (!companyId) return
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<{ employees: EmployeeData[]; total: number }>(
        '/employees', { companyId, limit: '100' }
      )
      setEmployees(data.employees || [])
      setTotalEmployees(data.total || 0)
    } catch (err: any) {
      setError(err.message || 'Failed to load employee data')
      toast({ title: 'Error', description: 'Failed to load employee data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [companyId, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const depts = [...new Set(employees.map(e => e.department?.name).filter(Boolean))]
  const statuses = [...new Set(employees.map(e => e.status))]

  const filtered = employees.filter(e => {
    const name = `${e.firstName} ${e.lastName}`
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase()) || e.employeeCode.toLowerCase().includes(search.toLowerCase())
    const matchDept = filterDept === 'all' || e.department?.name === filterDept
    const matchStatus = filterStatus === 'all' || e.status === filterStatus
    return matchSearch && matchDept && matchStatus
  })

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-600/20 text-emerald-400'
      case 'on_leave': return 'bg-amber-600/20 text-amber-400'
      case 'probation': return 'bg-green-600/20 text-green-400'
      case 'inactive': return 'bg-slate-600/20 text-slate-400'
      case 'exited': return 'bg-red-600/20 text-red-400'
      case 'onboarding': return 'bg-teal-600/20 text-teal-400'
      default: return 'bg-slate-600/20 text-slate-400'
    }
  }

  // Build org chart from employees
  const buildOrgChart = () => {
    // Group by department
    const deptGroups: Record<string, EmployeeData[]> = {}
    employees.filter(e => e.status === 'active' && e.department).forEach(e => {
      const dept = e.department!.name
      if (!deptGroups[dept]) deptGroups[dept] = []
      deptGroups[dept].push(e)
    })
    const children = Object.entries(deptGroups).map(([dept, emps]) => ({
      name: dept,
      children: emps.slice(0, 5).map(e => ({
        name: `${e.firstName} ${e.lastName} (${e.designation?.name || e.employeeCode})`
      }))
    }))
    return { name: 'CEO', children }
  }

  // Derived stats
  const activeCount = employees.filter(e => e.status === 'active').length
  const onLeaveCount = employees.filter(e => e.status === 'on_leave').length
  const probationCount = employees.filter(e => e.status === 'probation').length

  // Group employees by manager for detail view
  const employeeMap: Record<string, string> = {}
  employees.forEach(e => { employeeMap[e.id] = `${e.firstName} ${e.lastName}` })

  const handleCreateEmployee = async () => {
    if (!form.firstName || !form.lastName || !form.email || !companyId) {
      toast({ title: 'Validation Error', description: 'First name, last name, email are required', variant: 'destructive' })
      return
    }
    try {
      setCreating(true)
      const employeeData: any = {
        companyId,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || null,
        gender: form.gender || null,
        dateOfBirth: form.dateOfBirth || null,
        departmentId: form.departmentId || null,
        salary: parseFloat(form.salary) || 0,
        joiningDate: form.joiningDate || null,
        employmentType: 'full-time',
        status: 'active',
        bankName: form.bankName || null,
        bankAccount: form.bankAccount || null,
        panNumber: form.panNumber || null,
      }

      // Generate employee code
      const companyPrefix = employees.length > 0 ? employees[0].employeeCode.replace(/\d+$/, '') : 'EMP'
      const nextNum = employees.length + 1
      employeeData.employeeCode = `${companyPrefix}${String(nextNum).padStart(4, '0')}`

      await apiPost('/employees', employeeData)
      toast({ title: 'Employee Created', description: `${form.firstName} ${form.lastName} has been added` })
      setForm({
        firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '',
        gender: '', companyId: '', departmentId: '', designation: '',
        joiningDate: '', salary: '', reportingManager: '', branch: '',
        bankName: '', bankAccount: '', ifscCode: '', panNumber: '',
        taxRegime: '', aadhaarNumber: '',
      })
      setAddFormTab('personal')
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create employee', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteEmployee = async (id: string) => {
    try {
      await apiDelete(`/employees?id=${id}`)
      toast({ title: 'Employee Deleted', description: 'Employee has been removed' })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete employee', variant: 'destructive' })
    }
  }

  const handleResetForm = () => {
    setForm({
      firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '',
      gender: '', companyId: '', departmentId: '', designation: '',
      joiningDate: '', salary: '', reportingManager: '', branch: '',
      bankName: '', bankAccount: '', ifscCode: '', panNumber: '',
      taxRegime: '', aadhaarNumber: '',
    })
    setAddFormTab('personal')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="ml-3 text-slate-400">Loading employee data...</span>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users className="w-6 h-6 text-emerald-400" /> Employee Management</h1>
          <p className="text-slate-400 mt-1">Manage employee directory, org structure, and HR operations</p>
        </div>
      </div>

      <Tabs defaultValue="directory">
        <TabsList className="bg-slate-900 border border-slate-700 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="directory" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Directory</TabsTrigger>
          <TabsTrigger value="add" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Add Employee</TabsTrigger>
          <TabsTrigger value="orgchart" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Org Chart</TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="directory">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
            <Card className="bg-slate-900 border-slate-800"><CardContent className="p-4"><p className="text-sm text-slate-400">Total Employees</p><p className="text-2xl font-bold text-white">{employees.length}</p></CardContent></Card>
            <Card className="bg-slate-900 border-slate-800"><CardContent className="p-4"><p className="text-sm text-slate-400">Active</p><p className="text-2xl font-bold text-emerald-400">{activeCount}</p></CardContent></Card>
            <Card className="bg-slate-900 border-slate-800"><CardContent className="p-4"><p className="text-sm text-slate-400">On Leave</p><p className="text-2xl font-bold text-amber-400">{onLeaveCount}</p></CardContent></Card>
            <Card className="bg-slate-900 border-slate-800"><CardContent className="p-4"><p className="text-sm text-slate-400">On Probation</p><p className="text-2xl font-bold text-green-400">{probationCount}</p></CardContent></Card>
          </div>

          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input placeholder="Search by name, email, code..." className="pl-9 bg-slate-900 border-slate-700 text-slate-300" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} />
            </div>
            <Select value={filterDept} onValueChange={v => { setFilterDept(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-44 bg-slate-900 border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700"><SelectItem value="all" className="text-slate-300">All Departments</SelectItem>{depts.map(d => <SelectItem key={d} value={d!} className="text-slate-300">{d}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-36 bg-slate-900 border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700"><SelectItem value="all" className="text-slate-300">All Status</SelectItem>{statuses.map(s => <SelectItem key={s} value={s} className="text-slate-300">{formatStatus(s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <Card className="bg-slate-900 border-slate-800 mt-4">
            <CardContent className="p-0">
              {paginated.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Users className="w-12 h-12 mb-3 opacity-50" />
                  <p>No employees found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Code</TableHead><TableHead className="text-slate-400">Name</TableHead><TableHead className="text-slate-400">Email</TableHead>
                    <TableHead className="text-slate-400">Department</TableHead><TableHead className="text-slate-400">Designation</TableHead><TableHead className="text-slate-400">Joining</TableHead><TableHead className="text-slate-400">Salary</TableHead><TableHead className="text-slate-400">Status</TableHead><TableHead className="text-slate-400">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {paginated.map(e => (
                      <TableRow key={e.id} className="border-slate-800 hover:bg-slate-800/50">
                        <TableCell className="text-slate-400 font-mono text-sm">{e.employeeCode}</TableCell>
                        <TableCell className="text-white font-medium">{e.firstName} {e.lastName}</TableCell>
                        <TableCell className="text-slate-400 text-sm">{e.email}</TableCell>
                        <TableCell className="text-slate-300">{e.department?.name || '—'}</TableCell>
                        <TableCell className="text-slate-300">{e.designation?.name || '—'}</TableCell>
                        <TableCell className="text-slate-400 text-sm">{formatDate(e.joiningDate)}</TableCell>
                        <TableCell className="text-emerald-400 font-medium">₹{(e.salary / 100000).toFixed(1)}L</TableCell>
                        <TableCell><Badge className={statusColor(e.status)}>{formatStatus(e.status)}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setViewEmployee(e)}><Eye className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400" onClick={() => handleDeleteEmployee(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-400">Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="border-slate-700 text-slate-300" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <Button key={i} variant={currentPage === i + 1 ? 'default' : 'outline'} size="sm"
                    className={currentPage === i + 1 ? 'bg-emerald-600 text-white' : 'border-slate-700 text-slate-300'}
                    onClick={() => setCurrentPage(i + 1)}>{i + 1}</Button>
                ))}
                <Button variant="outline" size="sm" className="border-slate-700 text-slate-300" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="add">
          <Card className="bg-slate-900 border-slate-800 mt-4">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" /> Add New Employee
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Horizontal Section Tabs */}
              <div className="flex items-center gap-1 border-b border-slate-700 mb-6 overflow-x-auto">
                {[
                  { key: 'personal', label: 'Personal Info', icon: '👤' },
                  { key: 'employment', label: 'Employment', icon: '💼' },
                  { key: 'bank', label: 'Bank Details', icon: '🏦' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setAddFormTab(tab.key)}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      addFormTab === tab.key
                        ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Personal Information Section */}
              {addFormTab === 'personal' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><Label className="text-slate-300">First Name *</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Enter first name" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
                    <div><Label className="text-slate-300">Last Name *</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Enter last name" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
                    <div><Label className="text-slate-300">Email *</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" type="email" placeholder="firstname.lastname@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                    <div><Label className="text-slate-300">Phone</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                    <div><Label className="text-slate-300">Date of Birth</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} /></div>
                    <div><Label className="text-slate-300">Gender</Label>
                      <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="male" className="text-slate-300">Male</SelectItem>
                          <SelectItem value="female" className="text-slate-300">Female</SelectItem>
                          <SelectItem value="other" className="text-slate-300">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6" onClick={() => setAddFormTab('employment')}>
                      Next: Employment <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Employment Details Section */}
              {addFormTab === 'employment' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><Label className="text-slate-300">Employee Code</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Auto-generated" disabled /></div>
                    <div><Label className="text-slate-300">Department</Label>
                      <Select value={form.departmentId} onValueChange={v => setForm(f => ({ ...f, departmentId: v }))}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {employees.filter(e => e.department).reduce((acc: { id: string; name: string }[], e) => {
                            if (e.department && !acc.find(d => d.id === e.department!.id)) acc.push({ id: e.department!.id, name: e.department!.name })
                            return acc
                          }, []).map(d => <SelectItem key={d.id} value={d.id} className="text-slate-300">{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-slate-300">Designation</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Enter designation" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} /></div>
                    <div><Label className="text-slate-300">Joining Date</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" type="date" value={form.joiningDate} onChange={e => setForm(f => ({ ...f, joiningDate: e.target.value }))} /></div>
                    <div><Label className="text-slate-300">Salary (Annual INR)</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" type="number" placeholder="Enter annual salary" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} /></div>
                    <div><Label className="text-slate-300">Reporting Manager</Label>
                      <Select value={form.reportingManager} onValueChange={v => setForm(f => ({ ...f, reportingManager: v }))}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue placeholder="Select manager" /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {employees.filter(e => e.status === 'active').map(e => (
                            <SelectItem key={e.id} value={e.id} className="text-slate-300">{e.firstName} {e.lastName} ({e.employeeCode})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 px-6" onClick={() => setAddFormTab('personal')}>
                      Back
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6" onClick={() => setAddFormTab('bank')}>
                      Next: Bank Details <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Bank Details Section */}
              {addFormTab === 'bank' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><Label className="text-slate-300">Bank Name</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Enter bank name" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} /></div>
                    <div><Label className="text-slate-300">Account Number</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Enter account number" value={form.bankAccount} onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} /></div>
                    <div><Label className="text-slate-300">IFSC Code</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Enter IFSC code" value={form.ifscCode} onChange={e => setForm(f => ({ ...f, ifscCode: e.target.value }))} /></div>
                    <div><Label className="text-slate-300">PAN Number</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Enter PAN number" value={form.panNumber} onChange={e => setForm(f => ({ ...f, panNumber: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 px-6" onClick={() => setAddFormTab('employment')}>
                      Back
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-8" onClick={handleCreateEmployee} disabled={creating}>
                      {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : 'Create Employee'}
                    </Button>
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 px-8" onClick={handleResetForm}>Reset</Button>
                  </div>
                </div>
              )}

              {/* Progress indicator */}
              <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800">
                <div className={`h-1.5 flex-1 rounded-full transition-colors ${addFormTab === 'personal' || addFormTab === 'employment' || addFormTab === 'bank' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                <div className={`h-1.5 flex-1 rounded-full transition-colors ${addFormTab === 'employment' || addFormTab === 'bank' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                <div className={`h-1.5 flex-1 rounded-full transition-colors ${addFormTab === 'bank' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                <span className="text-xs text-slate-500 ml-2">
                  Step {addFormTab === 'personal' ? '1' : addFormTab === 'employment' ? '2' : '3'} of 3
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orgchart">
          <Card className="bg-slate-900 border-slate-800 mt-4">
            <CardHeader><CardTitle className="text-white text-lg flex items-center gap-2"><Building2 className="w-5 h-5 text-emerald-400" /> Organization Chart</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {employees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Building2 className="w-12 h-12 mb-3 opacity-50" />
                  <p>No employees to build org chart</p>
                </div>
              ) : (
                <div className="min-w-[800px] flex justify-center py-4">
                  <OrgNode node={buildOrgChart()} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <div className="flex items-center justify-between mt-4">
            <h3 className="text-white font-semibold flex items-center gap-2"><FileText className="w-5 h-5 text-emerald-400" /> Employee Documents</h3>
          </div>
          <Card className="bg-slate-900 border-slate-800 mt-3">
            <CardContent className="p-0">
              {employees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mb-3 opacity-50" />
                  <p>No employee documents found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Employee</TableHead><TableHead className="text-slate-400">Code</TableHead><TableHead className="text-slate-400">Department</TableHead><TableHead className="text-slate-400">Joining Date</TableHead><TableHead className="text-slate-400">Status</TableHead><TableHead className="text-slate-400">PAN</TableHead><TableHead className="text-slate-400">Bank</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {employees.filter(e => e.panNumber || e.bankName).map(e => (
                      <TableRow key={e.id} className="border-slate-800 hover:bg-slate-800/50">
                        <TableCell className="text-white font-medium">{e.firstName} {e.lastName}</TableCell>
                        <TableCell className="text-slate-400 font-mono text-sm">{e.employeeCode}</TableCell>
                        <TableCell className="text-slate-300">{e.department?.name || '—'}</TableCell>
                        <TableCell className="text-slate-400 text-sm">{formatDate(e.joiningDate)}</TableCell>
                        <TableCell><Badge className={statusColor(e.status)}>{formatStatus(e.status)}</Badge></TableCell>
                        <TableCell className="text-slate-300 text-sm">{e.panNumber ? <Badge className="bg-emerald-600/20 text-emerald-400">Verified</Badge> : <Badge className="bg-amber-600/20 text-amber-400">Pending</Badge>}</TableCell>
                        <TableCell className="text-slate-300 text-sm">{e.bankName || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {employees.filter(e => e.panNumber || e.bankName).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-500 py-8">No documents on file yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewEmployee} onOpenChange={() => setViewEmployee(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader><DialogTitle className="text-white">Employee Details</DialogTitle></DialogHeader>
          {viewEmployee && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg font-bold">
                  {viewEmployee.firstName?.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-semibold text-lg">{viewEmployee.firstName} {viewEmployee.lastName}</p>
                  <p className="text-slate-400 text-sm">{viewEmployee.employeeCode}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-500" /><span className="text-slate-300 text-sm">{viewEmployee.email}</span></div>
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-500" /><span className="text-slate-300 text-sm">{viewEmployee.phone || '—'}</span></div>
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-500" /><span className="text-slate-300 text-sm">{viewEmployee.city || viewEmployee.branch?.city || '—'}</span></div>
                <div><Badge className={statusColor(viewEmployee.status)}>{formatStatus(viewEmployee.status)}</Badge></div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-slate-500">Department</p><p className="text-white">{viewEmployee.department?.name || '—'}</p></div>
                <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-slate-500">Designation</p><p className="text-white">{viewEmployee.designation?.name || '—'}</p></div>
                <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-slate-500">Joining Date</p><p className="text-white">{formatDate(viewEmployee.joiningDate)}</p></div>
                <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-slate-500">Salary</p><p className="text-emerald-400 font-semibold">₹{(viewEmployee.salary / 100000).toFixed(1)}L</p></div>
                <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-slate-500">Manager</p><p className="text-white">{viewEmployee.reportingManagerId ? employeeMap[viewEmployee.reportingManagerId] || '—' : '—'}</p></div>
                <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-slate-500">Branch</p><p className="text-white">{viewEmployee.branch?.name || '—'}</p></div>
                <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-slate-500">Bank</p><p className="text-white">{viewEmployee.bankName || '—'}</p></div>
                <div className="p-3 bg-slate-800/50 rounded-lg"><p className="text-slate-500">PAN</p><p className="text-white">{viewEmployee.panNumber || '—'}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
