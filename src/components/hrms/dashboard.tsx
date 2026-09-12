'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, UserPlus, Briefcase, TrendingDown, Clock, CheckSquare,
  Brain, ArrowUpRight, ArrowDownRight, Activity, Sparkles, Zap,
  CalendarCheck, DollarSign, BarChart3, Loader2
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { getDashboardStats, getAnalytics } from '@/lib/api';

const QUICK_ACTIONS = [
  { label: 'Add Employee', icon: UserPlus, module: 'employees' as const },
  { label: 'Post Job', icon: Briefcase, module: 'recruitment' as const },
  { label: 'Run Payroll', icon: DollarSign, module: 'payroll' as const },
  { label: 'View Reports', icon: BarChart3, module: 'analytics' as const },
  { label: 'Leave Requests', icon: CalendarCheck, module: 'leave' as const },
  { label: 'AI Assistant', icon: Brain, module: 'ai_chatbot' as const },
];

const AI_INSIGHTS = [
  { title: 'Attrition Risk Alert', description: '5 employees in Engineering show high attrition risk based on engagement scores and activity patterns.', severity: 'high' },
  { title: 'Hiring Prediction', description: 'Based on current pipeline, expect 22 hires this month — 8% above target.', severity: 'medium' },
  { title: 'Payroll Anomaly', description: 'Overtime costs increased 15% in Operations department. Recommend review.', severity: 'medium' },
  { title: 'Skill Gap Detected', description: 'Cloud Architecture skills deficit in Engineering. Suggest upskilling program.', severity: 'low' },
];

const DEPT_COLORS = ['#059669', '#0d9488', '#0891b2', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

// Safe toLocaleString helper
function safeLocaleString(val: unknown): string {
  if (val == null || val === undefined) return '0';
  if (typeof val === 'number') return val.toLocaleString();
  return String(val);
}

interface DashboardData {
  stats: {
    totalEmployees: number;
    newHires: number;
    openPositions: number;
    attendanceRate: number;
    pendingApprovals: number;
    unreadNotifications: number;
  };
  recentActivities: { id: string; action: string; entity: string; details: string; createdAt: string; user?: { name: string; email: string } }[];
  departmentStats: { departmentId: string; departmentName: string; count: number }[];
}

export function Dashboard() {
  const { setActiveModule, currentCompany } = useAppStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const companyId = currentCompany?.id || '';
        const [dashboardRes, analyticsRes] = await Promise.all([
          getDashboardStats(companyId),
          getAnalytics(companyId),
        ]);
        setData(dashboardRes as unknown as DashboardData);
        setAnalyticsData(analyticsRes as Record<string, unknown>);
        setError(null);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentCompany?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="ml-3 text-muted-foreground">Loading dashboard data...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  const stats = data?.stats || data;
  const totalEmployees = (stats as Record<string, unknown>)?.totalEmployees ?? (data as Record<string, unknown>)?.totalEmployees ?? 0;
  const newHires = (stats as Record<string, unknown>)?.newHires ?? (data as Record<string, unknown>)?.newHires ?? 0;
  const openPositions = (stats as Record<string, unknown>)?.openPositions ?? (data as Record<string, unknown>)?.openPositions ?? 0;
  const attendanceRate = (stats as Record<string, unknown>)?.attendanceRate ?? (data as Record<string, unknown>)?.attendanceRate ?? 0;
  const pendingApprovals = (stats as Record<string, unknown>)?.pendingApprovals ?? (data as Record<string, unknown>)?.pendingApprovals ?? 0;
  const attritionRate = (analyticsData as Record<string, Record<string, unknown>> | null)?.attrition
    ? Number(((analyticsData as Record<string, Record<string, unknown>>)?.attrition as Record<string, unknown>)?.rate ?? 0)
    : 0;

  const kpiCards = [
    { label: 'Total Employees', value: safeLocaleString(totalEmployees), change: 4.2, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'New Hires (This Month)', value: safeLocaleString(newHires), change: 12.5, icon: UserPlus, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950/30' },
    { label: 'Open Positions', value: safeLocaleString(openPositions), change: -8.3, icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
    { label: 'Attrition Rate', value: `${attritionRate}%`, change: -0.8, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
    { label: 'Attendance Today', value: `${attendanceRate}%`, change: 1.2, icon: Clock, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
    { label: 'Pending Approvals', value: safeLocaleString(pendingApprovals), change: -25, icon: CheckSquare, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-green-950/30' },
  ];

  // Convert departmentStats to chart format with colors
  const rawDeptData = (data as Record<string, unknown>)?.departmentDistribution || data?.departmentStats || [];
  const deptData = (Array.isArray(rawDeptData) ? rawDeptData : []).map((d: Record<string, unknown>, i: number) => ({
    name: (d.departmentName as string) || (d.name as string) || 'Unknown',
    value: (d.count as number) || (d.value as number) || 0,
    color: DEPT_COLORS[i % DEPT_COLORS.length],
  }));

  // Recent activities  
  const rawActivities = (data as Record<string, unknown>)?.recentActivities || data?.recentActivities || [];
  const recentActivities = Array.isArray(rawActivities) ? rawActivities : [];

  // Analytics charts
  const headcountTrends = (analyticsData as Record<string, unknown> | null)?.headcountTrends as { month: string; count: number }[] | undefined;
  const hiringFunnel = (analyticsData as Record<string, unknown> | null)?.hiringFunnel as { applications: number; screened: number; interviewed: number; offered: number; hired: number } | undefined;
  const payrollCosts = (analyticsData as Record<string, unknown> | null)?.payrollCosts as { month: string; totalGross: number; totalNet: number; totalDeductions: number }[] | undefined;

  const headcountChart = headcountTrends
    ? headcountTrends.map((h) => ({ name: h.month, count: h.count ?? 0 }))
    : [];

  const hiringChartData = hiringFunnel
    ? [
        { name: 'Applied', value: hiringFunnel.applications ?? 0 },
        { name: 'Screened', value: hiringFunnel.screened ?? 0 },
        { name: 'Interviewed', value: hiringFunnel.interviewed ?? 0 },
        { name: 'Offered', value: hiringFunnel.offered ?? 0 },
        { name: 'Hired', value: hiringFunnel.hired ?? 0 },
      ]
    : [];

  const payrollChart = payrollCosts
    ? payrollCosts.map((p) => ({ name: p.month, cost: (p.totalGross ?? 0) / 1000 }))
    : [];

  const recentActivities = data?.recentActivities || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Welcome back! Here&apos;s your HR overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
            <Activity className="h-3 w-3 mr-1" /> Live
          </Badge>
          <Badge variant="secondary">{currentCompany?.name || 'All Companies'}</Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <span className={`text-xs font-medium flex items-center gap-0.5 ${kpi.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {kpi.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(kpi.change)}%
                </span>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Headcount Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Headcount Trend</CardTitle>
            <CardDescription>Employee headcount over time</CardDescription>
          </CardHeader>
          <CardContent>
            {headcountChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={headcountChart}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#059669" strokeWidth={2} dot={{ fill: '#059669', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No headcount data available</div>
            )}
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Department Distribution</CardTitle>
            <CardDescription>Employee distribution by department</CardDescription>
          </CardHeader>
          <CardContent>
            {deptData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={deptData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {deptData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} employees`, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No department data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hiring Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hiring Funnel</CardTitle>
            <CardDescription>Application to hire conversion</CardDescription>
          </CardHeader>
          <CardContent>
            {hiringChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hiringChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#059669" radius={[2, 2, 0, 0]} name="Candidates" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No hiring data available</div>
            )}
          </CardContent>
        </Card>

        {/* Payroll Cost Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payroll Cost Trend</CardTitle>
            <CardDescription>Monthly payroll expenditure (in thousands)</CardDescription>
          </CardHeader>
          <CardContent>
            {payrollChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={payrollChart}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => [`$${safeLocaleString(value)}K`, 'Cost']} />
                  <Area type="monotone" dataKey="cost" stroke="#059669" fill="#059669" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No payroll data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Recent Activities + AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-600" /> Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1.5 hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-950/30"
                  onClick={() => setActiveModule(action.module)}
                >
                  <action.icon className="h-5 w-5 text-emerald-600" />
                  <span className="text-xs">{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" /> Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 overflow-y-auto">
            <div className="space-y-3">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity, idx) => (
                  <div key={activity.id || idx} className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      activity.action === 'CREATE' ? 'bg-emerald-500' :
                      activity.action === 'UPDATE' ? 'bg-amber-500' :
                      activity.action === 'DELETE' ? 'bg-red-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{activity.details || `${activity.action} on ${activity.entity}`}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : 'Just now'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent activities</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" /> AI Insights
            </CardTitle>
            <CardDescription>AI-powered predictions and alerts</CardDescription>
          </CardHeader>
          <CardContent className="max-h-72 overflow-y-auto">
            <div className="space-y-3">
              {AI_INSIGHTS.map((insight, i) => (
                <div key={i} className="p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className={`text-[10px] h-5 ${
                      insight.severity === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' :
                      insight.severity === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                      'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                    }`}>
                      {insight.severity}
                    </Badge>
                    <span className="text-sm font-medium">{insight.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{insight.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
