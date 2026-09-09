'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getLeaves, applyLeave, approveRejectLeave } from '@/lib/api';
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
  CalendarDays, CheckCircle2, XCircle, Clock, Plus,
  TrendingUp, Sun, Heart, Baby, Gift, Calendar, Loader2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { toast } from 'sonner';

const LEAVE_STATUS_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
};

const LEAVE_BALANCE = [
  { type: 'Casual Leave', total: 12, used: 5, remaining: 7, icon: <Sun className="h-4 w-4" />, color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30' },
  { type: 'Sick Leave', total: 10, used: 2, remaining: 8, icon: <Heart className="h-4 w-4" />, color: 'bg-red-50 text-red-600 dark:bg-red-950/30' },
  { type: 'Paid Leave', total: 15, used: 3, remaining: 12, icon: <CalendarDays className="h-4 w-4" />, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' },
  { type: 'Maternity/Paternity', total: 180, used: 0, remaining: 180, icon: <Baby className="h-4 w-4" />, color: 'bg-teal-50 text-teal-600 dark:bg-green-950/30' },
  { type: 'Comp Off', total: 5, used: 1, remaining: 4, icon: <Gift className="h-4 w-4" />, color: 'bg-green-50 text-green-600 dark:bg-green-950/30' },
];

const leaveTrendData = [
  { month: 'Aug', requests: 45 },
  { month: 'Sep', requests: 52 },
  { month: 'Oct', requests: 38 },
  { month: 'Nov', requests: 41 },
  { month: 'Dec', requests: 67 },
  { month: 'Jan', requests: 55 },
];

const calendarDays = Array.from({ length: 31 }, (_, i) => i + 1);
const weekends = [4, 5, 11, 12, 18, 19, 25, 26];
const leaveDays = [20, 21, 22, 23, 25];

interface LeaveData {
  id: string; type: string; startDate: string; endDate: string; totalDays: number;
  reason: string; status: string;
  employee: { id: string; firstName: string; lastName: string } | string;
}

export function Leave() {
  const { user, currentCompany } = useAppStore();
  const [leaves, setLeaves] = useState<LeaveData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: 'casual', startDate: '', endDate: '', reason: '',
  });

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getLeaves({ companyId: currentCompany?.id });
      setLeaves((res as { data: LeaveData[] }).data || []);
    } catch {
      toast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  const getEmployeeName = (leave: LeaveData) => {
    if (typeof leave.employee === 'string') return leave.employee;
    return `${leave.employee.firstName} ${leave.employee.lastName}`;
  };

  const handleApplyLeave = async () => {
    const employeeId = user?.employeeId;
    if (!employeeId) {
      toast.error('Employee ID not found. Please log in again.');
      return;
    }
    try {
      setSubmitting(true);
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);
      const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      await applyLeave({
        ...form,
        totalDays,
        employeeId,
        createWorkflow: true,
        status: 'pending',
      });
      toast.success('Leave application submitted');
      setShowApplyDialog(false);
      setForm({ type: 'casual', startDate: '', endDate: '', reason: '' });
      fetchLeaves();
    } catch {
      toast.error('Failed to apply leave');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveReject = async (id: string, action: 'approve' | 'reject') => {
    try {
      await approveRejectLeave(id, action);
      toast.success(`Leave ${action === 'approve' ? 'approved' : 'rejected'}`);
      fetchLeaves();
    } catch {
      toast.error(`Failed to ${action} leave`);
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
          <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground text-sm">Track leave balances and manage requests</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowApplyDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Apply Leave
        </Button>
      </div>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {LEAVE_BALANCE.map(leave => (
          <Card key={leave.type}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-1.5 rounded ${leave.color}`}>{leave.icon}</div>
                <span className="text-xs font-medium text-muted-foreground">{leave.type}</span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold">{leave.remaining}</p>
                  <p className="text-[10px] text-muted-foreground">remaining of {leave.total}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-muted-foreground">{leave.used}</p>
                  <p className="text-[10px] text-muted-foreground">used</p>
                </div>
              </div>
              <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(leave.used / leave.total) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">Leave Requests</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="trends">AI Leave Trends</TabsTrigger>
        </TabsList>

        {/* Leave Requests */}
        <TabsContent value="requests" className="space-y-3">
          {leaves.map(leave => (
            <Card key={leave.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{getEmployeeName(leave)}</h3>
                      <Badge className={`text-[10px] ${LEAVE_STATUS_COLORS[leave.status]}`}>
                        {leave.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{leave.type}</span>
                      <span>{leave.startDate} → {leave.endDate}</span>
                      <span>{leave.totalDays} day{leave.totalDays > 1 ? 's' : ''}</span>
                      <span>Reason: {leave.reason}</span>
                    </div>
                  </div>
                  {leave.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50" onClick={() => handleApproveReject(leave.id, 'approve')}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => handleApproveReject(leave.id, 'reject')}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Calendar View */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" /> January 2025
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="text-xs font-medium text-muted-foreground py-1">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                <div /><div />
                {calendarDays.map(day => {
                  const isWeekend = weekends.includes(day);
                  const isLeave = leaveDays.includes(day);
                  return (
                    <div
                      key={day}
                      className={`aspect-square flex items-center justify-center text-sm rounded-md transition-colors ${
                        isLeave ? 'bg-amber-100 text-amber-800 font-semibold dark:bg-amber-950/30 dark:text-amber-400' :
                        isWeekend ? 'bg-muted text-muted-foreground' :
                        'hover:bg-accent'
                      }`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-950/30" /> Leave Day</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-muted" /> Weekend</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-background border" /> Working Day</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Leave Trends */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" /> AI Leave Trend Predictions
              </CardTitle>
              <CardDescription>Machine learning predicts leave patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={leaveTrendData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="requests" stroke="#059669" strokeWidth={2} dot={{ fill: '#059669', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">AI Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-border bg-emerald-50/50 dark:bg-emerald-950/20">
                  <p className="text-sm font-medium">Peak Leave Period</p>
                  <p className="text-xs text-muted-foreground mt-1">Expect 30% increase in leave requests during Dec 20-31. Plan staffing accordingly.</p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-amber-50/50 dark:bg-amber-950/20">
                  <p className="text-sm font-medium">Sick Leave Spike</p>
                  <p className="text-xs text-muted-foreground mt-1">Historical data shows increased sick leaves in February. Consider flu vaccination drive.</p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-green-50/50 dark:bg-green-950/20">
                  <p className="text-sm font-medium">Recommendation</p>
                  <p className="text-xs text-muted-foreground mt-1">3 employees in Operations are likely to request long leave in Q2. Plan cross-training now.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Apply Leave Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>Submit a leave request for approval</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Leave Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="paid">Paid Leave</SelectItem>
                  <SelectItem value="maternity">Maternity/Paternity</SelectItem>
                  <SelectItem value="comp_off">Comp Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Start Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">End Date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Reason</Label>
              <Input placeholder="Reason for leave" value={form.reason} onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleApplyLeave} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Leave Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
