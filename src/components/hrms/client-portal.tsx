'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getClients, getJobs, getCandidates } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Building2, Briefcase, Users, Star, Clock, CheckCircle2,
  MessageSquare, Brain, TrendingUp, Eye, Loader2
} from 'lucide-react';

const SLA_DATA = [
  { metric: 'Time to Submit Candidates', target: '48h', actual: '42h', status: 'met' },
  { metric: 'Candidate Quality Score', target: '80%', actual: '85%', status: 'exceeded' },
  { metric: 'Interview Scheduling', target: '24h', actual: '30h', status: 'missed' },
  { metric: 'Offer Turnaround', target: '72h', actual: '68h', status: 'met' },
  { metric: 'Replacement Guarantee', target: '30 days', actual: '22 days', status: 'exceeded' },
];

interface ClientData {
  id: string; name: string; email: string; clientCompany: string; industry: string;
  contractStart: string; contractEnd: string; status: string; activeJobs: number; totalHires: number;
}

interface JobData {
  id: string; title: string; department: string | null; location: string | null; status: string;
  _count: { candidates: number }; priority: string;
}

interface CandidateData {
  id: string; firstName: string; lastName: string; currentTitle?: string;
  currentCompany?: string; aiScore?: number; status: string;
}

export function ClientPortal() {
  const { currentCompany } = useAppStore();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (currentCompany?.id) params.companyId = currentCompany.id;
      const [clientsRes, jobsRes, candidatesRes] = await Promise.all([
        getClients(params),
        getJobs(params),
        getCandidates({ companyId: currentCompany?.id }),
      ]);
      setClients((clientsRes as { data: ClientData[] }).data || []);
      setJobs((jobsRes as { data: JobData[] }).data || []);
      setCandidates((candidatesRes as { data: CandidateData[] }).data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Client Portal</h1>
        <p className="text-muted-foreground text-sm">Client-facing dashboard for hiring and vendor management</p>
      </div>

      {/* Client Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Building2 className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-2xl font-bold">{clients.length}</p>
            <p className="text-xs text-muted-foreground">Active Clients</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Briefcase className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">{clients.reduce((s, c) => s + (c.activeJobs || 0), 0)}</p>
            <p className="text-xs text-muted-foreground">Active Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            <p className="text-2xl font-bold">{clients.reduce((s, c) => s + (c.totalHires || 0), 0)}</p>
            <p className="text-xs text-muted-foreground">Total Hires</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 mx-auto text-teal-600 mb-1" />
            <p className="text-2xl font-bold">4.6</p>
            <p className="text-xs text-muted-foreground">Avg Satisfaction</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requisitions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requisitions">Job Requisitions</TabsTrigger>
          <TabsTrigger value="candidates">Candidate Review</TabsTrigger>
          <TabsTrigger value="sla">SLA Tracking</TabsTrigger>
          <TabsTrigger value="insights">AI Hiring Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="requisitions" className="space-y-3">
          {jobs.filter(j => j.status === 'open' || j.status === 'interviewing').map(job => (
            <Card key={job.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{job.title}</h3>
                      <Badge className={`text-[10px] ${job.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{job.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{job.department || 'N/A'} · {job.location || 'Remote'} · {job._count?.candidates || 0} applicants</p>
                  </div>
                  <Button variant="outline" size="sm"><Eye className="h-3.5 w-3.5 mr-1" /> View Details</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="candidates" className="space-y-3">
          {candidates.map(candidate => (
            <Card key={candidate.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      {candidate.firstName[0]}{candidate.lastName[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{candidate.firstName} {candidate.lastName}</p>
                      <p className="text-xs text-muted-foreground">{candidate.currentTitle || 'N/A'} at {candidate.currentCompany || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-sm font-bold text-emerald-600">{candidate.aiScore || 0}</p>
                      <p className="text-[10px] text-muted-foreground">AI Score</p>
                    </div>
                    <Badge className="text-[10px] bg-amber-100 text-amber-800">{candidate.status}</Badge>
                    <Button variant="outline" size="sm"><MessageSquare className="h-3.5 w-3.5 mr-1" /> Feedback</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="sla">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SLA Metric</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {SLA_DATA.map(sla => (
                      <TableRow key={sla.metric}>
                        <TableCell className="font-medium">{sla.metric}</TableCell>
                        <TableCell>{sla.target}</TableCell>
                        <TableCell>{sla.actual}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${
                            sla.status === 'exceeded' ? 'bg-emerald-100 text-emerald-800' :
                            sla.status === 'met' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {sla.status === 'exceeded' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {sla.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-emerald-600" /> AI Hiring Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20">
                <p className="text-sm font-medium">Optimal Hiring Channel</p>
                <p className="text-xs text-muted-foreground mt-1">LinkedIn sourcing yields 35% higher quality candidates for technical roles compared to job boards.</p>
              </div>
              <div className="p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20">
                <p className="text-sm font-medium">Time-to-Hire Optimization</p>
                <p className="text-xs text-muted-foreground mt-1">Reducing interview rounds from 4 to 3 could decrease time-to-hire by 20% without impacting quality.</p>
              </div>
              <div className="p-3 rounded-lg border bg-green-50/50 dark:bg-green-950/20">
                <p className="text-sm font-medium">Vendor Performance</p>
                <p className="text-xs text-muted-foreground mt-1">TalentHunt Agency has the highest conversion rate at 78%. Recommend increasing allocation.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
