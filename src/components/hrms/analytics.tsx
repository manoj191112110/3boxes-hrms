'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnalytics } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Brain, Download, TrendingUp, Users, DollarSign, Heart, Briefcase, AlertCircle } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// TODO: Replace with API data when attrition-by-dept endpoint is available
const ATTRITION_BY_DEPT = [
  { department: 'Engineering', rate: 3.5 },
  { department: 'Sales', rate: 5.2 },
  { department: 'Operations', rate: 4.1 },
  { department: 'HR', rate: 2.8 },
  { department: 'Finance', rate: 1.9 },
  { department: 'Design', rate: 3.2 },
];

// TODO: Replace with API data when diversity endpoint is available
const DIVERSITY_DATA = [
  { category: 'Gender', distribution: [
    { name: 'Male', value: 58, color: '#059669' },
    { name: 'Female', value: 37, color: '#f59e0b' },
    { name: 'Non-Binary', value: 5, color: '#8b5cf6' },
  ]},
  { category: 'Age Group', distribution: [
    { name: '18-25', value: 12, color: '#10b981' },
    { name: '26-35', value: 42, color: '#059669' },
    { name: '36-45', value: 30, color: '#f59e0b' },
    { name: '46-55', value: 12, color: '#3b82f6' },
    { name: '55+', value: 4, color: '#8b5cf6' },
  ]},
];

// TODO: Replace with API data when engagement endpoint is available
const ENGAGEMENT_ANALYTICS = [
  { month: 'Aug', score: 72, eNPS: 42 },
  { month: 'Sep', score: 75, eNPS: 45 },
  { month: 'Oct', score: 73, eNPS: 43 },
  { month: 'Nov', score: 76, eNPS: 48 },
  { month: 'Dec', score: 78, eNPS: 50 },
  { month: 'Jan', score: 80, eNPS: 52 },
];

// TODO: Replace with API data when salary-distribution endpoint is available
const SALARY_DISTRIBUTION = [
  { range: '<30K', count: 120 },
  { range: '30-50K', count: 380 },
  { range: '50-80K', count: 520 },
  { range: '80-120K', count: 450 },
  { range: '120-180K', count: 320 },
  { range: '180K+', count: 180 },
];

const DEPT_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#6b7280', '#ec4899', '#14b8a6', '#a855f7'];

function formatMonth(monthStr: string): string {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return isNaN(date.getTime()) ? monthStr : date.toLocaleString('en-US', { month: 'short' });
}

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[280px] w-full rounded-lg" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground mb-3">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>Try Again</Button>
      )}
    </div>
  );
}

export function Analytics() {
  const [activeTab, setActiveTab] = useState('workforce');
  const { currentCompany } = useAppStore();

  const { data: analyticsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analytics', currentCompany?.id],
    queryFn: () => getAnalytics({ companyId: currentCompany?.id || undefined }),
    retry: 1,
  });

  // Transform API data to chart formats
  const headcountData = analyticsData?.headcountTrends?.map((item: { month: string; count: number }) => ({
    name: formatMonth(item.month),
    count: item.count,
  })) ?? [];

  const attritionData = analyticsData?.attrition?.byMonth?.map((item: { month: string; rate: number }) => ({
    name: formatMonth(item.month),
    rate: item.rate,
  })) ?? [];

  const hiringFunnelData = analyticsData?.hiringFunnel
    ? [
        { name: 'Applications', count: analyticsData.hiringFunnel.applications },
        { name: 'Screened', count: analyticsData.hiringFunnel.screened },
        { name: 'Interviewed', count: analyticsData.hiringFunnel.interviewed },
        { name: 'Offered', count: analyticsData.hiringFunnel.offered },
        { name: 'Hired', count: analyticsData.hiringFunnel.hired },
      ]
    : [];

  const departmentDistribution = analyticsData?.departmentDistribution?.map(
    (item: { departmentId: string; departmentName: string; count: number }, index: number) => ({
      name: item.departmentName,
      value: item.count,
      color: DEPT_COLORS[index % DEPT_COLORS.length],
    })
  ) ?? [];

  const payrollData = analyticsData?.payrollCosts?.map((item: { month: string; totalGross: number }) => ({
    name: formatMonth(item.month),
    cost: item.totalGross,
  })) ?? [];

  const attendanceData = analyticsData?.attendanceOverview?.byStatus?.map(
    (item: { status: string; count: number }) => {
      const colorMap: Record<string, string> = {
        present: '#10b981',
        absent: '#ef4444',
        late: '#f59e0b',
        half_day: '#3b82f6',
        on_leave: '#3b82f6',
      };
      return {
        name: item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('_', ' '),
        value: item.count,
        color: colorMap[item.status] || '#6b7280',
      };
    }
  ) ?? [];

  const overallAttritionRate = analyticsData?.attrition?.rate ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm">Comprehensive workforce insights and predictions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Export Report</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700"><Brain className="h-4 w-4 mr-2" /> AI Predictions</Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="workforce" className="text-xs">Workforce</TabsTrigger>
          <TabsTrigger value="attrition" className="text-xs">Attrition</TabsTrigger>
          <TabsTrigger value="hiring" className="text-xs">Hiring</TabsTrigger>
          <TabsTrigger value="payroll" className="text-xs">Payroll</TabsTrigger>
          <TabsTrigger value="diversity" className="text-xs">Diversity</TabsTrigger>
          <TabsTrigger value="engagement" className="text-xs">Engagement</TabsTrigger>
        </TabsList>

        {/* Workforce Analytics */}
        <TabsContent value="workforce" className="space-y-4">
          {isError ? (
            <Card>
              <CardContent className="p-6">
                <ErrorState message={`Failed to load analytics: ${error instanceof Error ? error.message : 'Unknown error'}`} onRetry={() => refetch()} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Headcount Trend</CardTitle></CardHeader>
                <CardContent>
                  {isLoading ? (
                    <ChartSkeleton />
                  ) : headcountData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={headcountData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="#059669" fill="#059669" fillOpacity={0.15} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">No headcount data available</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Department Distribution</CardTitle></CardHeader>
                <CardContent>
                  {isLoading ? (
                    <ChartSkeleton />
                  ) : departmentDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={departmentDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                          {departmentDistribution.map((entry: { name: string; value: number; color: string }, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">No department data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          {/* Attendance Overview */}
          {!isError && analyticsData?.attendanceOverview && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/30">
                      <Users className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Work Hours</p>
                      <p className="text-lg font-semibold">{analyticsData.attendanceOverview.avgWorkHours}h</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {attendanceData.slice(0, 3).map((item: { name: string; value: number; color: string }) => (
                <Card key={item.name}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${item.color}20` }}>
                        <TrendingUp className="h-5 w-5" style={{ color: item.color }} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{item.name}</p>
                        <p className="text-lg font-semibold">{item.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {isLoading && !isError && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-5 w-12" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4 text-emerald-600" /> AI Workforce Predictions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20">
                <p className="text-sm font-medium">📈 Growth Forecast</p>
                <p className="text-xs text-muted-foreground mt-1">Projected headcount trends based on current hiring pipeline and attrition patterns.</p>
              </div>
              <div className="p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20">
                <p className="text-sm font-medium">⚠️ Capacity Alert</p>
                <p className="text-xs text-muted-foreground mt-1">Monitor department capacity and consider hiring acceleration where needed.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attrition Analytics */}
        <TabsContent value="attrition" className="space-y-4">
          {/* Summary Cards */}
          {!isError && analyticsData?.attrition && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/30">
                      <TrendingUp className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Attrition Rate</p>
                      <p className="text-lg font-semibold">{overallAttritionRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/30">
                      <Users className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Exited</p>
                      <p className="text-lg font-semibold">{analyticsData.attrition.totalExited}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/30">
                      <Heart className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Retention Rate</p>
                      <p className="text-lg font-semibold">{(100 - overallAttritionRate).toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-5 w-12" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Attrition Rate Trend</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? (
                  <ChartSkeleton />
                ) : isError ? (
                  <ErrorState message="Failed to load attrition data" onRetry={() => refetch()} />
                ) : attritionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={attritionData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={[0, 5]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No attrition data available</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Attrition by Department</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">TODO: Replace with API data when endpoint is available</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={ATTRITION_BY_DEPT}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="department" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 6]} />
                    <Tooltip />
                    <Bar dataKey="rate" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Hiring Analytics */}
        <TabsContent value="hiring" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Hiring Funnel</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <ChartSkeleton />
              ) : isError ? (
                <ErrorState message="Failed to load hiring data" onRetry={() => refetch()} />
              ) : hiringFunnelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={hiringFunnelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#059669" radius={[0, 4, 4, 0]}>
                      {hiringFunnelData.map((_entry: { name: string; count: number }, index: number) => {
                        const colors = ['#94a3b8', '#64748b', '#f59e0b', '#06b6d4', '#059669'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No hiring data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Analytics */}
        <TabsContent value="payroll" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Payroll Cost Trend</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? (
                  <ChartSkeleton />
                ) : isError ? (
                  <ErrorState message="Failed to load payroll data" onRetry={() => refetch()} />
                ) : payrollData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={payrollData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => [`$${(value / 1000).toFixed(1)}K`, 'Cost']} />
                      <Area type="monotone" dataKey="cost" stroke="#059669" fill="#059669" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No payroll data available</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Salary Distribution</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">TODO: Replace with API data when endpoint is available</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={SALARY_DISTRIBUTION}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Diversity Analytics */}
        <TabsContent value="diversity" className="space-y-4">
          {/* Gender Distribution from API */}
          {!isLoading && !isError && analyticsData?.genderDistribution && analyticsData.genderDistribution.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Gender Distribution (Live Data)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analyticsData.genderDistribution.map((g: { gender: string; count: number }, i: number) => ({
                        name: g.gender,
                        value: g.count,
                        color: DEPT_COLORS[i % DEPT_COLORS.length],
                      }))}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value"
                    >
                      {analyticsData.genderDistribution.map((_: { gender: string; count: number }, index: number) => (
                        <Cell key={`gender-cell-${index}`} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, 'Count']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {/* Employment Type Distribution from API */}
          {!isLoading && !isError && analyticsData?.employmentTypeDistribution && analyticsData.employmentTypeDistribution.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Employment Type Distribution (Live Data)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analyticsData.employmentTypeDistribution.map((e: { type: string; count: number }, i: number) => ({
                        name: e.type || 'Not specified',
                        value: e.count,
                        color: DEPT_COLORS[(i + 3) % DEPT_COLORS.length],
                      }))}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value"
                    >
                      {analyticsData.employmentTypeDistribution.map((_: { type: string; count: number }, index: number) => (
                        <Cell key={`emp-cell-${index}`} fill={DEPT_COLORS[(index + 3) % DEPT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, 'Count']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2"><Skeleton className="h-5 w-40" /></CardHeader>
                  <CardContent><Skeleton className="h-[250px] w-full rounded-lg" /></CardContent>
                </Card>
              ))}
            </div>
          )}
          {/* Static diversity data - TODO: Replace with API data when diversity endpoint is available */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {DIVERSITY_DATA.map(category => (
              <Card key={category.category}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{category.category} Distribution</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">TODO: Replace with API data when endpoint is available</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={category.distribution} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                        {category.distribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value}%`, 'Percentage']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Engagement Analytics */}
        <TabsContent value="engagement" className="space-y-4">
          {/* Leave Stats from API */}
          {!isLoading && !isError && analyticsData?.leaveStats && analyticsData.leaveStats.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Leave Statistics (Live Data)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analyticsData.leaveStats.map((l: { type: string; totalDays: number; count: number }) => ({
                    name: l.type,
                    days: l.totalDays,
                    requests: l.count,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="days" fill="#059669" radius={[4, 4, 0, 0]} name="Total Days" />
                    <Bar dataKey="requests" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Requests" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {/* Static engagement data - TODO: Replace with API data when engagement endpoint is available */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Engagement Score & eNPS Trend</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">TODO: Replace with API data when engagement endpoint is available</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={ENGAGEMENT_ANALYTICS}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="score" stroke="#059669" strokeWidth={2} dot={{ fill: '#059669', r: 4 }} name="Engagement Score" />
                  <Line type="monotone" dataKey="eNPS" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} name="eNPS" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
