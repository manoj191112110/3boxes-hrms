'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getComplianceItems, createComplianceItem, updateComplianceItem } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck, AlertTriangle, FileText, CheckCircle2, XCircle,
  Clock, RefreshCw, ExternalLink, Bell, Plus
} from 'lucide-react';

// TODO: Connect to API when available
const REGULATORY_ALERTS = [
  { id: 1, title: 'New Labor Law Amendment Effective March 2025', description: 'Updated overtime regulations require policy changes', severity: 'high', date: '2 days ago' },
  { id: 2, title: 'Data Localization Requirements Updated', description: 'New requirements for storing employee data within country borders', severity: 'medium', date: '5 days ago' },
  { id: 3, title: 'Annual PF Contribution Rate Change', description: 'Provident Fund contribution rates updated for FY 2025-26', severity: 'medium', date: '1 week ago' },
  { id: 4, title: 'POSH Committee Renewal Reminder', description: 'Internal Complaints Committee membership needs renewal', severity: 'low', date: '2 weeks ago' },
];

// TODO: Connect to API when available
const AUDIT_STATUS = [
  { name: 'Internal Audit Q4 2024', status: 'completed', findings: 5, resolved: 5, date: 'Dec 2024' },
  { name: 'Statutory Audit FY 2024', status: 'completed', findings: 3, resolved: 2, date: 'Jan 2025' },
  { name: 'IT Security Audit', status: 'in_progress', findings: 8, resolved: 3, date: 'Feb 2025' },
  { name: 'HR Compliance Audit', status: 'scheduled', findings: 0, resolved: 0, date: 'Mar 2025' },
];

// TODO: Connect to API when available
const DOCUMENT_RETENTION = [
  { type: 'Employee Records', retention: '7 years after exit', status: 'compliant', documents: 12500 },
  { type: 'Financial Records', retention: '10 years', status: 'compliant', documents: 8900 },
  { type: 'Tax Documents', retention: '7 years', status: 'compliant', documents: 4200 },
  { type: 'Contract Documents', retention: '5 years after expiry', status: 'action_needed', documents: 3100 },
  { type: 'Safety Records', retention: '5 years', status: 'compliant', documents: 1800 },
  { type: 'Training Records', retention: '3 years', status: 'action_needed', documents: 5600 },
];

interface ComplianceItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  dueDate: string;
  status: string;
  priority: string;
  companyId?: string;
}

export function Compliance() {
  const { currentCompany } = useAppStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    category: '',
    dueDate: '',
    priority: 'medium',
  });

  // Fetch compliance items from API
  const { data: complianceData, isLoading, error } = useQuery({
    queryKey: ['compliance', currentCompany?.id],
    queryFn: () => getComplianceItems({ companyId: currentCompany?.id }),
    enabled: !!currentCompany?.id,
  });

  const complianceItems: ComplianceItem[] = (complianceData as { data?: ComplianceItem[] } | undefined)?.data || [];

  // Create compliance item mutation
  const { mutate: createItem, isPending: isCreating } = useMutation({
    mutationFn: createComplianceItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
      toast({ title: 'Compliance item created successfully' });
      setCreateDialogOpen(false);
      setNewItem({ title: '', description: '', category: '', dueDate: '', priority: 'medium' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create item', description: err.message, variant: 'destructive' });
    },
  });

  // Update compliance item mutation
  const { mutate: updateItem } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateComplianceItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
      toast({ title: 'Compliance item updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to update item', description: err.message, variant: 'destructive' });
    },
  });

  // Calculate compliance score from real data
  const completedCount = complianceItems.filter(i => i.status === 'completed').length;
  const complianceScore = complianceItems.length > 0
    ? Math.round((completedCount / complianceItems.length) * 100)
    : 0;

  const pendingCount = complianceItems.filter(i => i.status === 'in_progress' || i.status === 'pending').length;

  // Handle create form submission
  const handleCreate = () => {
    if (!newItem.title || !newItem.category || !newItem.dueDate) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    createItem({
      title: newItem.title,
      description: newItem.description,
      category: newItem.category,
      dueDate: newItem.dueDate,
      priority: newItem.priority,
      status: 'pending',
      companyId: currentCompany?.id,
    });
  };

  // Handle status update
  const handleStatusUpdate = (id: string, newStatus: string) => {
    updateItem({ id, data: { status: newStatus } });
  };

  // No company selected
  if (!currentCompany?.id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance</h1>
          <p className="text-muted-foreground text-sm">Track regulatory compliance and audits</p>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No Company Selected</p>
            <p className="text-sm text-muted-foreground mt-1">Please select a company to view compliance data.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance</h1>
          <p className="text-muted-foreground text-sm">Track regulatory compliance and audits</p>
        </div>
        <div className="flex gap-2">
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['compliance'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Run Compliance Check
          </Button>
          <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Item
          </Button>
        </div>
      </div>

      {/* Score Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <ShieldCheck className="h-6 w-6 mb-2 opacity-80" />
            {isLoading ? (
              <Skeleton className="h-8 w-16 bg-white/20" />
            ) : (
              <p className="text-3xl font-bold">{complianceScore}%</p>
            )}
            <p className="text-sm opacity-80">Compliance Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            {isLoading ? (
              <Skeleton className="h-7 w-8 mx-auto" />
            ) : (
              <p className="text-2xl font-bold">{completedCount}</p>
            )}
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            {isLoading ? (
              <Skeleton className="h-7 w-8 mx-auto" />
            ) : (
              <p className="text-2xl font-bold">{pendingCount}</p>
            )}
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-red-600 mb-1" />
            <p className="text-2xl font-bold">{REGULATORY_ALERTS.filter(a => a.severity === 'high').length}</p>
            <p className="text-xs text-muted-foreground">Critical Alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Failed to load compliance data</p>
              <p className="text-xs text-red-600 dark:text-red-400">{error.message}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['compliance'] })}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="checklist" className="space-y-4">
        <TabsList>
          <TabsTrigger value="checklist">Compliance Checklist</TabsTrigger>
          <TabsTrigger value="alerts">Regulatory Alerts</TabsTrigger>
          <TabsTrigger value="audit">Audit Status</TabsTrigger>
          <TabsTrigger value="retention">Document Retention</TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="space-y-3">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : complianceItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No Compliance Items</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first compliance item to get started.</p>
                <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Create Compliance Item
                </Button>
              </CardContent>
            </Card>
          ) : (
            complianceItems.map(item => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {item.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      ) : item.status === 'in_progress' ? (
                        <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-slate-400 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{item.category}</span>
                          <span>·</span>
                          <span>Due: {item.dueDate}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] ${
                        item.priority === 'high' ? 'bg-red-100 text-red-800' : item.priority === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                      }`}>{item.priority}</Badge>
                      <Badge className={`text-[10px] ${
                        item.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : item.status === 'in_progress' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                      }`}>{item.status.replace('_', ' ')}</Badge>
                      {item.status !== 'completed' && (
                        <Select
                          onValueChange={(value) => handleStatusUpdate(item.id, value)}
                          value={item.status}
                        >
                          <SelectTrigger className="h-7 w-auto text-xs border-0 p-0 gap-1 shadow-none focus:ring-0">
                            <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Update</span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-3">
          {REGULATORY_ALERTS.map(alert => (
            <Card key={alert.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    alert.severity === 'high' ? 'bg-red-50 dark:bg-red-950/30' : alert.severity === 'medium' ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-green-50 dark:bg-green-950/30'
                  }`}>
                    <Bell className={`h-4 w-4 ${
                      alert.severity === 'high' ? 'text-red-600' : alert.severity === 'medium' ? 'text-amber-600' : 'text-green-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <Badge className={`text-[10px] ${
                        alert.severity === 'high' ? 'bg-red-100 text-red-800' : alert.severity === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                      }`}>{alert.severity}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{alert.date}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0"><ExternalLink className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="space-y-3">
          {AUDIT_STATUS.map(audit => (
            <Card key={audit.name}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{audit.name}</p>
                    <p className="text-xs text-muted-foreground">{audit.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs">
                      <span className="text-muted-foreground">Findings: </span>
                      <span className="font-medium">{audit.findings}</span>
                      <span className="text-muted-foreground ml-2">Resolved: </span>
                      <span className="font-medium text-emerald-600">{audit.resolved}</span>
                    </div>
                    <Badge className={`text-[10px] ${
                      audit.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : audit.status === 'in_progress' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                    }`}>{audit.status.replace('_', ' ')}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="retention" className="space-y-3">
          {DOCUMENT_RETENTION.map(doc => (
            <Card key={doc.type}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{doc.type}</p>
                      <p className="text-xs text-muted-foreground">Retention: {doc.retention} · {(doc.documents ?? 0).toLocaleString()} documents</p>
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${
                    doc.status === 'compliant' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {doc.status === 'compliant' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                    {doc.status === 'compliant' ? 'Compliant' : 'Action Needed'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Create Compliance Item Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Compliance Item</DialogTitle>
            <DialogDescription>Add a new compliance checklist item to track.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Annual Fire Safety Inspection"
                value={newItem.title}
                onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the compliance requirement..."
                value={newItem.description}
                onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={newItem.category}
                  onValueChange={(value) => setNewItem(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Safety">Safety</SelectItem>
                    <SelectItem value="Data Privacy">Data Privacy</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Financial">Financial</SelectItem>
                    <SelectItem value="Training">Training</SelectItem>
                    <SelectItem value="Security">Security</SelectItem>
                    <SelectItem value="Legal">Legal</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={newItem.priority}
                  onValueChange={(value) => setNewItem(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={newItem.dueDate}
                onChange={(e) => setNewItem(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
