'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getPayroll, createPayroll } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard, Wallet,
  CheckCircle2, Clock, FileText, Download, Loader2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { toast } from 'sonner';

const PAYROLL_STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  processed: 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400',
  draft: 'bg-slate-100 text-slate-800 dark:bg-slate-950/30 dark:text-slate-400',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
};

const payrollCostData = [
  { name: 'Jul', cost: 2.8 },
  { name: 'Aug', cost: 2.85 },
  { name: 'Sep', cost: 2.9 },
  { name: 'Oct', cost: 2.95 },
  { name: 'Nov', cost: 3.0 },
  { name: 'Dec', cost: 3.05 },
  { name: 'Jan', cost: 3.1 },
];

interface PayrollData {
  id: string; basicPay: number; grossSalary: number; totalDeductions: number;
  netSalary: number; status: string; paymentDate: string | null;
  employee: { id: string; firstName: string; lastName: string } | string;
  month?: number; year?: number;
}

export function Payroll() {
  const { currentCompany } = useAppStore();
  const [payrollData, setPayrollData] = useState<PayrollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('1');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [processing, setProcessing] = useState(false);

  const fetchPayroll = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPayroll({
        companyId: currentCompany?.id,
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
      });
      setPayrollData((res as { data: PayrollData[] }).data || []);
    } catch {
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchPayroll(); }, [fetchPayroll]);

  const totalPayout = payrollData.reduce((sum, p) => sum + (p.netSalary || 0), 0);
  const totalDeductions = payrollData.reduce((sum, p) => sum + (p.totalDeductions || 0), 0);
  const totalGross = payrollData.reduce((sum, p) => sum + (p.grossSalary || 0), 0);

  const getEmployeeName = (record: PayrollData) => {
    if (typeof record.employee === 'string') return record.employee;
    return `${record.employee.firstName} ${record.employee.lastName}`;
  };

  const handleRunPayroll = async () => {
    try {
      setProcessing(true);
      await createPayroll({
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
        companyId: currentCompany?.id,
      });
      toast.success('Payroll processing initiated');
      fetchPayroll();
    } catch {
      toast.error('Failed to process payroll');
    } finally {
      setProcessing(false);
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground text-sm">Process and manage employee compensation</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleRunPayroll} disabled={processing}>
            {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <CreditCard className="h-4 w-4 mr-2" /> Run Payroll
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${(totalGross ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Gross Salary</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${(totalDeductions ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Deductions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/30">
              <DollarSign className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${(totalPayout ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Net Payout</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{payrollData.filter(p => p.status === 'paid').length}/{payrollData.length}</p>
              <p className="text-xs text-muted-foreground">Payments Processed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Cost Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payroll Cost Trend (in $M)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={payrollCostData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`$${value}M`, 'Cost']} />
              <Area type="monotone" dataKey="cost" stroke="#059669" fill="#059669" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Payroll Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Payroll Details — {monthNames[parseInt(selectedMonth) - 1]} {selectedYear}</CardTitle>
              <CardDescription>Individual employee payroll breakdown</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5 mr-1" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Basic Pay</TableHead>
                  <TableHead>Gross Salary</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollData.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{getEmployeeName(record)}</TableCell>
                    <TableCell>${(record.basicPay || 0).toLocaleString()}</TableCell>
                    <TableCell>${(record.grossSalary || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-red-600">-${(record.totalDeductions || 0).toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">${(record.netSalary || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${PAYROLL_STATUS_COLORS[record.status] || ''}`}>
                        {record.status === 'paid' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {record.status === 'processed' && <Clock className="h-3 w-3 mr-1" />}
                        {record.status === 'draft' && <FileText className="h-3 w-3 mr-1" />}
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{record.paymentDate || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
