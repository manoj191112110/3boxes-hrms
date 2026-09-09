'use client'

import { useState, useEffect, useCallback } from 'react'
import { useHRMSStore } from '@/lib/store'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ScrollText, ShieldCheck, Lock, FileBarChart, Search, Download,
  CheckCircle2, Clock, AlertCircle, XCircle, Eye, Shield, Key, Database,
  RefreshCw, Filter
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AuditLogEntry {
  id: string
  companyId: string | null
  userId: string | null
  action: string
  entity: string
  entityId: string | null
  details: string | null
  ipAddress: string | null
  createdAt: string
  user?: { name: string; email: string } | null
}

interface AuditStats {
  todayLogs: number
  loginCount: number
  errorCount: number
  total: number
}

const complianceItems = [
  { id: 'CMP-001', name: 'PF Filing', category: 'Statutory', dueDate: '2026-06-15', status: 'Compliant', lastFiled: 'May 2026', nextDue: 'June 2026' },
  { id: 'CMP-002', name: 'ESI Return', category: 'Statutory', dueDate: '2026-06-11', status: 'Compliant', lastFiled: 'May 2026', nextDue: 'June 2026' },
  { id: 'CMP-003', name: 'TDS Filing', category: 'Tax', dueDate: '2026-06-07', status: 'In Progress', lastFiled: 'April 2026', nextDue: 'May 2026' },
  { id: 'CMP-004', name: 'Professional Tax', category: 'Statutory', dueDate: '2026-06-30', status: 'Compliant', lastFiled: 'May 2026', nextDue: 'June 2026' },
  { id: 'CMP-005', name: 'GST Returns', category: 'Tax', dueDate: '2026-06-20', status: 'Pending', lastFiled: 'April 2026', nextDue: 'May 2026' },
  { id: 'CMP-006', name: 'Labour Law Compliance', category: 'Regulatory', dueDate: '2026-07-01', status: 'Compliant', lastFiled: 'Q1 2026', nextDue: 'Q2 2026' },
]

const dataSecurity = [
  { category: 'Password Policy', settings: [
    { name: 'Minimum length', value: '8 characters', status: 'Enforced' },
    { name: 'Require uppercase', value: 'Yes', status: 'Enforced' },
    { name: 'Require special chars', value: 'Yes', status: 'Enforced' },
    { name: 'Password expiry', value: '90 days', status: 'Enforced' },
  ]},
  { category: 'Access Control', settings: [
    { name: 'Multi-Factor Auth', value: 'Enabled', status: 'Enforced' },
    { name: 'Session timeout', value: '30 minutes', status: 'Enforced' },
    { name: 'IP whitelist', value: '192.168.x.x', status: 'Active' },
    { name: 'SSO Integration', value: 'Azure AD', status: 'Active' },
  ]},
  { category: 'Data Protection', settings: [
    { name: 'Encryption at rest', value: 'AES-256', status: 'Active' },
    { name: 'Encryption in transit', value: 'TLS 1.3', status: 'Active' },
    { name: 'Data backup', value: 'Daily', status: 'Active' },
    { name: 'Audit logging', value: 'All actions', status: 'Active' },
  ]},
]

const complianceReports = [
  { name: 'Monthly PF Report', period: 'May 2026', generatedDate: '2026-06-01', status: 'Ready', format: 'PDF' },
  { name: 'TDS Quarterly Return', period: 'Q1 2026', generatedDate: '2026-06-02', status: 'Ready', format: 'Excel' },
  { name: 'ESI Compliance Report', period: 'May 2026', generatedDate: '2026-06-01', status: 'Ready', format: 'PDF' },
  { name: 'Labour Law Audit', period: 'Q1 2026', generatedDate: '2026-06-03', status: 'Generating', format: 'PDF' },
  { name: 'Gender Pay Gap Report', period: 'FY 2025-26', generatedDate: '2026-05-30', status: 'Ready', format: 'Excel' },
]

const severityColor: Record<string, string> = {
  'Info': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Warning': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Critical': 'bg-red-500/10 text-red-400 border-red-500/20',
}

const compStatusColor: Record<string, string> = {
  'Compliant': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'In Progress': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Pending': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Non-Compliant': 'bg-red-500/10 text-red-400 border-red-500/20',
}

function getLogSeverity(log: AuditLogEntry): 'Info' | 'Warning' | 'Critical' {
  const a = log.action.toUpperCase()
  if (a.includes('ERROR') || a.includes('FAILED') || a.includes('DELETE') && a.includes('FAILED')) return 'Critical'
  if (a.includes('DELETE') || a.includes('REVOKE') || a.includes('CHANGE') || a.includes('UPDATE') || a.includes('EXPORT')) return 'Warning'
  return 'Info'
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).replace(',', '')
}

export default function AuditComplianceModule() {
  const { currentCompanyId } = useHRMSStore()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState('audit-logs')
  const [search, setSearch] = useState('')
  const [filterEntity, setFilterEntity] = useState('all')
  const [filterAction, setFilterAction] = useState('all')
  const [loading, setLoading] = useState(true)

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [auditStats, setAuditStats] = useState<AuditStats>({ todayLogs: 0, loginCount: 0, errorCount: 0, total: 0 })

  const fetchAuditData = useCallback(async () => {
    if (!currentCompanyId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params: Record<string, string> = { companyId: currentCompanyId, limit: '200' }
      if (filterEntity !== 'all') params.entity = filterEntity
      if (filterAction !== 'all') params.action = filterAction

      const data = await apiGet<{ logs: AuditLogEntry[]; stats: AuditStats }>('/api/audit', params)
      setAuditLogs(data.logs || [])
      setAuditStats(data.stats || { todayLogs: 0, loginCount: 0, errorCount: 0, total: 0 })
    } catch (error) {
      console.error('Audit fetch error:', error)
      toast({ title: 'Error', description: 'Failed to load audit data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [currentCompanyId, filterEntity, filterAction, toast])

  useEffect(() => {
    fetchAuditData()
  }, [fetchAuditData])

  // Extract unique entities and actions for filters
  const uniqueEntities = [...new Set(auditLogs.map(l => l.entity))].sort()
  const uniqueActions = [...new Set(auditLogs.map(l => l.action))].sort()

  const filteredLogs = auditLogs.filter(log =>
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.entity.toLowerCase().includes(search.toLowerCase()) ||
    (log.user?.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (log.user?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (log.details || '').toLowerCase().includes(search.toLowerCase())
  )

  // Compute compliance score from audit stats
  const criticalCount = auditStats.errorCount || 0
  const complianceScore = auditStats.total > 0
    ? Math.max(0, Math.min(100, Math.round(100 - (criticalCount * 5))))
    : 94

  const stats = [
    { label: 'Audit Events Today', value: auditStats.todayLogs, icon: ScrollText, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Compliance Score', value: `${complianceScore}%`, icon: ShieldCheck, color: 'from-teal-500 to-teal-600' },
    { label: 'Critical Alerts', value: criticalCount, icon: AlertCircle, color: 'from-red-500 to-red-600' },
    { label: 'Active Policies', value: 12, icon: Lock, color: 'from-teal-500 to-teal-600' },
  ]

  const handleExport = () => {
    toast({ title: 'Export Started', description: 'Audit log export is being prepared...' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit & Compliance</h1>
          <p className="text-slate-400 mt-1">Track activities, compliance, and data security</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={fetchAuditData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" /> Export Audit Log
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Skeleton className="w-9 h-9 rounded-lg" />
                  <Skeleton className="h-7 w-12" />
                </div>
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          ))
        ) : (
          stats.map(s => {
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
          })
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input placeholder="Search audit logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-slate-900 border-slate-800 text-white" />
        </div>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-[180px] bg-slate-900 border-slate-800 text-white">
            <Filter className="w-4 h-4 mr-2 text-slate-500" />
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">All Entities</SelectItem>
            {uniqueEntities.map(e => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[180px] bg-slate-900 border-slate-800 text-white">
            <Filter className="w-4 h-4 mr-2 text-slate-500" />
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map(a => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-800 p-1 h-auto flex-wrap">
          <TabsTrigger value="audit-logs" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Audit Logs</TabsTrigger>
          <TabsTrigger value="compliance" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Compliance</TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Data Security</TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Reports</TabsTrigger>
        </TabsList>

        {/* Audit Logs Tab */}
        <TabsContent value="audit-logs" className="mt-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              ) : filteredLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left text-xs font-medium text-slate-400 p-4">Timestamp</th>
                        <th className="text-left text-xs font-medium text-slate-400 p-4">User</th>
                        <th className="text-left text-xs font-medium text-slate-400 p-4">Action</th>
                        <th className="text-left text-xs font-medium text-slate-400 p-4">Entity</th>
                        <th className="text-left text-xs font-medium text-slate-400 p-4">Details</th>
                        <th className="text-left text-xs font-medium text-slate-400 p-4">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map(log => {
                        const severity = getLogSeverity(log)
                        return (
                          <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="p-4 text-xs text-slate-400 font-mono whitespace-nowrap">{formatTimestamp(log.createdAt)}</td>
                            <td className="p-4 text-sm text-white">{log.user?.email || log.user?.name || 'system'}</td>
                            <td className="p-4 text-sm text-slate-300">{log.action}</td>
                            <td className="p-4"><Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">{log.entity}</Badge></td>
                            <td className="p-4 text-xs text-slate-400 max-w-[200px] truncate">{log.details || '—'}</td>
                            <td className="p-4"><Badge variant="outline" className={severityColor[severity]}>{severity}</Badge></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <ScrollText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No audit logs found</p>
                  <p className="text-xs text-slate-600 mt-1">Activities will appear here as users interact with the system</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="mt-4">
          <div className="space-y-3">
            {complianceItems.map(comp => (
              <Card key={comp.id} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        comp.status === 'Compliant' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                        comp.status === 'In Progress' ? 'bg-cyan-500/10 border border-cyan-500/20' :
                        'bg-amber-500/10 border border-amber-500/20'
                      }`}>
                        {comp.status === 'Compliant' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                         comp.status === 'In Progress' ? <Clock className="w-5 h-5 text-cyan-400" /> :
                         <AlertCircle className="w-5 h-5 text-amber-400" />}
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{comp.name}</h3>
                        <p className="text-xs text-slate-500">{comp.category} · Due: {comp.dueDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs text-slate-500">
                        <p>Last: {comp.lastFiled}</p>
                        <p>Next: {comp.nextDue}</p>
                      </div>
                      <Badge variant="outline" className={compStatusColor[comp.status]}>{comp.status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Data Security Tab */}
        <TabsContent value="security" className="mt-4">
          <div className="space-y-4">
            {dataSecurity.map(section => (
              <Card key={section.category} className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    {section.category === 'Password Policy' ? <Key className="w-5 h-5 text-emerald-400" /> :
                     section.category === 'Access Control' ? <Shield className="w-5 h-5 text-teal-400" /> :
                     <Database className="w-5 h-5 text-cyan-400" />}
                    {section.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {section.settings.map(setting => (
                      <div key={setting.name} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <div>
                          <p className="text-sm text-white">{setting.name}</p>
                          <p className="text-xs text-slate-500">{setting.value}</p>
                        </div>
                        <Badge variant="outline" className={setting.status === 'Enforced' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}>
                          {setting.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {complianceReports.map((report, i) => (
              <Card key={i} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                        <FileBarChart className="w-4 h-4 text-teal-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-medium text-sm">{report.name}</h3>
                        <p className="text-xs text-slate-500">{report.period} · {report.format}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={report.status === 'Ready' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}>
                      {report.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
                    <span className="text-xs text-slate-500">Generated: {report.generatedDate}</span>
                    <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 text-xs h-7" onClick={() => toast({ title: 'Download', description: `${report.name} download started` })}>
                      <Download className="w-3 h-3 mr-1" />Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
