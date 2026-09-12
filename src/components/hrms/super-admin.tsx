'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Shield, Building2, Users, CreditCard, Activity, Server, Zap, TrendingUp, CheckCircle2, Search, Plus, Eye, Edit, Trash2, BarChart3, Cpu, Loader2, LogIn, Clock, XCircle, Timer } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/store/authStore'

interface CompanyData {
  id: string
  tenantId: string
  code: string
  name: string
  status: string
  country: string
  createdAt: string
  _count: { employees: number }
  branches: { id: string; name: string; status: string }[]
  departments: { id: string; name: string; status: string }[]
}

const packages = [
  { name: 'Starter', price: '₹29,000/mo', employees: '50', companies: '1', credits: '1,000', features: ['Basic HRMS', 'Employee Management', 'Leave & Attendance', 'Email Support', '5 GB Storage'], status: 'Active', popular: false },
  { name: 'Professional', price: '₹79,000/mo', employees: '200', companies: '3', credits: '5,000', features: ['All Starter features', 'Recruitment & Onboarding', 'AI Interview (Basic)', 'Payroll Management', 'Priority Support', '25 GB Storage'], status: 'Active', popular: true },
  { name: 'Enterprise', price: '₹1,99,000/mo', employees: '1,000', companies: '10', credits: '15,000', features: ['All Professional features', 'AI Interview (Advanced)', 'Custom Workflows', 'Dedicated Account Manager', 'API Access', 'Unlimited Storage'], status: 'Active', popular: false },
]

export default function SuperAdmin() {
  const { toast } = useToast()
  const [tenantSearch, setTenantSearch] = useState('')
  const [subSearch, setSubSearch] = useState('')
  const [addTenantOpen, setAddTenantOpen] = useState(false)
  const [companies, setCompanies] = useState<CompanyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add tenant form state
  const [newTenant, setNewTenant] = useState({
    name: '',
    code: '',
    type: 'single',
    plan: 'starter',
    adminEmail: '',
    adminName: '',
  })
  const [creating, setCreating] = useState(false)

  // Trial stats state
  const [trialStats, setTrialStats] = useState<{
    activeTrials: number
    evaluatingCompanies: number
    onboardedCompanies: number
    notOnboarded: number
    registrations: Array<{
      id: string
      companyName: string
      companyCode: string
      companyEmail: string
      contactName: string
      contactEmail: string
      contactPhone: string | null
      status: string
      trialDays: number
      trialStart: string | null
      trialEnd: string | null
      tempPassword: string | null
      rejectionReason: string | null
      notes: string | null
      tenantId: string | null
      createdAt: string
      reviewedAt: string | null
      industry: string | null
      country: string
      currency: string
      employeeCount: number
      isExpired: boolean
      daysRemaining: number | null
    }>
  } | null>(null)
  const [trialLoading, setTrialLoading] = useState(false)
  const [trialActionLoading, setTrialActionLoading] = useState<string | null>(null)
  const [extendDays, setExtendDays] = useState<Record<string, number>>({})
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({})
  const [trialMessage, setTrialMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [switchingTenantId, setSwitchingTenantId] = useState<string | null>(null)

  const { user: authUser, setToken } = useAuthStore()

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<CompanyData[]>('/api/companies')
      setCompanies(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load companies')
      toast({ title: 'Error', description: 'Failed to load company data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  // Fetch trial stats
  const fetchTrialStats = useCallback(async () => {
    try {
      setTrialLoading(true)
      const data = await apiGet<typeof trialStats>('/api/super-admin/trial-stats')
      if (data) setTrialStats(data)
    } catch (err: any) {
      console.error('Failed to load trial stats:', err)
    } finally {
      setTrialLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrialStats()
  }, [fetchTrialStats])

  // Derived stats from real data
  const totalEmployees = companies.reduce((sum, c) => sum + (c._count?.employees || 0), 0)
  const totalBranches = companies.reduce((sum, c) => sum + (c.branches?.length || 0), 0)
  const totalDepartments = companies.reduce((sum, c) => sum + (c.departments?.length || 0), 0)
  const activeCompanies = companies.filter(c => c.status === 'active').length

  // Build tenant rows from real companies
  const tenants = companies.map(c => ({
    id: c.code,
    name: c.name,
    type: c.branches?.length > 1 ? 'Multi Branch' : 'Single Branch',
    status: c.status === 'active' ? 'Active' : 'Inactive',
    plan: 'Professional' as string,
    companies: 1,
    employees: c._count?.employees || 0,
    branches: c.branches?.length || 0,
    departments: c.departments?.length || 0,
    joined: new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    revenue: '₹79,000/mo',
  }))

  // Subscriptions derived from companies (simulated)
  const subscriptions = companies.map(c => ({
    tenant: c.name,
    plan: 'Professional',
    amount: '₹79,000',
    billing: 'Monthly',
    status: c.status === 'active' ? 'Active' : 'Suspended',
    nextBilling: 'Jul 1, 2026',
    usedCredits: Math.floor(Math.random() * 3000) + 1000,
    totalCredits: 5000,
  }))

  const platformStats = [
    { label: 'Total Tenants', value: String(companies.length), icon: Building2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Active Tenants', value: String(activeCompanies), icon: CheckCircle2, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { label: 'Total Employees', value: totalEmployees.toLocaleString(), icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'AI Credits Used', value: '12,450', icon: Zap, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { label: 'Active Trials', value: String(trialStats?.activeTrials ?? 0), icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Evaluating', value: String(trialStats?.evaluatingCompanies ?? 0), icon: Timer, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Onboarded', value: String(trialStats?.onboardedCompanies ?? 0), icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Not Onboarded', value: String(trialStats?.notOnboarded ?? 0), icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  ]

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
    t.id.toLowerCase().includes(tenantSearch.toLowerCase()) ||
    t.plan.toLowerCase().includes(tenantSearch.toLowerCase())
  )

  const filteredSubs = subscriptions.filter(s =>
    s.tenant.toLowerCase().includes(subSearch.toLowerCase()) ||
    s.plan.toLowerCase().includes(subSearch.toLowerCase())
  )

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.code || !newTenant.adminEmail) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields', variant: 'destructive' })
      return
    }
    try {
      setCreating(true)
      await apiPost('/api/companies', {
        tenantId: 'default',
        name: newTenant.name,
        code: newTenant.code.toLowerCase().replace(/\s+/g, '-'),
        country: 'India',
        status: 'active',
        adminName: newTenant.adminName,
        adminEmail: newTenant.adminEmail,
      })
      toast({ title: 'Tenant Created', description: `${newTenant.name} has been created successfully` })
      setAddTenantOpen(false)
      setNewTenant({ name: '', code: '', type: 'single', plan: 'starter', adminEmail: '', adminName: '' })
      fetchCompanies()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create tenant', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const analyticsData = [
    { label: 'Total Users', value: String(totalEmployees), change: '+12%', icon: Users, color: 'text-emerald-400' },
    { label: 'Active Sessions', value: '89', change: '+5%', icon: Activity, color: 'text-teal-400' },
    { label: 'API Calls (Today)', value: '24,567', change: '+18%', icon: Server, color: 'text-amber-400' },
    { label: 'AI Credits (Month)', value: '12,450 / 21,000', change: '59%', icon: Cpu, color: 'text-teal-400' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-400" /> Super Admin
          </h1>
          <p className="text-slate-400 mt-1">Platform management and subscription overview</p>
        </div>
        <Dialog open={addTenantOpen} onOpenChange={setAddTenantOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Add Tenant
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
            <DialogHeader><DialogTitle className="text-white">Add New Tenant</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-4">
              <div><Label className="text-slate-300">Organization Name *</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Enter organization name" value={newTenant.name} onChange={e => setNewTenant(p => ({ ...p, name: e.target.value, code: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} /></div>
              <div><Label className="text-slate-300">Company Code *</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="e.g. 3boxes-corp" value={newTenant.code} onChange={e => setNewTenant(p => ({ ...p, code: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-slate-300">Type</Label>
                  <Select value={newTenant.type} onValueChange={v => setNewTenant(p => ({ ...p, type: v }))}><SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="single" className="text-slate-300">Single Company</SelectItem>
                      <SelectItem value="multi" className="text-slate-300">Multi Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-slate-300">Plan</Label>
                  <Select value={newTenant.plan} onValueChange={v => setNewTenant(p => ({ ...p, plan: v }))}><SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1"><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {packages.map(p => <SelectItem key={p.name} value={p.name.toLowerCase()} className="text-slate-300">{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-slate-300">Admin Email *</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" type="email" placeholder="admin@company.com" value={newTenant.adminEmail} onChange={e => setNewTenant(p => ({ ...p, adminEmail: e.target.value }))} /></div>
              <div><Label className="text-slate-300">Admin Name</Label><Input className="bg-slate-800 border-slate-700 text-white mt-1" placeholder="Full name" value={newTenant.adminName} onChange={e => setNewTenant(p => ({ ...p, adminName: e.target.value }))} /></div>
              <div className="flex gap-3 pt-2">
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreateTenant} disabled={creating}>
                  {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : 'Create Tenant'}
                </Button>
                <Button variant="outline" className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setAddTenantOpen(false)}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="bg-slate-900 border border-slate-700 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Dashboard</TabsTrigger>
          <TabsTrigger value="trials" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Trials</TabsTrigger>
          <TabsTrigger value="tenants" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Tenants</TabsTrigger>
          <TabsTrigger value="subscriptions" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Subscriptions</TabsTrigger>
          <TabsTrigger value="packages" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Packages</TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Platform Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              <span className="ml-3 text-slate-400">Loading platform data...</span>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-red-400 mb-4">{error}</p>
              <Button variant="outline" onClick={fetchCompanies} className="border-slate-700 text-slate-300 hover:bg-slate-800">Retry</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {platformStats.map(s => (
                  <Card key={s.label} className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-400">{s.label}</p>
                          <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
                        </div>
                        <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                          <s.icon className={`w-5 h-5 ${s.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader><CardTitle className="text-white text-lg">Company Overview</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">Company</TableHead>
                        <TableHead className="text-slate-400">Employees</TableHead>
                        <TableHead className="text-slate-400">Branches</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {companies.slice(0, 5).map(c => (
                          <TableRow key={c.id} className="border-slate-800">
                            <TableCell className="text-white font-medium">{c.name}</TableCell>
                            <TableCell className="text-slate-300">{c._count?.employees || 0}</TableCell>
                            <TableCell className="text-slate-300">{c.branches?.length || 0}</TableCell>
                            <TableCell><Badge className={c.status === 'active' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'}>{c.status === 'active' ? 'Active' : 'Inactive'}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader><CardTitle className="text-white text-lg">Platform Stats</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                      <span className="text-slate-300">Total Companies</span>
                      <span className="text-emerald-400 font-bold text-lg">{companies.length}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                      <span className="text-slate-300">Total Employees</span>
                      <span className="text-amber-400 font-bold text-lg">{totalEmployees}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                      <span className="text-slate-300">Total Branches</span>
                      <span className="text-teal-400 font-bold text-lg">{totalBranches}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
                      <span className="text-slate-300">Total Departments</span>
                      <span className="text-slate-300 font-bold text-lg">{totalDepartments}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="trials">
          {/* Trial stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Active Trials</p>
                    <p className="text-2xl font-bold text-white mt-1">{trialStats?.activeTrials ?? 0}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-cyan-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Evaluating Companies</p>
                    <p className="text-2xl font-bold text-white mt-1">{trialStats?.evaluatingCompanies ?? 0}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <Timer className="w-5 h-5 text-yellow-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Onboarded Companies</p>
                    <p className="text-2xl font-bold text-white mt-1">{trialStats?.onboardedCompanies ?? 0}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Not Onboarded</p>
                    <p className="text-2xl font-bold text-white mt-1">{trialStats?.notOnboarded ?? 0}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trial message */}
          {trialMessage && (
            <div className={`mt-4 p-4 rounded-xl ${trialMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-950 dark:text-green-200' : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200'}`}>
              <pre className="whitespace-pre-wrap font-sans text-sm">{trialMessage.text}</pre>
            </div>
          )}

          {/* Trial registrations table */}
          <Card className="bg-slate-900 border-slate-800 mt-4">
            <CardHeader><CardTitle className="text-white text-lg flex items-center gap-2"><Zap className="w-5 h-5 text-cyan-400" /> Trial Registrations</CardTitle></CardHeader>
            <CardContent className="p-0">
              {trialLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                  <span className="ml-3 text-slate-400">Loading trials...</span>
                </div>
              ) : !trialStats?.registrations?.length ? (
                <div className="text-center py-12 text-slate-500">No trial registrations found.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Company</TableHead>
                    <TableHead className="text-slate-400">Contact</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Trial Days</TableHead>
                    <TableHead className="text-slate-400">Days Remaining</TableHead>
                    <TableHead className="text-slate-400">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {trialStats.registrations.map((reg) => {
                      let displayStatus = reg.status
                      if (reg.isExpired && ['approved', 'active'].includes(reg.status)) {
                        displayStatus = 'expired'
                      }
                      const statusColors: Record<string, string> = {
                        pending: 'bg-yellow-600/20 text-yellow-400',
                        approved: 'bg-green-600/20 text-green-400',
                        active: 'bg-cyan-600/20 text-cyan-400',
                        rejected: 'bg-red-600/20 text-red-400',
                        expired: 'bg-orange-600/20 text-orange-400',
                        suspended: 'bg-slate-600/20 text-slate-400',
                      }

                      return (
                        <TableRow key={reg.id} className="border-slate-800 hover:bg-slate-800/50">
                          <TableCell>
                            <div className="text-white font-medium">{reg.companyName}</div>
                            <div className="text-slate-500 text-xs">{reg.companyCode} · {reg.industry || 'N/A'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-slate-300 text-sm">{reg.contactName}</div>
                            <div className="text-slate-500 text-xs">{reg.contactEmail}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[displayStatus] || 'bg-slate-600/20 text-slate-400'}>
                              {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300">{reg.trialDays}</TableCell>
                          <TableCell>
                            {reg.isExpired ? (
                              <span className="text-red-400 text-sm font-medium">Expired</span>
                            ) : reg.daysRemaining !== null ? (
                              <span className="text-cyan-400 text-sm font-medium">{reg.daysRemaining}d</span>
                            ) : (
                              <span className="text-slate-500 text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              {reg.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                    disabled={trialActionLoading === reg.id}
                                    onClick={async () => {
                                      setTrialActionLoading(reg.id)
                                      setTrialMessage(null)
                                      try {
                                        const res = await fetch('/api/trial/approve', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ registrationId: reg.id, trialDays: 15, reviewedBy: authUser?.id }),
                                        })
                                        const data = await res.json()
                                        if (res.ok) {
                                          setTrialMessage({ type: 'success', text: `Approved! Login: ${data.loginEmail} | Password: ${data.tempPassword} | URL: ${data.loginUrl}` })
                                          fetchTrialStats()
                                        } else {
                                          setTrialMessage({ type: 'error', text: data.error || 'Approval failed' })
                                        }
                                      } catch {
                                        setTrialMessage({ type: 'error', text: 'Network error' })
                                      } finally {
                                        setTrialActionLoading(null)
                                      }
                                    }}
                                  >
                                    {trialActionLoading === reg.id ? '...' : 'Approve'}
                                  </Button>
                                  <div className="flex items-center gap-1">
                                    <Input
                                      placeholder="Reason"
                                      value={rejectionReason[reg.id] || ''}
                                      onChange={e => setRejectionReason(prev => ({ ...prev, [reg.id]: e.target.value }))}
                                      className="h-7 w-24 text-xs bg-slate-800 border-slate-700 text-slate-300"
                                    />
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                                      disabled={trialActionLoading === reg.id}
                                      onClick={async () => {
                                        setTrialActionLoading(reg.id)
                                        setTrialMessage(null)
                                        try {
                                          const res = await fetch('/api/trial/reject', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ registrationId: reg.id, rejectionReason: rejectionReason[reg.id] || 'Not specified', reviewedBy: authUser?.id }),
                                          })
                                          const data = await res.json()
                                          if (res.ok) {
                                            setTrialMessage({ type: 'success', text: 'Registration rejected.' })
                                            fetchTrialStats()
                                          } else {
                                            setTrialMessage({ type: 'error', text: data.error || 'Rejection failed' })
                                          }
                                        } catch {
                                          setTrialMessage({ type: 'error', text: 'Network error' })
                                        } finally {
                                          setTrialActionLoading(null)
                                        }
                                      }}
                                    >
                                      {trialActionLoading === reg.id ? '...' : 'Reject'}
                                    </Button>
                                  </div>
                                </>
                              )}
                              {['approved', 'active'].includes(reg.status) && (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={extendDays[reg.id] || 7}
                                    onChange={e => setExtendDays(prev => ({ ...prev, [reg.id]: parseInt(e.target.value) || 7 }))}
                                    className="h-7 w-14 text-xs text-center bg-slate-800 border-slate-700 text-slate-300"
                                  />
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
                                    disabled={trialActionLoading === `extend-${reg.id}`}
                                    onClick={async () => {
                                      const days = extendDays[reg.id] || 7
                                      setTrialActionLoading(`extend-${reg.id}`)
                                      setTrialMessage(null)
                                      try {
                                        const res = await fetch('/api/trial/extend', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ registrationId: reg.id, additionalDays: days }),
                                        })
                                        const data = await res.json()
                                        if (res.ok) {
                                          setTrialMessage({ type: 'success', text: `Trial extended by ${days} days. New end: ${new Date(data.newTrialEnd).toLocaleDateString()}` })
                                          fetchTrialStats()
                                        } else {
                                          setTrialMessage({ type: 'error', text: data.error || 'Extension failed' })
                                        }
                                      } catch {
                                        setTrialMessage({ type: 'error', text: 'Network error' })
                                      } finally {
                                        setTrialActionLoading(null)
                                      }
                                    }}
                                  >
                                    {trialActionLoading === `extend-${reg.id}` ? '...' : 'Extend'}
                                  </Button>
                                </div>
                              )}
                              {reg.status === 'rejected' && (
                                <span className="text-slate-500 text-xs">No actions</span>
                              )}
                              {reg.isExpired && ['approved', 'active'].includes(reg.status) && (
                                <span className="text-orange-400 text-xs">Expired</span>
                              )}
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

        <TabsContent value="tenants">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input placeholder="Search tenants..." className="pl-9 bg-slate-900 border-slate-700 text-slate-300" value={tenantSearch} onChange={e => setTenantSearch(e.target.value)} />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all" className="text-slate-300">All Status</SelectItem>
                <SelectItem value="active" className="text-slate-300">Active</SelectItem>
                <SelectItem value="suspended" className="text-slate-300">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              <span className="ml-3 text-slate-400">Loading tenants...</span>
            </div>
          ) : (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Company Code</TableHead>
                    <TableHead className="text-slate-400">Name</TableHead>
                    <TableHead className="text-slate-400">Type</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Plan</TableHead>
                    <TableHead className="text-slate-400">Employees</TableHead>
                    <TableHead className="text-slate-400">Branches</TableHead>
                    <TableHead className="text-slate-400">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filteredTenants.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">No tenants found</TableCell></TableRow>
                    ) : (
                      filteredTenants.map(t => (
                        <TableRow key={t.id} className="border-slate-800 hover:bg-slate-800/50">
                          <TableCell className="text-slate-400 font-mono text-sm">{t.id}</TableCell>
                          <TableCell className="text-white font-medium">{t.name}</TableCell>
                          <TableCell className="text-slate-300">{t.type}</TableCell>
                          <TableCell><Badge className={t.status === 'Active' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'}>{t.status}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className="border-teal-600/30 text-teal-400">{t.plan}</Badge></TableCell>
                          <TableCell className="text-slate-300">{t.employees}</TableCell>
                          <TableCell className="text-slate-300">{t.branches}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" title="View"><Eye className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" title="Edit"><Edit className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400" title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-cyan-400 hover:text-cyan-300"
                                title="Switch To Tenant"
                                disabled={switchingTenantId === c.tenantId}
                                onClick={async () => {
                                  setSwitchingTenantId(c.tenantId)
                                  try {
                                    const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null
                                    const res = await fetch('/api/auth/switch-tenant', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                      },
                                      body: JSON.stringify({ tenantId: c.tenantId }),
                                    })
                                    const data = await res.json()
                                    if (res.ok) {
                                      // Update auth store with new token and user
                                      if (typeof window !== 'undefined') {
                                        localStorage.setItem('tb_token', data.token)
                                      }
                                      setToken(data.token)
                                      useAuthStore.setState({
                                        token: data.token,
                                        user: data.user,
                                        isAuthenticated: true,
                                      })
                                      toast({ title: 'Tenant Switched', description: `Switched to ${data.user.tenant?.name || c.name}` })
                                      // Redirect to dashboard
                                      window.location.href = '/'
                                    } else {
                                      toast({ title: 'Error', description: data.error || 'Failed to switch tenant', variant: 'destructive' })
                                    }
                                  } catch (err: any) {
                                    toast({ title: 'Error', description: 'Network error while switching tenant', variant: 'destructive' })
                                  } finally {
                                    setSwitchingTenantId(null)
                                  }
                                }}
                              >
                                {switchingTenantId === c.tenantId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="subscriptions">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input placeholder="Search subscriptions..." className="pl-9 bg-slate-900 border-slate-700 text-slate-300" value={subSearch} onChange={e => setSubSearch(e.target.value)} />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-slate-300"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all" className="text-slate-300">All Plans</SelectItem>
                <SelectItem value="starter" className="text-slate-300">Starter</SelectItem>
                <SelectItem value="professional" className="text-slate-300">Professional</SelectItem>
                <SelectItem value="enterprise" className="text-slate-300">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              <span className="ml-3 text-slate-400">Loading subscriptions...</span>
            </div>
          ) : (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Tenant</TableHead>
                    <TableHead className="text-slate-400">Plan</TableHead>
                    <TableHead className="text-slate-400">Amount</TableHead>
                    <TableHead className="text-slate-400">Billing</TableHead>
                    <TableHead className="text-slate-400">AI Credits</TableHead>
                    <TableHead className="text-slate-400">Next Billing</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filteredSubs.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No subscriptions found</TableCell></TableRow>
                    ) : (
                      filteredSubs.map((s, i) => (
                        <TableRow key={i} className="border-slate-800 hover:bg-slate-800/50">
                          <TableCell className="text-white font-medium">{s.tenant}</TableCell>
                          <TableCell><Badge variant="outline" className="border-teal-600/30 text-teal-400">{s.plan}</Badge></TableCell>
                          <TableCell className="text-emerald-400 font-medium">{s.amount}</TableCell>
                          <TableCell className="text-slate-300">{s.billing}</TableCell>
                          <TableCell className="text-slate-300">{s.usedCredits.toLocaleString()} / {s.totalCredits.toLocaleString()}</TableCell>
                          <TableCell className="text-slate-400">{s.nextBilling}</TableCell>
                          <TableCell><Badge className={s.status === 'Active' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'}>{s.status}</Badge></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="packages">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            {packages.map(p => (
              <Card key={p.name} className={`bg-slate-900 border-slate-800 relative ${p.popular ? 'ring-2 ring-emerald-500/50' : ''}`}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-emerald-600 text-white px-3">Most Popular</Badge>
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold text-lg">{p.name}</h3>
                    <Badge className="bg-emerald-600/20 text-emerald-400">{p.status}</Badge>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400 mb-1">{p.price}</p>
                  <p className="text-slate-500 text-sm mb-6">per month</p>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-white font-bold">{p.employees}</p>
                      <p className="text-slate-500 text-xs">Employees</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-white font-bold">{p.companies}</p>
                      <p className="text-slate-500 text-xs">Companies</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center col-span-2">
                      <p className="text-white font-bold">{p.credits}</p>
                      <p className="text-slate-500 text-xs">AI Credits / Month</p>
                    </div>
                  </div>
                  <div className="space-y-2 mb-6">
                    {p.features.map(f => (
                      <div key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-slate-300">{f}</span>
                      </div>
                    ))}
                  </div>
                  <Button className={`w-full ${p.popular ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`}>
                    Manage Plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {analyticsData.map(a => (
              <Card key={a.label} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <a.icon className={`w-5 h-5 ${a.color}`} />
                    <Badge className="bg-emerald-600/20 text-emerald-400 text-xs">{a.change}</Badge>
                  </div>
                  <p className="text-2xl font-bold text-white">{a.value}</p>
                  <p className="text-sm text-slate-400 mt-1">{a.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader><CardTitle className="text-white text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5 text-emerald-400" /> Usage by Module</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { module: 'Employee Management', usage: 85 },
                  { module: 'Recruitment', usage: 72 },
                  { module: 'AI Interview', usage: 45 },
                  { module: 'Payroll', usage: 90 },
                  { module: 'Attendance', usage: 88 },
                  { module: 'Leave Management', usage: 76 },
                ].map(m => (
                  <div key={m.module} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">{m.module}</span>
                      <span className="text-emerald-400">{m.usage}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.usage}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader><CardTitle className="text-white text-lg flex items-center gap-2"><Cpu className="w-5 h-5 text-teal-400" /> Company Distribution</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {companies.map(c => {
                  const empCount = c._count?.employees || 0
                  const maxEmp = Math.max(...companies.map(co => co._count?.employees || 1), 1)
                  const usagePct = (empCount / maxEmp) * 100
                  return (
                    <div key={c.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">{c.name}</span>
                        <span className="text-teal-400">{empCount} employees</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${usagePct > 80 ? 'bg-red-500' : usagePct > 50 ? 'bg-amber-500' : 'bg-teal-500'}`} style={{ width: `${usagePct}%` }} />
                      </div>
                    </div>
                  )
                })}
                {companies.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-4">No company data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
