'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getGoals, createGoal, updateGoal } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { TrendingUp, Target, Award, Brain, ChevronRight, Star, Users, BarChart3, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { toast } from 'sonner';

const REVIEW_CYCLES = [
  { name: 'Q4 2024 Performance Review', period: 'Oct - Dec 2024', status: 'completed', completion: 100 },
  { name: 'Q1 2025 Mid-Year Review', period: 'Jan - Mar 2025', status: 'in_progress', completion: 45 },
  { name: 'Q2 2025 Annual Review', period: 'Apr - Jun 2025', status: 'upcoming', completion: 0 },
];

const PERFORMANCE_DISTRIBUTION = [
  { rating: 'Exceptional', count: 8, color: '#059669' },
  { rating: 'Exceeds', count: 22, color: '#10b981' },
  { rating: 'Meets', count: 45, color: '#f59e0b' },
  { rating: 'Needs Improvement', count: 15, color: '#f97316' },
  { rating: 'Below', count: 5, color: '#ef4444' },
];

const performanceTrendData = [
  { quarter: 'Q1 2024', avg: 3.6 },
  { quarter: 'Q2 2024', avg: 3.7 },
  { quarter: 'Q3 2024', avg: 3.8 },
  { quarter: 'Q4 2024', avg: 3.9 },
  { quarter: 'Q1 2025', avg: 4.0 },
];

interface GoalData {
  id: string; title: string; description?: string; type: string; status: string; progress: number;
  owner?: { id: string; firstName: string; lastName: string } | string;
  keyResults?: { kr: string; progress: number }[];
}

export function Performance() {
  const { currentCompany, user } = useAppStore();
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'okr' });

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getGoals({ companyId: currentCompany?.id });
      setGoals((res as { data: GoalData[] }).data || []);
    } catch {
      toast.error('Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleCreateGoal = async () => {
    const employeeId = user?.employeeId;
    if (!employeeId) {
      toast.error('Employee ID not found. Please log in again.');
      return;
    }
    try {
      setSubmitting(true);
      await createGoal({
        ...form,
        progress: 0,
        status: 'active',
        employeeId,
        companyId: currentCompany?.id,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 90 * 24 * 3600000).toISOString(),
      });
      toast.success('Goal created successfully');
      setShowCreateDialog(false);
      setForm({ title: '', description: '', type: 'okr' });
      fetchGoals();
    } catch {
      toast.error('Failed to create goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProgress = async (id: string, progress: number) => {
    try {
      await updateGoal(id, { progress, status: progress >= 100 ? 'completed' : 'active' });
      toast.success('Progress updated');
      fetchGoals();
    } catch {
      toast.error('Failed to update progress');
    }
  };

  const getOwnerName = (goal: GoalData) => {
    if (!goal.owner) return 'Unassigned';
    if (typeof goal.owner === 'string') return goal.owner;
    return `${goal.owner.firstName} ${goal.owner.lastName}`;
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
          <h1 className="text-2xl font-bold tracking-tight">Performance Management</h1>
          <p className="text-muted-foreground text-sm">Track OKRs, manage reviews, and drive growth</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowCreateDialog(true)}>
          <Target className="h-4 w-4 mr-2" /> Create OKR
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-2xl font-bold">{goals.length}</p>
            <p className="text-xs text-muted-foreground">Active OKRs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            <p className="text-2xl font-bold">4.0</p>
            <p className="text-xs text-muted-foreground">Avg Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">45%</p>
            <p className="text-xs text-muted-foreground">Review Completion</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="h-5 w-5 mx-auto text-teal-600 mb-1" />
            <p className="text-2xl font-bold">8</p>
            <p className="text-xs text-muted-foreground">Top Performers</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="okrs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="okrs">OKR Tracking</TabsTrigger>
          <TabsTrigger value="reviews">Review Cycles</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="okrs" className="space-y-4">
          {goals.map(goal => (
            <Card key={goal.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-semibold text-sm">{goal.title}</h3>
                    <p className="text-xs text-muted-foreground">Owner: {getOwnerName(goal)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                      {goal.progress || 0}% Complete
                    </Badge>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={goal.progress || 0}
                      onChange={(e) => handleUpdateProgress(goal.id, parseInt(e.target.value) || 0)}
                      className="w-20 h-8 text-xs"
                    />
                  </div>
                </div>
                <Progress value={goal.progress || 0} className="h-2" />
                {goal.description && (
                  <p className="text-xs text-muted-foreground mt-2">{goal.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
          {goals.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No OKRs found. Create one to get started.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          {REVIEW_CYCLES.map(cycle => (
            <Card key={cycle.name}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-sm">{cycle.name}</h3>
                    <p className="text-xs text-muted-foreground">{cycle.period}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={
                      cycle.status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' :
                      cycle.status === 'in_progress' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400' :
                      'bg-slate-100 text-slate-800 dark:bg-slate-950/30 dark:text-slate-400'
                    }>
                      {cycle.status.replace('_', ' ')}
                    </Badge>
                    <div className="w-32">
                      <Progress value={cycle.completion} className="h-2" />
                    </div>
                    <span className="text-xs text-muted-foreground">{cycle.completion}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Performance Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={PERFORMANCE_DISTRIBUTION} cx="50%" cy="50%" outerRadius={90} dataKey="count" nameKey="rating" paddingAngle={2}>
                      {PERFORMANCE_DISTRIBUTION.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Performance Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={performanceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="avg" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-emerald-600" /> AI Performance Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg border border-border bg-emerald-50/50 dark:bg-emerald-950/20">
                <p className="text-sm font-medium">High Potential Identified</p>
                <p className="text-xs text-muted-foreground mt-1">3 employees in Engineering show exceptional growth trajectory. Recommend for leadership development program.</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-amber-50/50 dark:bg-amber-950/20">
                <p className="text-sm font-medium">Performance Risk</p>
                <p className="text-xs text-muted-foreground mt-1">5 employees have declining performance scores over 2 quarters. Suggest intervention meetings.</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-green-50/50 dark:bg-green-950/20">
                <p className="text-sm font-medium">Calibration Recommendation</p>
                <p className="text-xs text-muted-foreground mt-1">Sales team ratings are 15% above company average. Consider calibration session for consistency.</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-teal-50/50 dark:bg-green-950/20">
                <p className="text-sm font-medium">Skill Development</p>
                <p className="text-xs text-muted-foreground mt-1">Leadership skills gap identified in 12 mid-level managers. Recommend enrolling in management training.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create OKR Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create OKR / Goal</DialogTitle>
            <DialogDescription>Define a new objective or key result</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Title</Label>
              <Input placeholder="Objective title" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Description</Label>
              <Input placeholder="Describe the objective" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="okr">OKR</SelectItem>
                  <SelectItem value="individual">Individual Goal</SelectItem>
                  <SelectItem value="team">Team Goal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateGoal} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Goal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
