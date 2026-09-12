'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJobs, createCandidate } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Search, MapPin, DollarSign, Briefcase, Star, Bookmark,
  Zap, Clock, Building2, ArrowRight, Filter, Sparkles,
  AlertCircle, Users, Calendar, Loader2,
} from 'lucide-react';

// TODO: Replace with API data when featured-jobs endpoint is available
const FEATURED_JOBS = [
  { id: 'fj1', title: 'Senior AI/ML Engineer', company: 'TechCorp Global', location: 'San Francisco, CA', salary: '$180K - $240K', match: 95, tags: ['AI/ML', 'Python', 'TensorFlow'] },
  { id: 'fj2', title: 'Product Design Lead', company: 'TechCorp Global', location: 'Remote', salary: '$140K - $180K', match: 88, tags: ['Design', 'Figma', 'Leadership'] },
  { id: 'fj3', title: 'DevOps Architect', company: 'ManufactPro Industries', location: 'Mumbai, India', salary: '₹35L - ₹50L', match: 82, tags: ['AWS', 'Kubernetes', 'CI/CD'] },
];

// TODO: Replace with API data when AI-recommendations endpoint is available
const AI_RECOMMENDATIONS = [
  { reason: 'Based on your skills in React and TypeScript', match: 92 },
  { reason: 'Matches your experience level (5+ years)', match: 85 },
  { reason: 'Aligned with your location preferences', match: 78 },
];

interface JobData {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  status: string;
  priority: string;
  positions: number;
  filledPositions: number;
  postedDate: string | null;
  closingDate: string | null;
  company?: { id: string; name: string } | null;
  _count: { candidates: number; interviews: number };
}

function JobCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FeaturedJobSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-5 w-36 mb-1" />
        <Skeleton className="h-4 w-28 mb-1" />
        <div className="flex gap-2 my-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-full mt-2" />
      </CardContent>
    </Card>
  );
}

export function JobPortal() {
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const { currentCompany, user } = useAppStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Apply dialog state
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobData | null>(null);
  const [applyForm, setApplyForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    currentCompany: '',
    currentTitle: '',
    experience: '',
    expectedSalary: '',
    notes: '',
  });

  // Fetch jobs from API
  const { data: jobsResponse, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['jobs', 'open', currentCompany?.id],
    queryFn: () => getJobs({ status: 'open', companyId: currentCompany?.id || undefined }),
    retry: 1,
  });

  const jobs: JobData[] = useMemo(() => {
    if (!jobsResponse) return [];
    // Handle both PaginatedResponse shape and the actual API response shape
    const responseData = jobsResponse as Record<string, unknown>;
    if (Array.isArray(responseData.data)) {
      return responseData.data as JobData[];
    }
    // Fallback if data shape differs
    return [];
  }, [jobsResponse]);

  // Extract unique locations from real job data
  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>();
    jobs.forEach((job) => {
      if (job.location) {
        locations.add(job.location);
      }
    });
    return Array.from(locations).sort();
  }, [jobs]);

  // Filter jobs based on search and location
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.department?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      const matchesLocation = locationFilter === 'all' ||
        (job.location?.toLowerCase() || '').includes(locationFilter.toLowerCase());
      return matchesSearch && matchesLocation;
    });
  }, [jobs, searchQuery, locationFilter]);

  // Create candidate mutation
  const createCandidateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createCandidate(data),
    onSuccess: () => {
      toast({
        title: 'Application Submitted!',
        description: 'Your application has been submitted successfully.',
      });
      setApplyDialogOpen(false);
      resetApplyForm();
      // Invalidate jobs query to refresh candidate counts
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (err: Error) => {
      toast({
        title: 'Application Failed',
        description: err.message || 'Failed to submit application. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const resetApplyForm = () => {
    setApplyForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      currentCompany: '',
      currentTitle: '',
      experience: '',
      expectedSalary: '',
      notes: '',
    });
    setSelectedJob(null);
  };

  const handleApplyClick = (job: JobData) => {
    setSelectedJob(job);
    setApplyDialogOpen(true);
  };

  const handleOneClickApply = (job: JobData) => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please log in to apply for jobs.',
        variant: 'destructive',
      });
      return;
    }
    createCandidateMutation.mutate({
      jobId: job.id,
      firstName: user.userName?.split(' ')[0] || 'User',
      lastName: user.userName?.split(' ').slice(1).join(' ') || '',
      email: user.userEmail || '',
      source: 'portal',
      status: 'applied',
    });
  };

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!applyForm.firstName || !applyForm.lastName || !applyForm.email) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields (First Name, Last Name, Email).',
        variant: 'destructive',
      });
      return;
    }

    createCandidateMutation.mutate({
      jobId: selectedJob.id,
      firstName: applyForm.firstName,
      lastName: applyForm.lastName,
      email: applyForm.email,
      phone: applyForm.phone || undefined,
      currentCompany: applyForm.currentCompany || undefined,
      currentTitle: applyForm.currentTitle || undefined,
      experience: applyForm.experience ? parseInt(applyForm.experience) : undefined,
      expectedSalary: applyForm.expectedSalary ? parseFloat(applyForm.expectedSalary) : undefined,
      notes: applyForm.notes || undefined,
      source: 'portal',
      status: 'applied',
    });
  };

  const getStatusBadge = (status: string) => {
    const styleMap: Record<string, string> = {
      open: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
      interviewing: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-950/30 dark:text-gray-400',
      on_hold: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
      closed: 'bg-gray-100 text-gray-800 dark:bg-gray-950/30 dark:text-gray-400',
    };
    return styleMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: string) => {
    const styleMap: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
      high: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
      medium: 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400',
      low: 'bg-gray-100 text-gray-800 dark:bg-gray-950/30 dark:text-gray-400',
    };
    return styleMap[priority] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Job Portal</h1>
        <p className="text-muted-foreground text-sm">Find your next career opportunity</p>
      </div>

      {/* Search Bar */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Search jobs by title, skill, or keyword..." className="pl-10 h-11" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full sm:w-48 h-11">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {uniqueLocations.filter(loc => loc && loc.trim()).map((loc) => (
                  <SelectItem key={loc} value={loc.toLowerCase()}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="h-11 bg-emerald-600 hover:bg-emerald-700 px-8" onClick={() => refetch()}>
              <Search className="h-4 w-4 mr-2" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Featured Jobs */}
      {/* TODO: Replace with API data when featured-jobs endpoint is available */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" /> Featured Jobs
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURED_JOBS.map(job => (
            <Card key={job.id} className="hover:shadow-md transition-shadow border-amber-200 dark:border-amber-800/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 text-[10px]">
                    <Zap className="h-3 w-3 mr-1" /> Featured
                  </Badge>
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 text-[10px]">
                    {job.match}% Match
                  </Badge>
                </div>
                <h3 className="font-semibold text-sm mb-1">{job.title}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Building2 className="h-3 w-3" />{job.company}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{job.salary}</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {job.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" size="sm">
                  Apply Now <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* AI Recommendations */}
      {/* TODO: Replace with API data when AI-recommendations endpoint is available */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" /> AI Job Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {AI_RECOMMENDATIONS.map((rec, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-emerald-50/50 dark:bg-emerald-950/20">
                <p className="text-xs text-muted-foreground mb-1">{rec.reason}</p>
                <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">{rec.match}% match</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {isError && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                Failed to load jobs: {error instanceof Error ? error.message : 'Unknown error'}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Listings */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-emerald-600" /> All Open Positions ({filteredJobs.length})
        </h2>
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <JobCardSkeleton key={i} />)
          ) : filteredJobs.length > 0 ? (
            filteredJobs.map(job => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-sm">{job.title}</h3>
                        <Badge className={`text-[10px] ${getStatusBadge(job.status)}`}>{job.status}</Badge>
                        {job.priority && (
                          <Badge className={`text-[10px] ${getPriorityBadge(job.priority)}`}>{job.priority}</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {job.department && (
                          <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{job.department}</span>
                        )}
                        {job.location && (
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
                        )}
                        {job.employmentType && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.employmentType}</span>
                        )}
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{job._count?.candidates || 0} applicants</span>
                        {job.postedDate && (
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(job.postedDate).toLocaleDateString()}</span>
                        )}
                        {job.positions > 1 && (
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{job.filledPositions}/{job.positions} filled</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-9 w-9"><Bookmark className="h-4 w-4" /></Button>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        size="sm"
                        onClick={() => handleOneClickApply(job)}
                        disabled={createCandidateMutation.isPending}
                      >
                        {createCandidateMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          'One-Click Apply'
                        )}
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                      <Dialog open={applyDialogOpen && selectedJob?.id === job.id} onOpenChange={(open) => {
                        if (!open) {
                          setApplyDialogOpen(false);
                          resetApplyForm();
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => handleApplyClick(job)}>
                            Apply Now
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Apply for {selectedJob?.title}</DialogTitle>
                            <DialogDescription>
                              Fill in your details to apply for this position
                              {selectedJob?.department && ` in ${selectedJob.department}`}
                              {selectedJob?.location && ` - ${selectedJob.location}`}
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleApplySubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="firstName">First Name *</Label>
                                <Input
                                  id="firstName"
                                  value={applyForm.firstName}
                                  onChange={(e) => setApplyForm(prev => ({ ...prev, firstName: e.target.value }))}
                                  placeholder="John"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name *</Label>
                                <Input
                                  id="lastName"
                                  value={applyForm.lastName}
                                  onChange={(e) => setApplyForm(prev => ({ ...prev, lastName: e.target.value }))}
                                  placeholder="Doe"
                                  required
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input
                                  id="email"
                                  type="email"
                                  value={applyForm.email}
                                  onChange={(e) => setApplyForm(prev => ({ ...prev, email: e.target.value }))}
                                  placeholder="john@example.com"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                  id="phone"
                                  value={applyForm.phone}
                                  onChange={(e) => setApplyForm(prev => ({ ...prev, phone: e.target.value }))}
                                  placeholder="+1 234 567 8900"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="currentCompany">Current Company</Label>
                                <Input
                                  id="currentCompany"
                                  value={applyForm.currentCompany}
                                  onChange={(e) => setApplyForm(prev => ({ ...prev, currentCompany: e.target.value }))}
                                  placeholder="Current company name"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="currentTitle">Current Title</Label>
                                <Input
                                  id="currentTitle"
                                  value={applyForm.currentTitle}
                                  onChange={(e) => setApplyForm(prev => ({ ...prev, currentTitle: e.target.value }))}
                                  placeholder="Software Engineer"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="experience">Experience (years)</Label>
                                <Input
                                  id="experience"
                                  type="number"
                                  value={applyForm.experience}
                                  onChange={(e) => setApplyForm(prev => ({ ...prev, experience: e.target.value }))}
                                  placeholder="5"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="expectedSalary">Expected Salary</Label>
                                <Input
                                  id="expectedSalary"
                                  type="number"
                                  value={applyForm.expectedSalary}
                                  onChange={(e) => setApplyForm(prev => ({ ...prev, expectedSalary: e.target.value }))}
                                  placeholder="100000"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="notes">Additional Notes</Label>
                              <Textarea
                                id="notes"
                                value={applyForm.notes}
                                onChange={(e) => setApplyForm(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Tell us why you're a great fit for this role..."
                                rows={3}
                              />
                            </div>
                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setApplyDialogOpen(false);
                                  resetApplyForm();
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                disabled={createCandidateMutation.isPending}
                              >
                                {createCandidateMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Submitting...
                                  </>
                                ) : (
                                  <>
                                    Submit Application
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                  </>
                                )}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : !isError ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery || locationFilter !== 'all'
                    ? 'No jobs match your search criteria. Try adjusting your filters.'
                    : 'No open positions available at the moment.'}
                </p>
                {(searchQuery || locationFilter !== 'all') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setSearchQuery('');
                      setLocationFilter('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Apply Dialog for Featured Jobs (triggered outside the job listing loop) */}
      <Dialog open={applyDialogOpen && selectedJob !== null && !filteredJobs.some(j => j.id === selectedJob?.id)} onOpenChange={(open) => {
        if (!open) {
          setApplyDialogOpen(false);
          resetApplyForm();
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply for {selectedJob?.title}</DialogTitle>
            <DialogDescription>Fill in your details to apply for this position</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApplySubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="feat-firstName">First Name *</Label>
                <Input
                  id="feat-firstName"
                  value={applyForm.firstName}
                  onChange={(e) => setApplyForm(prev => ({ ...prev, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feat-lastName">Last Name *</Label>
                <Input
                  id="feat-lastName"
                  value={applyForm.lastName}
                  onChange={(e) => setApplyForm(prev => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="feat-email">Email *</Label>
                <Input
                  id="feat-email"
                  type="email"
                  value={applyForm.email}
                  onChange={(e) => setApplyForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feat-phone">Phone</Label>
                <Input
                  id="feat-phone"
                  value={applyForm.phone}
                  onChange={(e) => setApplyForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feat-notes">Additional Notes</Label>
              <Textarea
                id="feat-notes"
                value={applyForm.notes}
                onChange={(e) => setApplyForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setApplyDialogOpen(false); resetApplyForm(); }}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={createCandidateMutation.isPending}>
                {createCandidateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
                ) : (
                  <>Submit Application</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
