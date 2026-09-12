'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'
import {
  User, Briefcase, FileText, Building2, Phone, Mail,
  MapPin, Calendar, Edit3, Save
} from 'lucide-react'
import { apiGet, apiPut } from '@/lib/api'
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
  state?: string
  country?: string
  zipCode?: string
  employmentType?: string
  status: string
  joiningDate?: string
  confirmationDate?: string
  probationEndDate?: string
  contractEndDate?: string
  reportingManagerId?: string
  hrManagerId?: string
  salary: number
  currency: string
  bankName?: string
  bankAccount?: string
  panNumber?: string
  taxId?: string
  fatherName?: string
  motherName?: string
  spouseName?: string
  emergencyContact?: string
  emergencyPhone?: string
  avatar?: string
  department?: { id: string; name: string }
  designation?: { id: string; name: string }
  branch?: { id: string; name: string; city?: string }
  company?: { name: string; code: string }
}

interface LeaveApplication {
  id: string
  leaveTypeId: string
  startDate: string
  endDate: string
  totalDays: number
  reason?: string
  status: string
  leaveType: { id: string; name: string }
}

const docStatusColor: Record<string, string> = {
  'Verified': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'active': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Pending': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const leaveStatusColor: Record<string, string> = {
  'approved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'pending': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'rejected': 'bg-red-500/10 text-red-400 border-red-500/20',
}

const fmtDate = (d: string | Date | undefined) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
const fmtStatus = (s: string) => s ? s.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') : '-'

function InfoRow({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm text-white">{value || '-'}</p>
    </div>
  )
}

export default function ProfileModule() {
  const { data: session } = useSession()
  const { currentCompanyId } = useHRMSStore()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState('personal')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [employee, setEmployee] = useState<EmployeeData | null>(null)
  const [allEmployees, setAllEmployees] = useState<EmployeeData[]>([])
  const [leaveHistory, setLeaveHistory] = useState<LeaveApplication[]>([])

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<EmployeeData>>({})

  const companyId = currentCompanyId || (session?.user as any)?.companyId

  const fetchData = useCallback(async () => {
    if (!companyId) { setLoading(false); return }
    setLoading(true)
    try {
      const empRes = await apiGet<{ employees: EmployeeData[]; total: number }>('/api/employees', { companyId, limit: '100' })
      setAllEmployees(empRes.employees)

      const currentEmp = empRes.employees.find((e: EmployeeData) => e.email === session?.user?.email)
      if (currentEmp) {
        setEmployee(currentEmp)
        setEditForm({
          firstName: currentEmp.firstName,
          lastName: currentEmp.lastName,
          phone: currentEmp.phone,
          gender: currentEmp.gender,
          dateOfBirth: currentEmp.dateOfBirth ? currentEmp.dateOfBirth.split('T')[0] : '',
          nationality: currentEmp.nationality,
          address: currentEmp.address,
          city: currentEmp.city,
          state: currentEmp.state,
          country: currentEmp.country,
          zipCode: currentEmp.zipCode,
          bankName: currentEmp.bankName,
          bankAccount: currentEmp.bankAccount,
          panNumber: currentEmp.panNumber,
          emergencyContact: currentEmp.emergencyContact,
          emergencyPhone: currentEmp.emergencyPhone,
        })

        // Fetch leave history
        try {
          const leaveRes = await apiGet<{ applications: LeaveApplication[] }>('/api/leave', { companyId, employeeId: currentEmp.id, include: 'applications' })
          setLeaveHistory(leaveRes.applications || [])
        } catch {}
      }
    } catch (error: any) {
      console.error('Profile fetch error:', error)
      toast({ title: 'Error', description: 'Failed to load profile data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [companyId, session?.user?.email, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    if (!employee) return
    setSaving(true)
    try {
      await apiPut('/api/employees', {
        id: employee.id,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
        gender: editForm.gender,
        dateOfBirth: editForm.dateOfBirth || undefined,
        nationality: editForm.nationality,
        address: editForm.address,
        city: editForm.city,
        state: editForm.state,
        country: editForm.country,
        zipCode: editForm.zipCode,
        bankName: editForm.bankName,
        bankAccount: editForm.bankAccount,
        panNumber: editForm.panNumber,
        emergencyContact: editForm.emergencyContact,
        emergencyPhone: editForm.emergencyPhone,
      })
      toast({ title: 'Success', description: 'Profile updated successfully' })
      setEditing(false)
      fetchData()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update profile', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const initials = employee ? `${employee.firstName[0] || ''}${employee.lastName[0] || ''}`.toUpperCase() : '??'

  // Resolve manager name
  const managerName = employee?.reportingManagerId
    ? allEmployees.find(e => e.id === employee.reportingManagerId)
      ? `${allEmployees.find(e => e.id === employee.reportingManagerId)!.firstName} ${allEmployees.find(e => e.id === employee.reportingManagerId)!.lastName}`
      : '-'
    : '-'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-slate-400">Loading profile data...</span>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="text-center">
          <User className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p>No employee record found for your account.</p>
          <p className="text-xs text-slate-500 mt-1">Please contact HR to link your employee profile.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
          <p className="text-slate-400 mt-1">View and manage your personal information</p>
        </div>
        <Button
          onClick={() => editing ? handleSave() : setEditing(true)}
          disabled={editing && saving}
          variant={editing ? 'default' : 'outline'}
          className={editing ? 'bg-emerald-600 hover:bg-emerald-700 text-white gap-2' : 'border-slate-700 text-slate-300 gap-2'}
        >
          {editing ? (
            <>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Changes</>
          ) : (
            <><Edit3 className="w-4 h-4" />Edit Profile</>
          )}
        </Button>
      </div>

      {/* Profile Header Card */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <h2 className="text-xl font-bold text-white">{employee.firstName} {employee.lastName}</h2>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 self-start">{fmtStatus(employee.status)}</Badge>
              </div>
              <p className="text-emerald-400 mt-1">{employee.designation?.name || 'N/A'}</p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-400">
                <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{employee.employeeCode}</span>
                <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{employee.department?.name || 'N/A'}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{employee.branch?.city || employee.city || 'N/A'}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Since {employee.joiningDate ? fmtDate(employee.joiningDate) : 'N/A'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-800 p-1 h-auto flex-wrap">
          <TabsTrigger value="personal" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Personal Info</TabsTrigger>
          <TabsTrigger value="employment" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Employment</TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Documents</TabsTrigger>
          <TabsTrigger value="bank" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Bank Details</TabsTrigger>
          <TabsTrigger value="emergency" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Emergency Contact</TabsTrigger>
          <TabsTrigger value="leave-history" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5">Leave History</TabsTrigger>
        </TabsList>

        {/* Personal Info */}
        <TabsContent value="personal" className="mt-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <div><Label2 label="First Name" value={editForm.firstName || ''} onChange={v => setEditForm(p => ({ ...p, firstName: v }))} /></div>
                  <div><Label2 label="Last Name" value={editForm.lastName || ''} onChange={v => setEditForm(p => ({ ...p, lastName: v }))} /></div>
                  <div><Label2 label="Date of Birth" value={editForm.dateOfBirth || ''} onChange={v => setEditForm(p => ({ ...p, dateOfBirth: v }))} type="date" /></div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Gender</p>
                    <select className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2" value={editForm.gender || ''} onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))}>
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div><Label2 label="Nationality" value={editForm.nationality || ''} onChange={v => setEditForm(p => ({ ...p, nationality: v }))} /></div>
                  <div><Label2 label="Phone" value={editForm.phone || ''} onChange={v => setEditForm(p => ({ ...p, phone: v }))} /></div>
                  <div className="col-span-2 sm:col-span-3"><Label2 label="Address" value={editForm.address || ''} onChange={v => setEditForm(p => ({ ...p, address: v }))} /></div>
                  <div><Label2 label="City" value={editForm.city || ''} onChange={v => setEditForm(p => ({ ...p, city: v }))} /></div>
                  <div><Label2 label="State" value={editForm.state || ''} onChange={v => setEditForm(p => ({ ...p, state: v }))} /></div>
                  <div><Label2 label="ZIP Code" value={editForm.zipCode || ''} onChange={v => setEditForm(p => ({ ...p, zipCode: v }))} /></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <InfoRow label="First Name" value={employee.firstName} />
                  <InfoRow label="Last Name" value={employee.lastName} />
                  <InfoRow label="Date of Birth" value={fmtDate(employee.dateOfBirth)} />
                  <InfoRow label="Gender" value={fmtStatus(employee.gender || '')} />
                  <InfoRow label="Nationality" value={employee.nationality} />
                  <InfoRow label="Phone" value={employee.phone} />
                </div>
              )}
              {!editing && (
                <div className="mt-6 pt-6 border-t border-slate-800">
                  <InfoRow label="Address" value={[employee.address, employee.city, employee.state, employee.zipCode].filter(Boolean).join(', ')} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employment */}
        <TabsContent value="employment" className="mt-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Employment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                <InfoRow label="Employee ID" value={employee.employeeCode} />
                <InfoRow label="Designation" value={employee.designation?.name} />
                <InfoRow label="Department" value={employee.department?.name} />
                <InfoRow label="Location" value={employee.branch?.city || employee.city} />
                <InfoRow label="Date of Joining" value={fmtDate(employee.joiningDate)} />
                <InfoRow label="Confirmation Date" value={fmtDate(employee.confirmationDate)} />
                <InfoRow label="Reporting Manager" value={managerName} />
                <InfoRow label="Employee Type" value={fmtStatus(employee.employmentType || '')} />
                <InfoRow label="Probation End" value={fmtDate(employee.probationEndDate)} />
                <InfoRow label="Company" value={employee.company?.name} />
                <InfoRow label="Currency" value={employee.currency} />
                <InfoRow label="Status" value={fmtStatus(employee.status)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
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
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'Offer Letter', type: 'Employment', status: 'Verified' },
                      { name: 'PAN Card', type: 'Identity', status: employee.panNumber ? 'Verified' : 'Pending' },
                      { name: 'Bank Proof', type: 'Financial', status: employee.bankName ? 'Verified' : 'Pending' },
                      { name: 'Address Proof', type: 'Identity', status: employee.address ? 'Verified' : 'Pending' },
                      { name: 'ID Proof', type: 'Identity', status: 'Pending' },
                      { name: 'Education Certificates', type: 'Academic', status: 'Pending' },
                    ].map((d, i) => (
                      <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-white">{d.name}</span>
                        </td>
                        <td className="p-4 text-sm text-slate-400">{d.type}</td>
                        <td className="p-4 text-sm text-slate-400">{employee.joiningDate ? fmtDate(employee.joiningDate) : '-'}</td>
                        <td className="p-4"><Badge variant="outline" className={docStatusColor[d.status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>{d.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Details */}
        <TabsContent value="bank" className="mt-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Bank Details</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <div><Label2 label="Bank Name" value={editForm.bankName || ''} onChange={v => setEditForm(p => ({ ...p, bankName: v }))} /></div>
                  <div><Label2 label="Account Number" value={editForm.bankAccount || ''} onChange={v => setEditForm(p => ({ ...p, bankAccount: v }))} /></div>
                  <div><Label2 label="PAN Number" value={editForm.panNumber || ''} onChange={v => setEditForm(p => ({ ...p, panNumber: v }))} /></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <InfoRow label="Bank Name" value={employee.bankName} />
                  <InfoRow label="Account Number" value={employee.bankAccount ? `XXXX-XXXX-${employee.bankAccount.slice(-4)}` : undefined} />
                  <InfoRow label="PAN Number" value={employee.panNumber} />
                  <InfoRow label="Tax ID" value={employee.taxId} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emergency Contact */}
        <TabsContent value="emergency" className="mt-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5">
              {editing ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <div><Label2 label="Emergency Contact Name" value={editForm.emergencyContact || ''} onChange={v => setEditForm(p => ({ ...p, emergencyContact: v }))} /></div>
                  <div><Label2 label="Emergency Phone" value={editForm.emergencyPhone || ''} onChange={v => setEditForm(p => ({ ...p, emergencyPhone: v }))} /></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <InfoRow label="Emergency Contact Name" value={employee.emergencyContact} />
                  <InfoRow label="Emergency Phone" value={employee.emergencyPhone} />
                  <InfoRow label="Father Name" value={employee.fatherName} />
                  <InfoRow label="Mother Name" value={employee.motherName} />
                  <InfoRow label="Spouse Name" value={employee.spouseName} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave History */}
        <TabsContent value="leave-history" className="mt-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Leave History</CardTitle>
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
                    {leaveHistory.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-500">No leave history found</td></tr>
                    ) : leaveHistory.map(l => (
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
      </Tabs>
    </div>
  )
}

// ── Editable input component ──
function Label2({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <Input
        type={type}
        className="bg-slate-800 border-slate-700 text-white text-sm h-9"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}
