'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Briefcase, Users, Send, Eye, DollarSign, TrendingUp, Plus, Loader2 } from 'lucide-react';
import { getJobs, getCandidates, createCandidate } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { useToast } from '@/hooks/use-toast';

// TODO: Replace with API data once commission tracking endpoint is available
const COMMISSION_DATA = [
  { month: 'Oct 2024', earned: 1200, pending: 300, paid: 900 },
  { month: 'Nov 2024', earned: 1800, pending: 500, paid: 1300 },
  { month: 'Dec 2024', earned: 1500, pending: 200, paid: 1300 },
  { month: 'Jan 2025', earned: 2200, pending: 800, paid: 1400 },
];

interface CandidateFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobId: string;
  resumeUrl: string;
  notes: string;
}

const emptyForm: CandidateFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  jobId: '',
  resumeUrl: '',
  notes: '',
};

export function SubVendorPortal() {
  const { currentCompany } = useAppStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [formState, setFormState] = useState<CandidateFormState>(emptyForm);

  // Fetch open jobs
  const {
    data: jobsData,
    isLoading: jobsLoading,
    error: jobsError,
  } = useQuery({
    queryKey: ['jobs', 'open', currentCompany?.id],
    queryFn: () => getJobs({ status: 'open', companyId: currentCompany?.id }),
    enabled: !!currentCompany?.id,
  });

  // Fetch candidates
  const {
    data: candidatesData,
    isLoading: candidatesLoading,
    error: candidatesError,
  } = useQuery({
    queryKey: ['candidates'],
    queryFn: () => getCandidates({}),
  });

  // Create candidate mutation
  const createCandidateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createCandidate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast({
        title: 'Candidate submitted',
        description: 'The candidate has been successfully submitted.',
      });
      setDialogOpen(false);
      setFormState(emptyForm);
      setSelectedJobId('');
    },
    onError: (err: Error) => {
      toast({
        title: 'Submission failed',
        description: err.message || 'Failed to submit candidate. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const jobs = jobsData?.data ?? [];
  const candidates = (candidatesData as { data?: { id: string; firstName: string; lastName: string; email: string; phone?: string; status: string; jobId?: string; job?: { title: string }; createdAt: string }[] })?.data ?? [];

  // Calculate stats from real data
  const shortlistRate = candidates.length > 0
    ? Math.round(
        (candidates.filter(
          (c) => c.status === 'shortlisted' || c.status === 'interviewing'
        ).length /
          candidates.length) *
          100
      )
    : 0;

  const handleOpenSubmitDialog = (jobId?: string) => {
    if (jobId) {
      setSelectedJobId(jobId);
      setFormState((prev) => ({ ...prev, jobId }));
    }
    setDialogOpen(true);
  };

  const handleSubmitCandidate = () => {
    if (!formState.firstName || !formState.lastName || !formState.email || !formState.jobId) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields (first name, last name, email, and job).',
        variant: 'destructive',
      });
      return;
    }

    createCandidateMutation.mutate({
      firstName: formState.firstName,
      lastName: formState.lastName,
      email: formState.email,
      phone: formState.phone || undefined,
      jobId: formState.jobId,
      resumeUrl: formState.resumeUrl || undefined,
      notes: formState.notes || undefined,
    });
  };

  const hasError = jobsError || candidatesError;

  if (hasError && !jobsData && !candidatesData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sub-Vendor Portal</h1>
          <p className="text-muted-foreground text-sm">Manage your candidate submissions and commissions</p>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <Briefcase className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load portal data. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sub-Vendor Portal</h1>
          <p className="text-muted-foreground text-sm">Manage your candidate submissions and commissions</p>
        </div>
        <Button onClick={() => handleOpenSubmitDialog()} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Submit Candidate
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Briefcase className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            {jobsLoading ? (
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-bold">{jobs.length}</p>
            )}
            <p className="text-xs text-muted-foreground">Assigned Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-green-600 mb-1" />
            {candidatesLoading ? (
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-bold">{candidates.length}</p>
            )}
            <p className="text-xs text-muted-foreground">Candidates Submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            {candidatesLoading ? (
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-bold">{shortlistRate}%</p>
            )}
            <p className="text-xs text-muted-foreground">Shortlist Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-teal-600 mb-1" />
            <p className="text-2xl font-bold">$2.2K</p>
            <p className="text-xs text-muted-foreground">This Month Commission</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Assigned Jobs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Assigned Jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {jobsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border border-border">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                </div>
              ))
            ) : jobs.length === 0 ? (
              <div className="p-6 text-center">
                <Briefcase className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No open jobs assigned.</p>
              </div>
            ) : (
              jobs.map((job) => {
                const maxSubmissions = job.positions || 5;
                const currentSubmissions = job.filledPositions || job._count?.candidates || 0;
                const isFull = currentSubmissions >= maxSubmissions;

                return (
                  <div key={job.id} className="p-3 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">{job.title}</h3>
                      <Badge
                        className={`text-[10px] ${
                          job.priority === 'urgent'
                            ? 'bg-red-100 text-red-800'
                            : job.priority === 'high'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {job.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {job.department || 'N/A'} · {job.location || 'Remote'}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>
                            Submissions: {currentSubmissions}/{maxSubmissions}
                          </span>
                          <span className="text-muted-foreground">
                            Deadline: {job.closingDate ? new Date(job.closingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Open'}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${(currentSubmissions / maxSubmissions) * 100}%` }}
                          />
                        </div>
                      </div>
                      {!isFull && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2 h-7"
                          onClick={() => handleOpenSubmitDialog(job.id)}
                        >
                          <Send className="h-3 w-3 mr-1" /> Submit
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* My Candidates */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Candidate Submissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {candidatesLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              ))
            ) : candidates.length === 0 ? (
              <div className="p-6 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No candidates submitted yet.</p>
              </div>
            ) : (
              candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {candidate.firstName} {candidate.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {candidate.job?.title || 'Unknown Position'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`text-[10px] ${
                          candidate.status === 'shortlisted'
                            ? 'bg-teal-100 text-teal-800'
                            : candidate.status === 'interviewing'
                            ? 'bg-amber-100 text-amber-800'
                            : candidate.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : candidate.status === 'screening'
                            ? 'bg-green-100 text-green-800'
                            : candidate.status === 'hired'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {candidate.status}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Submitted: {candidate.createdAt ? new Date(candidate.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Commission Tracking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" /> Commission Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* TODO: Replace COMMISSION_DATA with real API data once commission tracking endpoint is available */}
          <div className="space-y-3">
            {COMMISSION_DATA.map((comm) => (
              <div key={comm.month} className="flex items-center gap-4 p-2 rounded-lg">
                <span className="text-sm font-medium w-24">{comm.month}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Earned: ${(comm.earned ?? 0).toLocaleString()}</span>
                        <span className="text-emerald-600">Paid: ${(comm.paid ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full"
                          style={{ width: `${(comm.paid / comm.earned) * 100}%` }}
                        />
                      </div>
                    </div>
                    <Badge
                      className={`text-[10px] ${
                        comm.pending > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {comm.pending > 0 ? `$${comm.pending} pending` : 'Fully paid'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Submit Candidate Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  placeholder="Enter first name"
                  value={formState.firstName}
                  onChange={(e) => setFormState((prev) => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  placeholder="Enter last name"
                  value={formState.lastName}
                  onChange={(e) => setFormState((prev) => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="candidate@email.com"
                value={formState.email}
                onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={formState.phone}
                onChange={(e) => setFormState((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobId">Job *</Label>
              <select
                id="jobId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={formState.jobId || selectedJobId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedJobId(val);
                  setFormState((prev) => ({ ...prev, jobId: val }));
                }}
              >
                <option value="">Select a job</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resumeUrl">Resume URL</Label>
              <Input
                id="resumeUrl"
                type="url"
                placeholder="https://example.com/resume.pdf"
                value={formState.resumeUrl}
                onChange={(e) => setFormState((prev) => ({ ...prev, resumeUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about the candidate..."
                value={formState.notes}
                onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setFormState(emptyForm);
                setSelectedJobId('');
              }}
              disabled={createCandidateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitCandidate}
              disabled={createCandidateMutation.isPending}
            >
              {createCandidateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" /> Submit Candidate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
