'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getJobs, getCandidates, createJob, createCandidate, updateCandidate } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Briefcase, Users, Search, Filter, Plus, MapPin, DollarSign,
  Clock, Star, Brain, ChevronRight, Eye, MessageSquare, CheckCircle2,
  UserPlus, XCircle, Send, Award, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  interviewing: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
  draft: 'bg-slate-100 text-slate-800 dark:bg-slate-950/30 dark:text-slate-400',
  on_hold: 'bg-orange-100 text-orange-800 dark:bg-orange-950/30 dark:text-orange-400',
  closed: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
  high: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
  medium: 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400',
  low: 'bg-slate-100 text-slate-800 dark:bg-slate-950/30 dark:text-slate-400',
};

const PIPELINE_COLUMNS = [
  { key: 'applied', label: 'Applied', icon: <Send className="h-3.5 w-3.5" />, color: 'border-t-green-500' },
  { key: 'screening', label: 'Screening', icon: <Search className="h-3.5 w-3.5" />, color: 'border-t-amber-500' },
  { key: 'shortlisted', label: 'Shortlisted', icon: <Star className="h-3.5 w-3.5" />, color: 'border-t-teal-500' },
  { key: 'interviewing', label: 'Interviewing', icon: <MessageSquare className="h-3.5 w-3.5" />, color: 'border-t-teal-500' },
  { key: 'offered', label: 'Offered', icon: <Award className="h-3.5 w-3.5" />, color: 'border-t-emerald-500' },
  { key: 'hired', label: 'Hired', icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'border-t-green-600' },
];

interface JobData {
  id: string; title: string; department: string | null; location: string | null; employmentType: string | null;
  status: string; priority: string; positions: number; filledPositions: number; _count: { candidates: number };
  postedDate: string | null; closingDate: string | null;
}

interface CandidateData {
  id: string; firstName: string; lastName: string; email: string; status: string;
  currentTitle?: string; currentCompany?: string; aiScore?: number; skillMatch?: number; cultureFit?: number;
  experience?: number; source?: string; jobId?: string;
}

export function Recruitment() {
  const { currentCompany } = useAppStore();
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [showAddJob, setShowAddJob] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: '', department: '', location: '', employmentType: 'full_time',
    priority: 'medium', positions: '1',
  });
  const [candidateForm, setCandidateForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    currentCompany: '', currentTitle: '', experience: '',
    expectedSalary: '', noticePeriod: '', source: 'linkedin',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (currentCompany?.id) params.companyId = currentCompany.id;
      const [jobsRes, candidatesRes] = await Promise.all([
        getJobs(params),
        getCandidates({ companyId: currentCompany?.id }),
      ]);
      setJobs((jobsRes as { data: JobData[] }).data || []);
      setCandidates((candidatesRes as { data: CandidateData[] }).data || []);
    } catch {
      toast.error('Failed to load recruitment data');
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesDept = deptFilter === 'all' || job.department === deptFilter;
    return matchesSearch && matchesStatus && matchesDept;
  });

  const departments = [...new Set(jobs.map(j => j.department).filter(Boolean) as string[])].filter(d => d && d.trim());

  const handleCreateJob = async () => {
    try {
      setSubmitting(true);
      await createJob({
        ...jobForm,
        companyId: currentCompany?.id,
        positions: parseInt(jobForm.positions) || 1,
        status: 'draft',
      });
      toast.success('Job posting created');
      setShowAddJob(false);
      setJobForm({ title: '', department: '', location: '', employmentType: 'full_time', priority: 'medium', positions: '1' });
      fetchData();
    } catch {
      toast.error('Failed to create job posting');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAddCandidate = (jobId: string) => {
    setSelectedJobId(jobId);
    setCandidateForm({
      firstName: '', lastName: '', email: '', phone: '',
      currentCompany: '', currentTitle: '', experience: '',
      expectedSalary: '', noticePeriod: '', source: 'linkedin',
    });
    setShowAddCandidate(true);
  };

  const handleCreateCandidate = async () => {
    try {
      setSubmitting(true);
      await createCandidate({
        ...candidateForm,
        jobId: selectedJobId,
        experience: candidateForm.experience ? parseInt(candidateForm.experience) : undefined,
        expectedSalary: candidateForm.expectedSalary ? parseFloat(candidateForm.expectedSalary) : undefined,
        status: 'applied',
      });
      toast.success('Candidate added successfully');
      setShowAddCandidate(false);
      setCandidateForm({
        firstName: '', lastName: '', email: '', phone: '',
        currentCompany: '', currentTitle: '', experience: '',
        expectedSalary: '', noticePeriod: '', source: 'linkedin',
      });
      fetchData();
    } catch {
      toast.error('Failed to add candidate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (candidateId: string, newStatus: string) => {
    try {
      await updateCandidate(candidateId, { status: newStatus });
      toast.success(`Candidate moved to ${newStatus}`);
      fetchData();
    } catch {
      toast.error('Failed to update candidate status');
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
          <h1 className="text-2xl font-bold tracking-tight">Recruitment (ATS)</h1>
          <p className="text-muted-foreground text-sm">Manage job openings and candidate pipeline</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowAddJob(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Job Posting
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Briefcase className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-2xl font-bold">{jobs.filter(j => j.status === 'open').length}</p>
            <p className="text-xs text-muted-foreground">Open Positions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">{candidates.length}</p>
            <p className="text-xs text-muted-foreground">Active Candidates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            <p className="text-2xl font-bold">{candidates.filter(c => c.status === 'interviewing').length}</p>
            <p className="text-xs text-muted-foreground">In Interview</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-teal-600 mb-1" />
            <p className="text-2xl font-bold">{candidates.filter(c => c.status === 'offered').length}</p>
            <p className="text-xs text-muted-foreground">Offers Extended</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs">Job Listings</TabsTrigger>
          <TabsTrigger value="pipeline">Candidate Pipeline</TabsTrigger>
          <TabsTrigger value="ai_scores">AI Scores</TabsTrigger>
        </TabsList>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="interviewing">Interviewing</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.filter(d => d && d.trim()).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Job Cards */}
          <div className="space-y-3">
            {filteredJobs.map(job => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{job.title}</h3>
                        <Badge className={`text-[10px] ${STATUS_COLORS[job.status] || ''}`}>{job.status}</Badge>
                        <Badge className={`text-[10px] ${PRIORITY_COLORS[job.priority] || ''}`}>{job.priority}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{job.department || 'N/A'}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location || 'Remote'}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{job._count?.candidates || 0} applicants</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleOpenAddCandidate(job.id)}>
                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Candidate
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Pipeline Tab - Kanban */}
        <TabsContent value="pipeline">
          <div className="overflow-x-auto">
            <div className="flex gap-4 min-w-[900px] pb-4">
              {PIPELINE_COLUMNS.map(column => {
                const columnCandidates = candidates.filter(c => c.status === column.key);
                return (
                  <div key={column.key} className="flex-1 min-w-[200px]">
                    <div className={`border-t-4 ${column.color} rounded-t-lg`}>
                      <div className="bg-card border border-t-0 border-border rounded-b-lg">
                        <div className="p-3 border-b border-border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {column.icon}
                            <span className="text-sm font-medium">{column.label}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs h-5">{columnCandidates.length}</Badge>
                        </div>
                        <div className="p-2 space-y-2 max-h-96 overflow-y-auto">
                          {columnCandidates.map(candidate => (
                            <Card key={candidate.id} className="hover:shadow-md transition-shadow cursor-pointer">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                                    {candidate.firstName[0]}{candidate.lastName[0]}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{candidate.firstName} {candidate.lastName}</p>
                                    <p className="text-[10px] text-muted-foreground">{candidate.currentTitle || 'N/A'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-[10px] text-muted-foreground">{candidate.currentCompany || 'N/A'}</span>
                                  <Badge variant="secondary" className="text-[10px] h-5">
                                    Score: {candidate.aiScore || 0}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          {columnCandidates.length === 0 && (
                            <div className="text-center py-6 text-muted-foreground text-xs">
                              No candidates
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* AI Scores Tab */}
        <TabsContent value="ai_scores" className="space-y-4">
          {candidates.map(candidate => (
            <Card key={candidate.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      {candidate.firstName[0]}{candidate.lastName[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{candidate.firstName} {candidate.lastName}</p>
                      <p className="text-xs text-muted-foreground">{candidate.currentTitle || 'N/A'} at {candidate.currentCompany || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-4">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Skill Match</span>
                        <span className="font-medium">{candidate.skillMatch || 0}%</span>
                      </div>
                      <Progress value={candidate.skillMatch || 0} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Culture Fit</span>
                        <span className="font-medium">{candidate.cultureFit || 0}%</span>
                      </div>
                      <Progress value={candidate.cultureFit || 0} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>AI Score</span>
                        <span className="font-medium">{candidate.aiScore || 0}%</span>
                      </div>
                      <Progress value={candidate.aiScore || 0} className="h-2" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${(candidate.aiScore || 0) >= 90 ? 'bg-emerald-100 text-emerald-800' : (candidate.aiScore || 0) >= 80 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'}`}>
                      <Brain className="h-3 w-3 mr-1" /> {(candidate.aiScore || 0) >= 90 ? 'Strong Match' : (candidate.aiScore || 0) >= 80 ? 'Good Match' : 'Fair Match'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Add Candidate Dialog */}
      <Dialog open={showAddCandidate} onOpenChange={setShowAddCandidate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
            <DialogDescription>Add a new candidate to the recruitment pipeline</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">First Name</Label>
                <Input placeholder="First name" value={candidateForm.firstName} onChange={(e) => setCandidateForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Last Name</Label>
                <Input placeholder="Last name" value={candidateForm.lastName} onChange={(e) => setCandidateForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Email</Label>
                <Input type="email" placeholder="Email" value={candidateForm.email} onChange={(e) => setCandidateForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Phone</Label>
                <Input placeholder="Phone" value={candidateForm.phone} onChange={(e) => setCandidateForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Current Company</Label>
                <Input placeholder="Company" value={candidateForm.currentCompany} onChange={(e) => setCandidateForm(f => ({ ...f, currentCompany: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Current Title</Label>
                <Input placeholder="Job title" value={candidateForm.currentTitle} onChange={(e) => setCandidateForm(f => ({ ...f, currentTitle: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Experience (yrs)</Label>
                <Input type="number" placeholder="0" value={candidateForm.experience} onChange={(e) => setCandidateForm(f => ({ ...f, experience: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Expected Salary</Label>
                <Input type="number" placeholder="0" value={candidateForm.expectedSalary} onChange={(e) => setCandidateForm(f => ({ ...f, expectedSalary: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Notice Period</Label>
                <Input placeholder="e.g. 30 days" value={candidateForm.noticePeriod} onChange={(e) => setCandidateForm(f => ({ ...f, noticePeriod: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Source</Label>
              <Select value={candidateForm.source} onValueChange={(v) => setCandidateForm(f => ({ ...f, source: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="website">Company Website</SelectItem>
                  <SelectItem value="job_board">Job Board</SelectItem>
                  <SelectItem value="agency">Recruitment Agency</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateCandidate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Candidate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Job Dialog */}
      <Dialog open={showAddJob} onOpenChange={setShowAddJob}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Job Posting</DialogTitle>
            <DialogDescription>Add a new job opening to the recruitment pipeline</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Job Title</Label>
              <Input placeholder="e.g. Senior Developer" value={jobForm.title} onChange={(e) => setJobForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Department</Label>
                <Input placeholder="Department" value={jobForm.department} onChange={(e) => setJobForm(f => ({ ...f, department: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Location</Label>
                <Input placeholder="Location" value={jobForm.location} onChange={(e) => setJobForm(f => ({ ...f, location: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Type</Label>
                <Select value={jobForm.employmentType} onValueChange={(v) => setJobForm(f => ({ ...f, employmentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full-time</SelectItem>
                    <SelectItem value="part_time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Priority</Label>
                <Select value={jobForm.priority} onValueChange={(v) => setJobForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Positions</Label>
                <Input type="number" value={jobForm.positions} onChange={(e) => setJobForm(f => ({ ...f, positions: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateJob} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Job Posting
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
