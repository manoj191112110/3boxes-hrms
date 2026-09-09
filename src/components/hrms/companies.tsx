'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getCompanies, createCompany, updateCompany } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import type { CompanyInfo } from '@/lib/types';
import { useCompanyContextStore } from '@/store/companyContextStore';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building, Plus, Building2, Users, MapPin, Globe,
  Pencil, Eye, ChevronRight, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export function Companies() {
  const { companies, setCompanies, setCurrentCompany } = useAppStore();
  const { user } = useAuthStore();
  const { availableCompanyGroups, hydrated: ctxHydrated, hydrate } = useCompanyContextStore();
  const [loading, setLoading] = useState(true);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyInfo | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', code: '', industry: 'IT Services', country: '', currency: 'INR', isActive: true,
  });
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', code: '', industry: 'IT Services', country: '', currency: 'INR', companyGroupId: '',
  });

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getCompanies();
      const companyList = Array.isArray(res) ? res : [];
      // Map to CompanyInfo format
      const mapped: CompanyInfo[] = companyList.map((c: { id: string; name: string; code: string; industry: string | null; country: string | null; currency: string; isActive: boolean; _count: { employees: number } }) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        industry: c.industry || '',
        country: c.country || '',
        currency: c.currency,
        employeeCount: c._count?.employees || 0,
        isActive: c.isActive,
      }));
      setCompanies(mapped);
    } catch {
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [setCompanies]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  // Hydrate company context to get available groups
  useEffect(() => {
    if (!ctxHydrated) hydrate();
  }, [ctxHydrated, hydrate]);

  const isSuperAdmin = user?.role === 'super_admin';

  const handleCreateCompany = async () => {
    try {
      // Group company required for non-super_admin
      if (!isSuperAdmin && !form.companyGroupId) {
        toast.error(
          availableCompanyGroups.length === 0
            ? 'No group companies exist under your tenant yet. Please ask your super admin to create one first.'
            : 'Please select a group company. Only super admins can create new group companies.'
        );
        return;
      }
      setSubmitting(true);
      const payload = { ...form };
      if (!payload.companyGroupId) delete (payload as Record<string, unknown>).companyGroupId;
      await createCompany(payload);
      toast.success('Company created successfully');
      setShowAddCompany(false);
      setForm({ name: '', code: '', industry: 'IT Services', country: '', currency: 'INR', companyGroupId: '' });
      fetchCompanies();
      hydrate(true);
    } catch {
      toast.error('Failed to create company');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (company: CompanyInfo) => {
    setEditingCompany(company);
    setEditForm({
      name: company.name,
      code: company.code,
      industry: company.industry || 'IT Services',
      country: company.country || '',
      currency: company.currency || 'INR',
      isActive: company.isActive,
    });
    setShowEditCompany(true);
  };

  const handleEditCompany = async () => {
    if (!editingCompany) return;
    try {
      setSubmitting(true);
      await updateCompany(editingCompany.id, editForm);
      toast.success('Company updated successfully');
      setShowEditCompany(false);
      setEditingCompany(null);
      fetchCompanies();
    } catch {
      toast.error('Failed to update company');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground text-sm">Manage multi-company setup (Super Admin only)</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowAddCompany(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Company
        </Button>
      </div>

      {/* Company Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map(company => (
          <Card key={company.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                  {company.code.slice(0, 2)}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{company.name}</h3>
                  <p className="text-xs text-muted-foreground">{company.code} · {company.industry}</p>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {company.country} · {company.currency}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {(company.employeeCount ?? 0).toLocaleString()} employees
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <Badge className={`text-[10px] ${company.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {company.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedCompany(company.id)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(company)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Selected Company Branches */}
      {selectedCompany && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" /> Company Details
            </CardTitle>
            <CardDescription>
              {companies.find(c => c.id === selectedCompany)?.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(() => {
              const comp = companies.find(c => c.id === selectedCompany);
              if (!comp) return null;
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <span className="text-sm">Code</span>
                    <Badge variant="secondary">{comp.code}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <span className="text-sm">Industry</span>
                    <span className="text-sm text-muted-foreground">{comp.industry}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <span className="text-sm">Country / Currency</span>
                    <span className="text-sm text-muted-foreground">{comp.country} · {comp.currency}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <span className="text-sm">Employees</span>
                    <span className="text-sm text-muted-foreground">{(comp.employeeCount ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Add Company Dialog */}
      <Dialog open={showAddCompany} onOpenChange={setShowAddCompany}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
            <DialogDescription>Register a new company in the 3Boxes HRMS platform</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Company Name</Label>
              <Input placeholder="Enter company name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Company Code</Label>
                <Input placeholder="e.g. TCG" value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Industry</Label>
                <Select value={form.industry} onValueChange={(v) => setForm(f => ({ ...f, industry: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IT Services">IT Services</SelectItem>
                    <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Logistics">Logistics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Group Company selector — required for tenant_admin */}
            {!isSuperAdmin && (
              <div className="space-y-1">
                <Label className="text-sm">Group Company *</Label>
                {availableCompanyGroups.length === 0 ? (
                  <p className="text-xs text-amber-600">No group companies available. Ask your super admin to create one first.</p>
                ) : (
                  <Select value={form.companyGroupId} onValueChange={(v) => setForm(f => ({ ...f, companyGroupId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select a group company" /></SelectTrigger>
                    <SelectContent>
                      {availableCompanyGroups.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Country</Label>
                <Input placeholder="Country" value={form.country} onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="SGD">SGD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateCompany} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Company
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Edit Company Dialog */}
      <Dialog open={showEditCompany} onOpenChange={setShowEditCompany}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>Update company information</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Company Name</Label>
              <Input placeholder="Enter company name" value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Company Code</Label>
                <Input placeholder="e.g. TCG" value={editForm.code} onChange={(e) => setEditForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Industry</Label>
                <Select value={editForm.industry} onValueChange={(v) => setEditForm(f => ({ ...f, industry: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IT Services">IT Services</SelectItem>
                    <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Logistics">Logistics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Country</Label>
                <Input placeholder="Country" value={editForm.country} onChange={(e) => setEditForm(f => ({ ...f, country: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Currency</Label>
                <Select value={editForm.currency} onValueChange={(v) => setEditForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="SGD">SGD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editIsActive"
                checked={editForm.isActive}
                onChange={(e) => setEditForm(f => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="editIsActive" className="text-sm">Active</Label>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleEditCompany} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
