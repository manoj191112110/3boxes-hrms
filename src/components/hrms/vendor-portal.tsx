'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getVendors, getJobs, getCandidates } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Truck, Briefcase, Users, Star, CheckCircle2, Clock,
  DollarSign, ShieldCheck, Send, Eye, FileText, Loader2
} from 'lucide-react';

const INVOICES = [
  { id: 'INV-001', vendor: 'TalentHunt Agency', amount: 12500, date: 'Jan 15, 2025', status: 'paid', services: 'Recruitment - 3 hires' },
  { id: 'INV-002', vendor: 'StaffPro Solutions', amount: 8700, date: 'Jan 20, 2025', status: 'pending', services: 'Staffing - Temp workers' },
  { id: 'INV-003', vendor: 'VerifyRight BGV', amount: 3400, date: 'Jan 22, 2025', status: 'pending', services: 'BGV - 15 candidates' },
  { id: 'INV-004', vendor: 'TalentHunt Agency', amount: 15000, date: 'Dec 28, 2024', status: 'paid', services: 'Recruitment - 4 hires' },
];

interface VendorData {
  id: string; name: string; email: string; vendorCompany: string; serviceType: string;
  status: string; rating: number; candidatesSubmitted: number; successRate: number; subVendors: number;
}

interface JobData {
  id: string; title: string; department: string | null; location: string | null; status: string; priority: string;
}

interface CandidateData {
  id: string; firstName: string; lastName: string; currentTitle?: string;
  experience?: number; status: string;
}

export function VendorPortal() {
  const { currentCompany } = useAppStore();
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (currentCompany?.id) params.companyId = currentCompany.id;
      const [vendorsRes, jobsRes, candidatesRes] = await Promise.all([
        getVendors(params),
        getJobs(params),
        getCandidates({ companyId: currentCompany?.id }),
      ]);
      setVendors((vendorsRes as { data: VendorData[] }).data || []);
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
        <h1 className="text-2xl font-bold tracking-tight">Vendor Portal</h1>
        <p className="text-muted-foreground text-sm">Manage vendor relationships and performance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Truck className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-2xl font-bold">{vendors.length}</p>
            <p className="text-xs text-muted-foreground">Active Vendors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">{vendors.reduce((s, v) => s + (v.candidatesSubmitted || 0), 0)}</p>
            <p className="text-xs text-muted-foreground">Candidates Submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            <p className="text-2xl font-bold">{vendors.length > 0 ? (vendors.reduce((s, v) => s + (v.rating || 0), 0) / vendors.length).toFixed(1) : '0'}</p>
            <p className="text-xs text-muted-foreground">Avg Vendor Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-teal-600 mb-1" />
            <p className="text-2xl font-bold">$39.6K</p>
            <p className="text-xs text-muted-foreground">Monthly Spend</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="assignments">Job Assignments</TabsTrigger>
          <TabsTrigger value="submissions">Candidate Submissions</TabsTrigger>
          <TabsTrigger value="scorecard">Vendor Scorecard</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-3">
          {vendors.map(vendor => (
            <Card key={vendor.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                      {(vendor.vendorCompany || vendor.name || 'VN').slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{vendor.vendorCompany || vendor.name}</h3>
                      <p className="text-xs text-muted-foreground">{vendor.serviceType} · {vendor.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-sm font-bold">{vendor.rating || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Rating</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold">{vendor.successRate || 0}%</p>
                      <p className="text-[10px] text-muted-foreground">Success</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold">{vendor.candidatesSubmitted || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Submitted</p>
                    </div>
                    <Badge className="text-[10px] bg-emerald-100 text-emerald-800">{vendor.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-3">
          {jobs.filter(j => j.status === 'open').map(job => (
            <Card key={job.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm">{job.title}</h3>
                    <p className="text-xs text-muted-foreground">{job.department || 'N/A'} · {job.location || 'Remote'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="text-[10px] bg-amber-100 text-amber-800">{job.priority} priority</Badge>
                    <Button variant="outline" size="sm"><Send className="h-3.5 w-3.5 mr-1" /> Submit Candidate</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="submissions" className="space-y-3">
          {candidates.map(candidate => (
            <Card key={candidate.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                      {candidate.firstName[0]}{candidate.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{candidate.firstName} {candidate.lastName}</p>
                      <p className="text-xs text-muted-foreground">{candidate.currentTitle || 'N/A'} · {candidate.experience || 0} yrs exp</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${
                      candidate.status === 'shortlisted' ? 'bg-teal-100 text-teal-800' :
                      candidate.status === 'interviewing' ? 'bg-amber-100 text-amber-800' :
                      candidate.status === 'offered' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>{candidate.status}</Badge>
                    <Button variant="ghost" size="sm"><Eye className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="scorecard" className="space-y-4">
          {vendors.map(vendor => (
            <Card key={vendor.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{vendor.vendorCompany || vendor.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Success Rate</p>
                    <Progress value={vendor.successRate || 0} className="h-2 mb-1" />
                    <p className="text-xs font-medium">{vendor.successRate || 0}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Rating</p>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(vendor.rating || 0) ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                      ))}
                      <span className="text-xs font-medium ml-1">{vendor.rating || 0}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Candidates Submitted</p>
                    <p className="text-lg font-bold">{vendor.candidatesSubmitted || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Sub-Vendors</p>
                    <p className="text-lg font-bold">{vendor.subVendors || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Services</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {INVOICES.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.id}</TableCell>
                        <TableCell className="font-medium">{inv.vendor}</TableCell>
                        <TableCell className="text-xs">{inv.services}</TableCell>
                        <TableCell>${(inv.amount ?? 0).toLocaleString()}</TableCell>
                        <TableCell>{inv.date}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {inv.status}
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
      </Tabs>
    </div>
  );
}
