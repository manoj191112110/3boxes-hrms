'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  UserMinus, Search, Mail, Users, Star, Gift,
  RefreshCw, Heart, MessageSquare, Briefcase
} from 'lucide-react';
import { getEmployees } from '@/lib/api';
import { useAppStore } from '@/store/app-store';

// TODO: Replace with API data once alumni referral endpoint is available
const REFERRALS = [
  { id: 'rf1', referrer: 'Jennifer Lee', candidate: 'Lisa Park', position: 'Frontend Developer', status: 'hired', date: '2024-11-15', reward: '$2000' },
  { id: 'rf2', referrer: 'Marcus Williams', candidate: 'James Brown', position: 'Account Executive', status: 'interviewing', date: '2025-01-05', reward: 'Pending' },
  { id: 'rf3', referrer: 'Sofia Rodriguez', candidate: 'Anna Chen', position: 'UX Designer', status: 'applied', date: '2025-01-18', reward: 'Pending' },
];

// TODO: Replace with API data once alumni community endpoint is available
const COMMUNITY_POSTS = [
  { author: 'Jennifer Lee', content: 'Great to see TechCorp expanding to Singapore! Miss the team. 🌏', date: '2 days ago', likes: 12, comments: 3 },
  { author: 'Marcus Williams', content: 'Happy to refer candidates for the new Sales Director role. DM me!', date: '5 days ago', likes: 8, comments: 5 },
  { author: 'Tom Anderson', content: 'Retirement is great but I miss the annual team offsites. 😄', date: '1 week ago', likes: 24, comments: 7 },
];

interface AlumniEntry {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  jobTitle: string | null;
  exitDate: string;
  tenure: string;
  rehireEligible: boolean;
  reason: string;
  currentCompany: string;
  phone: string | null;
  branch: string | null;
}

function calculateTenure(joiningDate: string, exitDate: string): string {
  const start = new Date(joiningDate);
  const end = new Date(exitDate);
  const diffMs = end.getTime() - start.getTime();
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  if (diffYears >= 1) {
    return `${Math.round(diffYears)} year${Math.round(diffYears) > 1 ? 's' : ''}`;
  }
  const diffMonths = Math.round(diffYears * 12);
  return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
}

export function Alumni() {
  const [searchQuery, setSearchQuery] = useState('');
  const { currentCompany } = useAppStore();

  const { data: alumniData, isLoading, error } = useQuery({
    queryKey: ['alumni', currentCompany?.id],
    queryFn: () => getEmployees({ status: 'exited', companyId: currentCompany?.id }),
    enabled: !!currentCompany?.id,
  });

  const alumniList: AlumniEntry[] = useMemo(() => {
    if (!alumniData?.data) return [];
    return alumniData.data.map((emp) => ({
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      email: emp.email,
      department: emp.department?.name ?? 'Unknown',
      designation: emp.designation,
      jobTitle: emp.jobTitle,
      exitDate: '', // Not available in employee data; will show joining date
      tenure: emp.joiningDate ? calculateTenure(emp.joiningDate, new Date().toISOString()) : 'N/A',
      rehireEligible: true, // Default; exact eligibility not in current API
      reason: '', // Not available in current API
      currentCompany: 'Unknown', // Not available in current API
      phone: emp.phone,
      branch: emp.branch?.name ?? null,
    }));
  }, [alumniData]);

  const filteredAlumni = useMemo(() => {
    if (!searchQuery.trim()) return alumniList;
    const q = searchQuery.toLowerCase();
    return alumniList.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.department.toLowerCase().includes(q) ||
        a.designation.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
    );
  }, [alumniList, searchQuery]);

  const rehireEligibleCount = useMemo(
    () => alumniList.filter((a) => a.rehireEligible).length,
    [alumniList]
  );

  const handleSendEmail = (email: string) => {
    window.open(`mailto:${email}`, '_blank');
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alumni Network</h1>
          <p className="text-muted-foreground text-sm">Stay connected with former employees</p>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <UserMinus className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load alumni data. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alumni Network</h1>
        <p className="text-muted-foreground text-sm">Stay connected with former employees</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <UserMinus className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            {isLoading ? (
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-bold">{alumniList.length}</p>
            )}
            <p className="text-xs text-muted-foreground">Total Alumni</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <RefreshCw className="h-5 w-5 mx-auto text-green-600 mb-1" />
            {isLoading ? (
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-bold">{rehireEligibleCount}</p>
            )}
            <p className="text-xs text-muted-foreground">Rehire Eligible</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Gift className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            <p className="text-2xl font-bold">{REFERRALS.length}</p>
            <p className="text-xs text-muted-foreground">Referrals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 mx-auto text-teal-600 mb-1" />
            <p className="text-2xl font-bold">4.2</p>
            <p className="text-xs text-muted-foreground">Avg Rating</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="directory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="directory">Alumni Directory</TabsTrigger>
          <TabsTrigger value="rehire">Rehire Eligibility</TabsTrigger>
          <TabsTrigger value="referrals">Referral Tracking</TabsTrigger>
          <TabsTrigger value="community">Community</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search alumni by name, department, designation, or email..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAlumni.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'No alumni match your search criteria.' : 'No alumni records found.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAlumni.map((alumni) => (
                <Card key={alumni.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                        {alumni.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{alumni.name}</p>
                        <p className="text-xs text-muted-foreground">{alumni.designation}</p>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>Dept: {alumni.department} · Tenure: {alumni.tenure}</p>
                      <p>
                        Joined: {alumni.exitDate || 'N/A'}
                        {alumni.reason ? ` · Reason: ${alumni.reason}` : ''}
                      </p>
                      <p>Now at: {alumni.currentCompany}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge
                        className={`text-[10px] ${
                          alumni.rehireEligible
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {alumni.rehireEligible ? 'Rehire Eligible' : 'Not Eligible'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={`Send email to ${alumni.email}`}
                        onClick={() => handleSendEmail(alumni.email)}
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rehire" className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : alumniList.filter((a) => a.rehireEligible).length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <RefreshCw className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No rehire-eligible alumni found.</p>
              </CardContent>
            </Card>
          ) : (
            alumniList
              .filter((a) => a.rehireEligible)
              .map((alumni) => (
                <Card key={alumni.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                          {alumni.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{alumni.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {alumni.designation} · {alumni.tenure} tenure
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-800">Rehire Eligible</Badge>
                        <Button variant="outline" size="sm">
                          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Initiate Rehire
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
        </TabsContent>

        <TabsContent value="referrals" className="space-y-3">
          {/* TODO: Replace REFERRALS with real API data once alumni referral endpoint is available */}
          {REFERRALS.map((ref) => (
            <Card key={ref.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{ref.candidate}</p>
                    <p className="text-xs text-muted-foreground">
                      Referred by {ref.referrer} for {ref.position} · {ref.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`text-[10px] ${
                        ref.status === 'hired'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ref.status === 'interviewing'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {ref.status}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      <Gift className="h-3 w-3 mr-1" /> {ref.reward}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="community" className="space-y-3">
          {/* TODO: Replace COMMUNITY_POSTS with real API data once alumni community endpoint is available */}
          {COMMUNITY_POSTS.map((post, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs">
                    {post.author
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{post.author}</p>
                    <p className="text-[10px] text-muted-foreground">{post.date}</p>
                  </div>
                </div>
                <p className="text-sm mb-3">{post.content}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <button className="flex items-center gap-1 hover:text-red-500 transition-colors">
                    <Heart className="h-3.5 w-3.5" /> {post.likes}
                  </button>
                  <button className="flex items-center gap-1 hover:text-green-500 transition-colors">
                    <MessageSquare className="h-3.5 w-3.5" /> {post.comments}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
