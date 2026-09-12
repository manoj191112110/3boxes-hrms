'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getLearningRecords, createLearningRecord } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { GraduationCap, BookOpen, Award, Clock, Users, Star, Play, CheckCircle2, BarChart3, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { toast } from 'sonner';

const LEARNING_PATHS = [
  { title: 'Engineering Leadership Track', courses: 5, duration: '6 months', enrolled: 12, progress: 40 },
  { title: 'HR Business Partner Certification', courses: 4, duration: '4 months', enrolled: 8, progress: 25 },
  { title: 'Full-Stack Developer Path', courses: 8, duration: '9 months', enrolled: 34, progress: 55 },
];

const SKILL_MATRIX = [
  { skill: 'Leadership', current: 72, required: 85 },
  { skill: 'Communication', current: 80, required: 80 },
  { skill: 'Technical', current: 90, required: 85 },
  { skill: 'Problem Solving', current: 75, required: 80 },
  { skill: 'Innovation', current: 68, required: 75 },
  { skill: 'Teamwork', current: 85, required: 80 },
];

const completionData = [
  { month: 'Aug', rate: 72 },
  { month: 'Sep', rate: 75 },
  { month: 'Oct', rate: 78 },
  { month: 'Nov', rate: 82 },
  { month: 'Dec', rate: 79 },
  { month: 'Jan', rate: 85 },
];

const radarData = SKILL_MATRIX.map(s => ({
  subject: s.skill,
  Current: s.current,
  Required: s.required,
}));

interface LearningData {
  id: string; courseName: string; category: string; duration: string; status: string; progress: number;
  enrolled?: number; rating?: number; level?: string;
}

export function Learning() {
  const { user, currentCompany } = useAppStore();
  const [courses, setCourses] = useState<LearningData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    courseName: '', category: 'Technical', duration: '', level: 'Beginner',
  });

  const fetchLearning = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getLearningRecords({ companyId: currentCompany?.id });
      setCourses((res as { data: LearningData[] }).data || []);
    } catch {
      toast.error('Failed to load learning data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLearning(); }, [fetchLearning]);

  const handleEnroll = async (courseName: string) => {
    const employeeId = user?.employeeId;
    if (!employeeId) {
      toast.error('Employee ID not found. Please log in again.');
      return;
    }
    try {
      await createLearningRecord({
        courseName,
        employeeId,
        status: 'in_progress',
        progress: 0,
        category: form.category,
        companyId: currentCompany?.id,
      });
      toast.success('Enrolled successfully');
      fetchLearning();
    } catch {
      toast.error('Failed to enroll');
    }
  };

  const handleCreateCourse = async () => {
    const employeeId = user?.employeeId;
    if (!employeeId) {
      toast.error('Employee ID not found. Please log in again.');
      return;
    }
    try {
      setSubmitting(true);
      await createLearningRecord({
        ...form,
        employeeId,
        status: 'available',
        progress: 0,
        companyId: currentCompany?.id,
      });
      toast.success('Course created');
      setShowCreateDialog(false);
      setForm({ courseName: '', category: 'Technical', duration: '', level: 'Beginner' });
      fetchLearning();
    } catch {
      toast.error('Failed to create course');
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
          <h1 className="text-2xl font-bold tracking-tight">Learning & Development</h1>
          <p className="text-muted-foreground text-sm">Upskill your workforce with targeted learning programs</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowCreateDialog(true)}>
          <BookOpen className="h-4 w-4 mr-2" /> Create Course
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-2xl font-bold">{courses.length}</p>
            <p className="text-xs text-muted-foreground">Active Courses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">{courses.reduce((s, c) => s + (c.enrolled || 0), 0)}</p>
            <p className="text-xs text-muted-foreground">Total Enrollments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-teal-600 mb-1" />
            <p className="text-2xl font-bold">85%</p>
            <p className="text-xs text-muted-foreground">Completion Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            <p className="text-2xl font-bold">4.6</p>
            <p className="text-xs text-muted-foreground">Avg Rating</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog">Course Catalog</TabsTrigger>
          <TabsTrigger value="paths">Learning Paths</TabsTrigger>
          <TabsTrigger value="skills">Skill Matrix</TabsTrigger>
          <TabsTrigger value="analytics">Completion Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map(course => (
              <Card key={course.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl"><GraduationCap className="h-8 w-8 text-emerald-500" /></span>
                    <Badge variant="secondary" className="text-[10px]">{course.level || 'N/A'}</Badge>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{course.courseName}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{course.category} · {course.duration || 'Self-paced'}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{course.enrolled || 0} enrolled</span>
                    <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500" />{course.rating || 'N/A'}</span>
                  </div>
                  {(course.progress || 0) > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Progress</span>
                        <span className="font-medium">{course.progress}%</span>
                      </div>
                      <Progress value={course.progress || 0} className="h-2" />
                    </div>
                  )}
                  <Button
                    variant={(course.progress || 0) > 0 ? 'default' : 'outline'}
                    size="sm"
                    className="w-full mt-1"
                    onClick={() => {
                      if ((course.progress || 0) === 0) handleEnroll(course.courseName);
                    }}
                  >
                    {(course.progress || 0) === 0 ? 'Enroll' : (course.progress || 0) === 100 ? 'Completed' : 'Continue'}
                    {(course.progress || 0) > 0 && (course.progress || 0) < 100 && <Play className="h-3 w-3 ml-1" />}
                    {(course.progress || 0) === 100 && <CheckCircle2 className="h-3 w-3 ml-1" />}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="paths" className="space-y-3">
          {LEARNING_PATHS.map(path => (
            <Card key={path.title}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-sm">{path.title}</h3>
                    <p className="text-xs text-muted-foreground">{path.courses} courses · {path.duration} · {path.enrolled} enrolled</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32">
                      <Progress value={path.progress} className="h-2" />
                    </div>
                    <span className="text-xs font-medium">{path.progress}%</span>
                    <Button variant="outline" size="sm">View Path</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="skills">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Skill Gap Analysis</CardTitle>
                <CardDescription>Current vs Required skill levels</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 100]} />
                    <Radar name="Current" dataKey="Current" stroke="#059669" fill="#059669" fillOpacity={0.2} />
                    <Radar name="Required" dataKey="Required" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Skill Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {SKILL_MATRIX.map(skill => {
                  const gap = skill.required - skill.current;
                  return (
                    <div key={skill.skill}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{skill.skill}</span>
                        <span className={gap > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                          {gap > 0 ? `Gap: ${gap}%` : 'Meets requirement'}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${skill.current}%` }} />
                        </div>
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${skill.required}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-600" /> Course Completion Rates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={completionData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Completion Rate']} />
                  <Bar dataKey="rate" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Course Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Course</DialogTitle>
            <DialogDescription>Add a new course to the learning catalog</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Course Name</Label>
              <Input placeholder="Course title" value={form.courseName} onChange={(e) => setForm(f => ({ ...f, courseName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technical">Technical</SelectItem>
                    <SelectItem value="Leadership">Leadership</SelectItem>
                    <SelectItem value="Soft Skills">Soft Skills</SelectItem>
                    <SelectItem value="Management">Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Level</Label>
                <Select value={form.level} onValueChange={(v) => setForm(f => ({ ...f, level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Duration</Label>
              <Input placeholder="e.g. 6 weeks" value={form.duration} onChange={(e) => setForm(f => ({ ...f, duration: e.target.value }))} />
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateCourse} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Course
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
