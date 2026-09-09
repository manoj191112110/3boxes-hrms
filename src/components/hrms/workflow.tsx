'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  WorkflowIcon, Plus, ArrowRight, CheckCircle2,
  Clock, Eye, BarChart3, Loader2, XCircle, Trash2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getWorkflows, createWorkflowDefinition, processWorkflowStepApi } from '@/lib/api';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400',
};

interface WorkflowDef {
  id: string;
  name: string;
  entity: string;
  description: string | null;
  isActive: boolean;
  _count: { instances: number };
  steps: { id: string; name: string; stepOrder: number; approverRole: string | null }[];
}

interface WorkflowInst {
  id: string;
  status: string;
  currentStep: number;
  initiatedBy: string;
  workflowDef: { id: string; name: string; entity: string };
  steps: { id: string; stepOrder: number; status: string; actionedBy: string | null; comments: string | null; actedAt: string | null }[];
  createdAt: string;
}

interface WorkflowStepInput {
  name: string;
  stepOrder: number;
  approverRole: string;
}

export function Workflow() {
  const { currentCompany } = useAppStore();
  const [definitions, setDefinitions] = useState<WorkflowDef[]>([]);
  const [instances, setInstances] = useState<WorkflowInst[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [workflowForm, setWorkflowForm] = useState({
    name: '', type: 'approval', entity: 'leave', description: '',
  });
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepInput[]>([
    { name: 'Manager Approval', stepOrder: 0, approverRole: 'manager' },
  ]);

  const fetchData = useCallback(async () => {
    try {
      const companyId = currentCompany?.id || '';
      const [defRes, instRes] = await Promise.all([
        getWorkflows({ companyId, type: 'definitions' }),
        getWorkflows({ companyId, type: 'instances' }),
      ]);
      const defJson = defRes as { data?: WorkflowDef[] };
      const instJson = instRes as { data?: WorkflowInst[] };
      setDefinitions(defJson.data || []);
      setInstances(instJson.data || []);
    } catch (err) {
      console.error('Workflow fetch error:', err);
      toast.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleProcessStep = async (instanceId: string, stepOrder: number, action: 'approve' | 'reject') => {
    try {
      await processWorkflowStepApi({
        instanceId,
        stepOrder,
        action,
        actionedBy: 'current-user',
      });
      toast.success(`Workflow step ${action}d successfully`);
      fetchData();
    } catch {
      toast.error('Failed to process workflow step');
    }
  };

  const handleAddStep = () => {
    setWorkflowSteps(prev => [
      ...prev,
      { name: '', stepOrder: prev.length, approverRole: '' },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setWorkflowSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepOrder: i })));
  };

  const handleStepChange = (index: number, field: keyof WorkflowStepInput, value: string) => {
    setWorkflowSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleCreateWorkflow = async () => {
    try {
      setSubmitting(true);
      await createWorkflowDefinition({
        name: workflowForm.name,
        type: workflowForm.type,
        entity: workflowForm.entity,
        description: workflowForm.description || undefined,
        companyId: currentCompany?.id,
        steps: workflowSteps.map((s, i) => ({
          name: s.name,
          stepOrder: i,
          approverRole: s.approverRole || undefined,
        })),
      });
      toast.success('Workflow definition created');
      setShowCreateDialog(false);
      setWorkflowForm({ name: '', type: 'approval', entity: 'leave', description: '' });
      setWorkflowSteps([{ name: 'Manager Approval', stepOrder: 0, approverRole: 'manager' }]);
      fetchData();
    } catch {
      toast.error('Failed to create workflow definition');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="ml-3 text-muted-foreground">Loading workflows...</span>
      </div>
    );
  }

  const workflowAnalytics = definitions.map(def => ({
    name: def.name.split(' ')[0],
    completed: def._count.instances,
    pending: instances.filter(i => i.workflowDef.id === def.id && i.status === 'pending').length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflow Builder</h1>
          <p className="text-muted-foreground text-sm">Automate HR processes with approval workflows</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Workflow
        </Button>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Workflows</TabsTrigger>
          <TabsTrigger value="definitions">Workflow Definitions</TabsTrigger>
          <TabsTrigger value="builder">Visual Builder</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Active Workflow Instances */}
        <TabsContent value="active" className="space-y-3">
          {instances.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No active workflow instances. Submit a leave, travel, or expense request to start a workflow.
              </CardContent>
            </Card>
          ) : (
            instances.map(inst => (
              <Card key={inst.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-sm">{inst.workflowDef.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        Entity: {inst.workflowDef.entity} · Initiated: {new Date(inst.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        {inst.steps.map((step, i) => (
                          <div
                            key={i}
                            className={`w-3 h-3 rounded-full ${
                              step.status === 'approved' ? 'bg-emerald-500' :
                              step.status === 'rejected' ? 'bg-red-500' :
                              step.stepOrder === inst.currentStep ? 'bg-amber-500' : 'bg-muted'
                            }`}
                            title={`${step.stepOrder}: ${step.status}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">Step {inst.currentStep + 1}/{inst.steps.length}</span>
                      <Badge className={`text-[10px] ${STATUS_COLORS[inst.status] || 'bg-slate-100 text-slate-800'}`}>
                        {inst.status}
                      </Badge>
                      {inst.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 h-7 text-xs"
                            onClick={() => handleProcessStep(inst.id, inst.currentStep, 'approve')}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50 h-7 text-xs"
                            onClick={() => handleProcessStep(inst.id, inst.currentStep, 'reject')}
                          >
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Step details */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {inst.steps.map((step, i) => (
                      <div key={i} className={`text-xs px-2 py-1 rounded ${
                        step.status === 'approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' :
                        step.status === 'rejected' ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400' :
                        step.stepOrder === inst.currentStep ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        <span className="font-medium">Step {step.stepOrder + 1}:</span>{' '}
                        {step.status === 'approved' ? 'Approved' : step.status === 'rejected' ? 'Rejected' : step.stepOrder === inst.currentStep ? 'Pending Your Action' : 'Waiting'}
                        {step.comments && <span className="ml-1 opacity-75">({step.comments})</span>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Workflow Definitions */}
        <TabsContent value="definitions" className="space-y-3">
          {definitions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No workflow definitions configured. Create one to get started.
              </CardContent>
            </Card>
          ) : (
            definitions.map(def => (
              <Card key={def.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{def.name}</h3>
                        <Badge variant="outline" className="text-[10px]">{def.entity}</Badge>
                        <Badge variant="secondary" className={`text-[10px] ${def.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                          {def.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{def.description || `Approval workflow for ${def.entity}`}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{def._count.instances} instances</span>
                  </div>
                  {/* Steps visualization */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {def.steps.map((step, i) => (
                      <React.Fragment key={step.id}>
                        <div className="px-3 py-1.5 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded text-xs font-medium border border-green-200 dark:border-green-800">
                          {step.name}
                          {step.approverRole && <span className="ml-1 opacity-60">({step.approverRole})</span>}
                        </div>
                        {i < def.steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                      </React.Fragment>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Visual Builder Placeholder */}
        <TabsContent value="builder">
          <Card>
            <CardContent className="p-8">
              <div className="border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-xl p-8 text-center bg-emerald-50/50 dark:bg-emerald-950/10">
                <WorkflowIcon className="h-16 w-16 mx-auto text-emerald-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Drag & Drop Workflow Builder</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  Build automated workflows by dragging action blocks, conditions, and triggers onto the canvas.
                  Connect steps to create powerful HR process automations.
                </p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-medium border border-emerald-200 dark:border-emerald-800">
                    Trigger
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="px-4 py-2 bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium border border-green-200 dark:border-green-800">
                    Condition
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="px-4 py-2 bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium border border-amber-200 dark:border-amber-800">
                    Approval
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="px-4 py-2 bg-teal-100 dark:bg-green-950/30 text-teal-700 dark:text-teal-400 rounded-lg text-sm font-medium border border-teal-200 dark:border-teal-800">
                    Notify
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="px-4 py-2 bg-teal-100 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 rounded-lg text-sm font-medium border border-teal-200 dark:border-teal-800">
                    Action
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-600" /> Workflow Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workflowAnalytics.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={workflowAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="completed" fill="#059669" radius={[2, 2, 0, 0]} name="Total Instances" />
                    <Bar dataKey="pending" fill="#f59e0b" radius={[2, 2, 0, 0]} name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  No workflow data yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Workflow Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Workflow</DialogTitle>
            <DialogDescription>Define a new approval workflow for HR processes</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Workflow Name</Label>
              <Input placeholder="e.g. Leave Approval Workflow" value={workflowForm.name} onChange={(e) => setWorkflowForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Type</Label>
                <Select value={workflowForm.type} onValueChange={(v) => setWorkflowForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approval">Approval</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="notification">Notification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Entity</Label>
                <Select value={workflowForm.entity} onValueChange={(v) => setWorkflowForm(f => ({ ...f, entity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">Leave</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="recruitment">Recruitment</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="offboarding">Offboarding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Description</Label>
              <Input placeholder="Optional description" value={workflowForm.description} onChange={(e) => setWorkflowForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            {/* Steps Builder */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Workflow Steps</Label>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAddStep}>
                  <Plus className="h-3 w-3 mr-1" /> Add Step
                </Button>
              </div>
              {workflowSteps.map((step, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6 shrink-0">{index + 1}.</span>
                  <Input
                    placeholder="Step name"
                    value={step.name}
                    onChange={(e) => handleStepChange(index, 'name', e.target.value)}
                    className="flex-1 h-8 text-sm"
                  />
                  <Input
                    placeholder="Approver role"
                    value={step.approverRole}
                    onChange={(e) => handleStepChange(index, 'approverRole', e.target.value)}
                    className="flex-1 h-8 text-sm"
                  />
                  {workflowSteps.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-red-500 hover:text-red-700" onClick={() => handleRemoveStep(index)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateWorkflow} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Workflow
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
