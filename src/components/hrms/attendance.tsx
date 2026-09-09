'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getAttendance, checkIn, checkOut } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  CheckCircle2, XCircle, Clock, AlertCircle, Fingerprint,
  MapPin, Smartphone, Globe, Wifi, BarChart3, Loader2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

const ATTENDANCE_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  present: { label: 'Present', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400', icon: <CheckCircle2 className="h-4 w-4" /> },
  absent: { label: 'Absent', color: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400', icon: <XCircle className="h-4 w-4" /> },
  late: { label: 'Late', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400', icon: <Clock className="h-4 w-4" /> },
  half_day: { label: 'Half Day', color: 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400', icon: <AlertCircle className="h-4 w-4" /> },
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  biometric: <Fingerprint className="h-3.5 w-3.5" />,
  gps: <MapPin className="h-3.5 w-3.5" />,
  mobile: <Smartphone className="h-3.5 w-3.5" />,
  web: <Globe className="h-3.5 w-3.5" />,
  rfid: <Wifi className="h-3.5 w-3.5" />,
};

const weeklyData = [
  { day: 'Mon', Present: 92, Absent: 4, Late: 4 },
  { day: 'Tue', Present: 88, Absent: 6, Late: 6 },
  { day: 'Wed', Present: 90, Absent: 5, Late: 5 },
  { day: 'Thu', Present: 91, Absent: 4, Late: 5 },
  { day: 'Fri', Present: 85, Absent: 8, Late: 7 },
];

interface AttendanceRecord {
  id: string; date: string; checkIn: string | null; checkOut: string | null;
  workHours: number; status: string; source: string;
  employee: { id: string; firstName: string; lastName: string } | string;
}

export function Attendance() {
  const { currentCompany, user } = useAppStore();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [checkingIn, setCheckingIn] = useState(false);

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (dateFilter) params.date = dateFilter;
      if (currentCompany?.id) params.companyId = currentCompany.id;
      const res = await getAttendance(params);
      const data = (res as { data: AttendanceRecord[] }).data || [];
      setRecords(data);
    } catch {
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const onLeaveCount = records.filter(r => r.status === 'half_day' || r.status === 'on_leave').length;

  const summaryCards = [
    { label: 'Present Today', value: records.length > 0 ? `${Math.round(presentCount / records.length * 100)}%` : '0%', icon: <CheckCircle2 className="h-5 w-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'Absent', value: records.length > 0 ? `${Math.round(absentCount / records.length * 100)}%` : '0%', icon: <XCircle className="h-5 w-5" />, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
    { label: 'Late Arrivals', value: records.length > 0 ? `${Math.round(lateCount / records.length * 100)}%` : '0%', icon: <Clock className="h-5 w-5" />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
    { label: 'On Leave', value: records.length > 0 ? `${Math.round(onLeaveCount / records.length * 100)}%` : '0%', icon: <AlertCircle className="h-5 w-5" />, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
  ];

  const handleCheckIn = async () => {
    const employeeId = user?.employeeId;
    if (!employeeId) {
      toast.error('Employee ID not found. Please log in again.');
      return;
    }
    try {
      setCheckingIn(true);
      await checkIn(employeeId);
      toast.success('Checked in successfully');
      fetchAttendance();
    } catch {
      toast.error('Failed to check in');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async (id: string) => {
    try {
      await checkOut(id);
      toast.success('Checked out successfully');
      fetchAttendance();
    } catch {
      toast.error('Failed to check out');
    }
  };

  const getEmployeeName = (record: AttendanceRecord) => {
    if (typeof record.employee === 'string') return record.employee;
    return `${record.employee.firstName} ${record.employee.lastName}`;
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
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground text-sm">Track daily attendance and work hours</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-40" />
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCheckIn} disabled={checkingIn}>
            {checkingIn && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Check In
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <Card key={card.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${card.bg}`}>
                <span className={card.color}>{card.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weekly Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-600" /> Weekly Attendance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="Present" fill="#059669" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Late" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Absent" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Today&apos;s Attendance</CardTitle>
          <CardDescription>Detailed attendance records for {dateFilter}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Work Hours</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(record => {
                  const status = ATTENDANCE_STATUS[record.status] || ATTENDANCE_STATUS.present;
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{getEmployeeName(record)}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${status.color}`}>
                          <span className="mr-1 inline-flex">{status.icon}</span>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.checkIn || '—'}</TableCell>
                      <TableCell>{record.checkOut || '—'}</TableCell>
                      <TableCell>{record.workHours > 0 ? `${record.workHours}h` : '—'}</TableCell>
                      <TableCell>
                        {record.source && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {SOURCE_ICONS[record.source]}
                            <span className="capitalize">{record.source}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {!record.checkIn && (
                          <Button size="sm" variant="outline" className="text-xs" onClick={handleCheckIn}>Check In</Button>
                        )}
                        {record.checkIn && !record.checkOut && (
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => handleCheckOut(record.id)}>Check Out</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
