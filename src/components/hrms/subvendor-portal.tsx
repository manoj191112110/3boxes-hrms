'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Layers, Briefcase, Users, Search, Plus,
  AlertCircle, Loader2, ArrowRight
} from 'lucide-react'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { useHRMSStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

interface SubVendor {
  id: string
  vendorId: string
  name: string
  code: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  status: string
  createdAt: string
}

interface Vendor {
  id: string
  companyId: string
  name: string
  code: string
  industry?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  status: string
  createdAt: string
  subVendors?: SubVendor[]
}

const svStatusColor: Record<string, string> = {
  'active': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'under_review': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'on_hold': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'inactive': 'bg-red-500/10 text-red-400 border-red-500/20',
}

const statusLabel: Record<string, string> = {
  'active': 'Active', 'under_review': 'Under Review', 'on_hold': 'On Hold', 'inactive': 'Inactive',
}

export default function SubvendorPortalModule() {
  const { data: session } = useSession()
  const { currentCompanyId } = useHRMSStore()
  const { toast } = useToast()

  const companyId = currentCompanyId || (session?.user as any)?.companyId

  const [activeTab, setActiveTab] = useState('subvendors')
  const [search, setSearch] = useState('')
  const [addDialog, setAddDialog] = useState(false)
  const [editDialog, setEditDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedSv, setSelectedSv] = useState<SubVendor & { parentVendorName: string } | null>(null)

  // Add subvendor form
  const [addForm, setAddForm] = useState({
    vendorId: '', name: '', code: '', contactName: '', contactEmail: '', contactPhone: ''
  })

  // Edit subvendor form
  const [editForm, setEditForm] = useState({
    id: '', vendorId: '', name: '', code: '', contactName: '', contactEmail: '', contactPhone: '', status: 'active'
  })

  const fetchData = useCallback(async () => {
    if (!companyId) return
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<{ vendors: Vendor[] }>('/vendors', { companyId })
      setVendors(data.vendors || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load sub-vendor data')
      toast({ title: 'Error', description: 'Failed to load sub-vendor data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [companyId, toast])

  useEffect(() => { fetchData() }, [fetchData])

  // Flatten subvendors with parent vendor info
  const allSubVendors = vendors.flatMap(v =>
    (v.subVendors || []).map(sv => ({ ...sv, parentVendorName: v.name, parentVendorId: v.id }))
  )

  const filteredSV = allSubVendors.filter(sv =>
    sv.name.toLowerCase().includes(search.toLowerCase()) ||
    sv.parentVendorName.toLowerCase().includes(search.toLowerCase()) ||
    (sv.contactName || '').toLowerCase().includes(search.toLowerCase())
  )

  const activeSV = allSubVendors.filter(sv => sv.status === 'active').length
  const activeVendors = vendors.filter(v => v.status === 'active')

  const stats = [
    { label: 'Sub-Vendors', value: allSubVendors.length, icon: Layers, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Active Sub-Vendors', value: activeSV, icon: Briefcase, color: 'from-teal-500 to-teal-600' },
    { label: 'Parent Vendors', value: vendors.length, icon: Users, color: 'from-cyan-500 to-cyan-600' },
    { label: 'With Contact Info', value: allSubVendors.filter(sv => sv.contactName).length, icon: Layers, color: 'from-teal-500 to-teal-600' },
  ]

  const handleAddSubVendor = async () => {
    if (!addForm.name || !addForm.code || !addForm.vendorId) {
      toast({ title: 'Validation Error', description: 'Name, code, and parent vendor are required', variant: 'destructive' })
      return
    }
    try {
      await apiPost('/vendors', {
        type: 'subvendor',
        vendorId: addForm.vendorId,
        name: addForm.name,
        code: addForm.code,
        contactName: addForm.contactName || null,
        contactEmail: addForm.contactEmail || null,
        contactPhone: addForm.contactPhone || null,
      })
      await apiPost('/notifications', { companyId, type: 'vendor', title: 'Sub-Vendor Added', message: `Sub-vendor "${addForm.name}" has been added` })
      toast({ title: 'Sub-Vendor Added', description: `"${addForm.name}" has been added` })
      setAddDialog(false)
      setAddForm({ vendorId: '', name: '', code: '', contactName: '', contactEmail: '', contactPhone: '' })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to add sub-vendor', variant: 'destructive' })
    }
  }

  const handleEditSubVendor = async () => {
    if (!editForm.name || !editForm.id) {
      toast({ title: 'Validation Error', description: 'Name is required', variant: 'destructive' })
      return
    }
    try {
      await apiPut('/vendors', {
        type: 'subvendor',
        id: editForm.id,
        name: editForm.name,
        contactName: editForm.contactName || null,
        contactEmail: editForm.contactEmail || null,
        contactPhone: editForm.contactPhone || null,
        status: editForm.status,
      })
      toast({ title: 'Sub-Vendor Updated', description: `"${editForm.name}" has been updated` })
      setEditDialog(false)
      setSelectedSv(null)
      fetchData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update sub-vendor', variant: 'destructive' })
    }
  }

  const openEditDialog = (sv: SubVendor & { parentVendorName: string }) => {
    setSelectedSv(sv)
    setEditForm({
      id: sv.id, vendorId: sv.vendorId, name: sv.name, code: sv.code,
      contactName: sv.contactName || '', contactEmail: sv.contactEmail || '',
      contactPhone: sv.contactPhone || '', status: sv.status,
    })
    setEditDialog(true)
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="ml-3 text-slate-400">Loading sub-vendor data...</span>
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
          <h1 className="text-2xl font-bold text-white">Sub-Vendor Portal</h1>
          <p className="text-slate-400 mt-1">Manage sub-vendors under main vendor partnerships</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={() => setAddDialog(true)}>
          <Plus className="w-4 h-4" /> Add Sub-Vendor
        </Button>
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
        <Input placeholder="Search sub-vendors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-slate-900 border-slate-800 text-white" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-800 p-1 h-auto flex-wrap">
          <TabsTrigger value="subvendors" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Sub-Vendors</TabsTrigger>
          <TabsTrigger value="byvendor" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">By Parent Vendor</TabsTrigger>
        </TabsList>

        {/* Sub-Vendors Tab */}
        <TabsContent value="subvendors" className="mt-4">
          {filteredSV.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Layers className="w-12 h-12 mb-3 opacity-50" />
              <p>No sub-vendors found. Add sub-vendors under existing vendors!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSV.map(sv => (
                <Card key={sv.id} className="bg-slate-900 border-slate-800">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                          <Layers className="w-5 h-5 text-teal-400" />
                        </div>
                        <div>
                          <h3 className="text-white font-medium">{sv.name}</h3>
                          <p className="text-xs text-slate-500">
                            Under: <span className="text-emerald-400">{sv.parentVendorName}</span> · Code: {sv.code} · Since {formatDate(sv.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={svStatusColor[sv.status] || svStatusColor['inactive']}>{statusLabel[sv.status] || sv.status}</Badge>
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-emerald-400 h-7 w-7 p-0" onClick={() => openEditDialog(sv)}>
                          <Briefcase className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
                      <div>
                        <p className="text-xs text-slate-500">Contact</p>
                        <p className="text-sm text-white">{sv.contactName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Email</p>
                        <p className="text-sm text-slate-300">{sv.contactEmail || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Phone</p>
                        <p className="text-sm text-slate-300">{sv.contactPhone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Parent Vendor</p>
                        <p className="text-sm text-emerald-400">{sv.parentVendorName}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* By Parent Vendor Tab */}
        <TabsContent value="byvendor" className="mt-4">
          {vendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Users className="w-12 h-12 mb-3 opacity-50" />
              <p>No vendors found. Add vendors first!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {vendors.map(v => {
                const svs = v.subVendors || []
                return (
                  <Card key={v.id} className="bg-slate-900 border-slate-800">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <Briefcase className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-white font-medium">{v.name}</h3>
                          <p className="text-xs text-slate-500">{v.industry || 'No industry'} · {v.contactName || 'No contact'} · {svs.length} sub-vendors</p>
                        </div>
                        <Badge variant="outline" className={svStatusColor[v.status] || svStatusColor['inactive']}>{statusLabel[v.status] || v.status}</Badge>
                      </div>
                      {svs.length === 0 ? (
                        <p className="text-slate-600 text-sm pl-13">No sub-vendors under this vendor</p>
                      ) : (
                        <div className="space-y-2">
                          {svs.map(sv => (
                            <div key={sv.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Layers className="w-4 h-4 text-teal-400" />
                                <div>
                                  <p className="text-white text-sm font-medium">{sv.name}</p>
                                  <p className="text-xs text-slate-500">{sv.code} · {sv.contactName || 'No contact'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={svStatusColor[sv.status] || svStatusColor['inactive']}>{statusLabel[sv.status] || sv.status}</Badge>
                                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-emerald-400 h-7 w-7 p-0" onClick={() => openEditDialog({ ...sv, parentVendorName: v.name })}>
                                  <Briefcase className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Sub-Vendor Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Sub-Vendor</DialogTitle>
            <DialogDescription className="text-slate-400">Add a sub-vendor under an existing vendor</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Parent Vendor *</Label>
              <Select value={addForm.vendorId} onValueChange={v => setAddForm(f => ({ ...f, vendorId: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="Select parent vendor" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {activeVendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Sub-Vendor Name *</Label>
                <Input className="bg-slate-800 border-slate-700 text-white" placeholder="Enter sub-vendor name" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Code *</Label>
                <Input className="bg-slate-800 border-slate-700 text-white" placeholder="e.g., SV-001" value={addForm.code} onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Contact Person</Label>
                <Input className="bg-slate-800 border-slate-700 text-white" placeholder="Name" value={addForm.contactName} onChange={e => setAddForm(f => ({ ...f, contactName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Email</Label>
                <Input className="bg-slate-800 border-slate-700 text-white" placeholder="email@subvendor.com" value={addForm.contactEmail} onChange={e => setAddForm(f => ({ ...f, contactEmail: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Phone</Label>
              <Input className="bg-slate-800 border-slate-700 text-white" placeholder="+91-XXXXX-XXXXX" value={addForm.contactPhone} onChange={e => setAddForm(f => ({ ...f, contactPhone: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="border-slate-700 text-slate-300">Cancel</Button></DialogClose>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddSubVendor}>Add Sub-Vendor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sub-Vendor Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Sub-Vendor</DialogTitle>
            <DialogDescription className="text-slate-400">Update sub-vendor details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Sub-Vendor Name *</Label>
                <Input className="bg-slate-800 border-slate-700 text-white" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Contact Person</Label>
                <Input className="bg-slate-800 border-slate-700 text-white" value={editForm.contactName} onChange={e => setEditForm(f => ({ ...f, contactName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Email</Label>
                <Input className="bg-slate-800 border-slate-700 text-white" value={editForm.contactEmail} onChange={e => setEditForm(f => ({ ...f, contactEmail: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Phone</Label>
              <Input className="bg-slate-800 border-slate-700 text-white" value={editForm.contactPhone} onChange={e => setEditForm(f => ({ ...f, contactPhone: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleEditSubVendor}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
