'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getOnboardingTasks, createOnboardingTask, updateOnboardingTask } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  UserPlus, CheckCircle2, Clock, FileText, Laptop,
  Users, BookOpen, ClipboardList, ChevronRight, Plus, Loader2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
  pending: 'bg-slate-100 text-slate-800 dark:bg-slate-950/30 dark:text-slate-400',
  upcoming: 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
  pending: 'bg-slate-100 text-slate-800 dark:bg-slate-950/30 dark:text-slate-400',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Documentation: <FileText className="h-4 w-4" />,
  IT: <Laptop className="h-4 w-4" />,
  Orientation: <Users className="h-4 w-4" />,
  Training: <BookOpen className="h-4 w-4" />,
  Setup: <ClipboardList className="h-4 w-4" />,
  Review: <CheckCircle2 className="h-4 w-4" />,
};

interface OnboardingEmployee {
  id: string; employeeName: string; designation: string; department: string;
  startDate: string; progress: number; status: string;
  tasks: { total: number; completed: number };
}

interface OnboardingTask {
  id: string; taskName: string; category: string; assignee: string; status: string;
  employeeId: string;
}

export function Onboarding() {
  const { user, currentCompany } = useAppStore();
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', category: 'general', dueDate: '',
  });

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getOnboardingTasks({ companyId: currentCompany?.id });
      const taskData = (res as { data: OnboardingTask[] }).data || [];
      setTasks(taskData);
      if (taskData.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(taskData[0].employeeId);
      }
    } catch {
      toast.error('Failed to load onboarding data');
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Group tasks by employee
  const employeeMap = new Map<string, { id: string; name: string; tasks: OnboardingTask[] }>();
  tasks.forEach(task => {
    if (!employeeMap.has(task.employeeId)) {
      employeeMap.set(task.employeeId, {
        id: task.employeeId,
        name: task.employeeId,
        tasks: [],
      });
    }
    employeeMap.get(task.employeeId)!.tasks.push(task);
  });

  const employees: OnboardingEmployee[] = Array.from(employeeMap.entries()).map(([id, data]) => {
    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter(t => t.status === 'completed').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const hasPending = data.tasks.some(t => t.status === 'pending');
    const hasInProgress = data.tasks.some(t => t.status === 'in_progress');
    const status = progress === 100 ? 'completed' : hasInProgress ? 'in_progress' : hasPending ? 'in_progress' : 'upcoming';
    return {
      id,
      employeeName: data.name,
      designation: 'New Hire',
      department: 'N/A',
      startDate: '',
      progress,
      status,
      tasks: { total: totalTasks, completed: completedTasks },
    };
  });

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0];
  const selectedTasks = tasks.filter(t => t.employeeId === selectedEmployeeId);

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'completed' ? 'pending' : currentStatus === 'pending' ? 'in_progress' : 'completed';
      await updateOnboardingTask(taskId, { status: newStatus });
      toast.success('Task status updated');
      fetchTasks();
    } catch {
      toast.error('Failed to update task');
    }
  };

  const handleCreateTask = async () => {
    try {
      setSubmitting(true);
      await createOnboardingTask({
        ...taskForm,
        dueDate: taskForm.dueDate || undefined,
        status: 'pending',
      });
      toast.success('Onboarding task created');
      setShowCreateTask(false);
      setTaskForm({ title: '', description: '', category: 'general', dueDate: '' });
      fetchTasks();
    } catch {
      toast.error('Failed to create onboarding task');
    } finally {
      setSubmitting(false);
    }
  };

  const inProgressCount = employees.filter(e => e.status === 'in_progress').length;
  const upcomingCount = employees.filter(e => e.status === 'upcoming').length;
  const completedCount = employees.filter(e => e.status === 'completed').length;
  const avgCompletion = employees.length > 0 ? Math.round(employees.reduce((s, e) => s + e.progress, 0) / employees.length) : 0;

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
          <h1 className="text-2xl font-bold tracking-tight">Onboarding</h1>
          <p className="text-muted-foreground text-sm">Manage new employee onboarding process</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowCreateTask(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <UserPlus className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-2xl font-bold">{inProgressCount}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">{upcomingCount}</p>
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-teal-600 mb-1" />
            <p className="text-2xl font-bold">{completedCount}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ClipboardList className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            <p className="text-2xl font-bold">{avgCompletion}%</p>
            <p className="text-xs text-muted-foreground">Avg Completion</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Employee List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New Hires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {employees.map(emp => (
              <div
                key={emp.id}
                onClick={() => setSelectedEmployeeId(emp.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedEmployeeId === emp.id ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-border hover:bg-accent/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-sm font-medium">{emp.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{emp.designation} · {emp.department}</p>
                  </div>
                  <Badge className={`text-[10px] ${STATUS_COLORS[emp.status] || ''}`}>{emp.status.replace('_', ' ')}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={emp.progress} className="h-1.5 flex-1" />
                  <span className="text-[10px] text-muted-foreground">{emp.progress}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{emp.tasks.completed}/{emp.tasks.total} tasks</p>
              </div>
            ))}
            {employees.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No onboarding records found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task Checklist */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Onboarding Checklist — {selectedEmployee?.employeeName || 'Select Employee'}</CardTitle>
                <CardDescription>{selectedEmployee?.designation} · {selectedEmployee?.department}</CardDescription>
              </div>
              {selectedEmployee && (
                <Badge className={STATUS_COLORS[selectedEmployee.status] || ''}>{selectedEmployee.status.replace('_', ' ')}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto space-y-2">
            {selectedTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors">
                <button
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    task.status === 'completed' ? 'bg-emerald-500 border-emerald-500' :
                    task.status === 'in_progress' ? 'border-amber-500' : 'border-muted-foreground/30'
                  }`}
                  onClick={() => handleToggleTask(task.id, task.status)}
                >
                  {task.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-white" />}
                  {task.status === 'in_progress' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                </button>
                <div className="flex-1">
                  <p className={`text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{task.taskName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px] h-4">{task.category}</Badge>
                    <span>Assignee: {task.assignee}</span>
                  </div>
                </div>
                <Badge className={`text-[10px] ${TASK_STATUS_COLORS[task.status] || ''}`}>{task.status.replace('_', ' ')}</Badge>
              </div>
            ))}
            {selectedTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No tasks found for this employee
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Create Task Dialog */}
      <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Onboarding Task</DialogTitle>
            <DialogDescription>Add a new task to the onboarding template</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Title</Label>
              <Input placeholder="Task title" value={taskForm.title} onChange={(e) => setTaskForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Description</Label>
              <Input placeholder="Task description" value={taskForm.description} onChange={(e) => setTaskForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Category</Label>
                <Select value={taskForm.category} onValueChange={(v) => setTaskForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="it_setup">IT Setup</SelectItem>
                    <SelectItem value="hr_orientation">HR Orientation</SelectItem>
                    <SelectItem value="department_intro">Department Intro</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Due Date</Label>
                <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateTask} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
