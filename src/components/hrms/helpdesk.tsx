'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getTickets, createTicket, updateTicket } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Headphones, Plus, Search, Clock, CheckCircle2, AlertCircle,
  MessageSquare, ArrowUp, ArrowRight, ArrowDown, Filter, Loader2
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';

const PRIORITY_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  high: { icon: <ArrowUp className="h-3.5 w-3.5" />, color: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400' },
  medium: { icon: <ArrowRight className="h-3.5 w-3.5" />, color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400' },
  low: { icon: <ArrowDown className="h-3.5 w-3.5" />, color: 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400' },
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  closed: 'bg-slate-100 text-slate-800 dark:bg-slate-950/30 dark:text-slate-400',
};

const CATEGORY_DATA = [
  { name: 'IT Support', value: 35, color: '#059669' },
  { name: 'HR', value: 25, color: '#3b82f6' },
  { name: 'Finance', value: 15, color: '#f59e0b' },
  { name: 'Admin', value: 15, color: '#8b5cf6' },
  { name: 'Facilities', value: 10, color: '#ef4444' },
];

interface TicketData {
  id: string; subject: string; category: string; priority: string; status: string;
  created: string; assignee: string; sla: string; description?: string;
}

export function Helpdesk() {
  const { user, currentCompany } = useAppStore();
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    subject: '', category: 'IT Support', priority: 'medium', description: '',
  });

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getTickets({ companyId: currentCompany?.id });
      setTickets((res as { data: TicketData[] }).data || []);
    } catch {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const handleCreateTicket = async () => {
    const employeeId = user?.employeeId;
    if (!employeeId) {
      toast.error('Employee ID not found. Please log in again.');
      return;
    }
    try {
      setSubmitting(true);
      await createTicket({
        ...form,
        employeeId,
        status: 'open',
      });
      toast.success('Ticket created successfully');
      setShowCreateDialog(false);
      setForm({ subject: '', category: 'IT Support', priority: 'medium', description: '' });
      fetchTickets();
    } catch {
      toast.error('Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateTicket(id, { status });
      toast.success(`Ticket status updated to ${status}`);
      fetchTickets();
    } catch {
      toast.error('Failed to update ticket status');
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
          <h1 className="text-2xl font-bold tracking-tight">Helpdesk</h1>
          <p className="text-muted-foreground text-sm">Manage support tickets and SLA compliance</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Ticket
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <AlertCircle className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">{tickets.filter(t => t.status === 'open').length}</p>
            <p className="text-xs text-muted-foreground">Open Tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            <p className="text-2xl font-bold">{tickets.filter(t => t.status === 'in_progress').length}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-2xl font-bold">{tickets.filter(t => t.status === 'resolved').length}</p>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MessageSquare className="h-5 w-5 mx-auto text-teal-600 mb-1" />
            <p className="text-2xl font-bold">92%</p>
            <p className="text-xs text-muted-foreground">SLA Compliance</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ticket List */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search tickets..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto space-y-2">
            {filteredTickets.map(ticket => {
              const priorityCfg = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
              return (
                <div key={ticket.id} className="p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{ticket.id?.slice(0, 8)}</span>
                      <Badge className={`text-[10px] ${priorityCfg.color}`}>
                        {priorityCfg.icon} {ticket.priority}
                      </Badge>
                      <Badge className={`text-[10px] ${STATUS_COLORS[ticket.status] || ''}`}>{ticket.status.replace('_', ' ')}</Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{ticket.created || ''}</span>
                  </div>
                  <p className="text-sm font-medium">{ticket.subject}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{ticket.category}</span>
                    <span>·</span>
                    <span>{ticket.assignee || 'Unassigned'}</span>
                    <span>·</span>
                    <span>{ticket.sla || 'N/A'}</span>
                  </div>
                  {ticket.status === 'open' && (
                    <div className="mt-2 flex gap-1">
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleStatusUpdate(ticket.id, 'in_progress')}>Start Progress</Button>
                    </div>
                  )}
                  {ticket.status === 'in_progress' && (
                    <div className="mt-2 flex gap-1">
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleStatusUpdate(ticket.id, 'resolved')}>Resolve</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={CATEGORY_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={2}>
                  {CATEGORY_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Create Ticket Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription>Submit a new support request</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Subject</Label>
              <Input placeholder="Brief description of the issue" value={form.subject} onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IT Support">IT Support</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Facilities">Facilities</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Description</Label>
              <Input placeholder="Detailed description of the issue" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateTicket} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
