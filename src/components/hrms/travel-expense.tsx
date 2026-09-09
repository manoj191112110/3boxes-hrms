'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getTravelRequests, getExpenses, createTravelRequest, createExpense, approveRejectTravel, approveRejectExpense } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plane, Receipt, Plus, CheckCircle2, XCircle, Clock, AlertCircle,
  MapPin, DollarSign, ShieldCheck, Download, Loader2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { toast } from 'sonner';

const EXPENSE_BY_CATEGORY = [
  { name: 'Flight', value: 8200, color: '#059669' },
  { name: 'Hotel', value: 5400, color: '#10b981' },
  { name: 'Meals', value: 2100, color: '#f59e0b' },
  { name: 'Transport', value: 1800, color: '#3b82f6' },
  { name: 'Conference', value: 3500, color: '#8b5cf6' },
  { name: 'Other', value: 900, color: '#6b7280' },
];

const monthlyExpenseData = [
  { month: 'Aug', amount: 12500 },
  { month: 'Sep', amount: 15200 },
  { month: 'Oct', amount: 11800 },
  { month: 'Nov', amount: 18500 },
  { month: 'Dec', amount: 14200 },
  { month: 'Jan', amount: 16800 },
];

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
};

const RECEIPT_COLORS: Record<string, string> = {
  uploaded: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  missing: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
};

interface TravelData {
  id: string; destination: string; purpose: string; startDate: string; endDate: string;
  estimatedCost: number; status: string; policyCompliant: boolean;
  employee: { id: string; firstName: string; lastName: string } | string;
}

interface ExpenseData {
  id: string; category: string; amount: number; date: string; receipt: string; status: string;
  employee: { id: string; firstName: string; lastName: string } | string;
}

export function TravelExpense() {
  const { user, currentCompany } = useAppStore();
  const [travelRequests, setTravelRequests] = useState<TravelData[]>([]);
  const [expenseClaims, setExpenseClaims] = useState<ExpenseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTravelDialog, setShowTravelDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [travelForm, setTravelForm] = useState({
    destination: '', purpose: '', startDate: '', endDate: '', estimatedCost: '',
  });
  const [expenseForm, setExpenseForm] = useState({
    category: 'flight', amount: '', date: '', receipt: 'uploaded',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [travelRes, expenseRes] = await Promise.all([
        getTravelRequests({ companyId: currentCompany?.id }),
        getExpenses({ companyId: currentCompany?.id }),
      ]);
      setTravelRequests((travelRes as { data: TravelData[] }).data || []);
      setExpenseClaims((expenseRes as { data: ExpenseData[] }).data || []);
    } catch {
      toast.error('Failed to load travel & expense data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getEmployeeName = (emp: { id: string; firstName: string; lastName: string } | string) => {
    if (typeof emp === 'string') return emp;
    return `${emp.firstName} ${emp.lastName}`;
  };

  const handleCreateTravel = async () => {
    const employeeId = user?.employeeId;
    if (!employeeId) {
      toast.error('Employee ID not found. Please log in again.');
      return;
    }
    try {
      setSubmitting(true);
      await createTravelRequest({
        ...travelForm,
        estimatedCost: parseFloat(travelForm.estimatedCost) || 0,
        employeeId,
        status: 'pending',
        policyCompliant: true,
      });
      toast.success('Travel request submitted');
      setShowTravelDialog(false);
      setTravelForm({ destination: '', purpose: '', startDate: '', endDate: '', estimatedCost: '' });
      fetchData();
    } catch {
      toast.error('Failed to create travel request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateExpense = async () => {
    const employeeId = user?.employeeId;
    if (!employeeId) {
      toast.error('Employee ID not found. Please log in again.');
      return;
    }
    try {
      setSubmitting(true);
      await createExpense({
        ...expenseForm,
        amount: parseFloat(expenseForm.amount) || 0,
        employeeId,
        status: 'pending',
      });
      toast.success('Expense claim submitted');
      setShowExpenseDialog(false);
      setExpenseForm({ category: 'flight', amount: '', date: '', receipt: 'uploaded' });
      fetchData();
    } catch {
      toast.error('Failed to create expense claim');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTravelAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      await approveRejectTravel(id, action);
      toast.success(`Travel request ${action}d`);
      fetchData();
    } catch {
      toast.error(`Failed to ${action} travel request`);
    }
  };

  const handleExpenseAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      await approveRejectExpense(id, action);
      toast.success(`Expense claim ${action}d`);
      fetchData();
    } catch {
      toast.error(`Failed to ${action} expense claim`);
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
          <h1 className="text-2xl font-bold tracking-tight">Travel & Expense</h1>
          <p className="text-muted-foreground text-sm">Manage travel requests and expense claims</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTravelDialog(true)}><Plane className="h-4 w-4 mr-2" /> Travel Request</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowExpenseDialog(true)}><Receipt className="h-4 w-4 mr-2" /> Expense Claim</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Plane className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-2xl font-bold">{travelRequests.length}</p>
            <p className="text-xs text-muted-foreground">Travel Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Receipt className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">${expenseClaims.reduce((s, e) => s + (e.amount || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Pending Claims</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ShieldCheck className="h-5 w-5 mx-auto text-teal-600 mb-1" />
            <p className="text-2xl font-bold">{travelRequests.length > 0 ? Math.round(travelRequests.filter(t => t.policyCompliant).length / travelRequests.length * 100) : 0}%</p>
            <p className="text-xs text-muted-foreground">Policy Compliance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            <p className="text-2xl font-bold">{travelRequests.filter(t => t.status === 'pending').length}</p>
            <p className="text-xs text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="travel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="travel">Travel Requests</TabsTrigger>
          <TabsTrigger value="expenses">Expense Claims</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="travel">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Est. Cost</TableHead>
                      <TableHead>Policy</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {travelRequests.map(req => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{getEmployeeName(req.employee)}</TableCell>
                        <TableCell className="flex items-center gap-1"><MapPin className="h-3 w-3" />{req.destination}</TableCell>
                        <TableCell>{req.purpose}</TableCell>
                        <TableCell>{req.startDate} → {req.endDate}</TableCell>
                        <TableCell>${(req.estimatedCost || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          {req.policyCompliant ? (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-3 w-3 mr-1" />Compliant</Badge>
                          ) : (
                            <Badge className="text-[10px] bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />Violation</Badge>
                          )}
                        </TableCell>
                        <TableCell><Badge className={`text-[10px] ${STATUS_COLORS[req.status] || ''}`}>{req.status}</Badge></TableCell>
                        <TableCell>
                          {req.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleTravelAction(req.id, 'approve')}><CheckCircle2 className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => handleTravelAction(req.id, 'reject')}><XCircle className="h-4 w-4" /></Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseClaims.map(claim => (
                      <TableRow key={claim.id}>
                        <TableCell className="font-medium">{getEmployeeName(claim.employee)}</TableCell>
                        <TableCell>{claim.category}</TableCell>
                        <TableCell>${(claim.amount || 0).toLocaleString()}</TableCell>
                        <TableCell>{claim.date}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${RECEIPT_COLORS[claim.receipt] || ''}`}>
                            {claim.receipt === 'uploaded' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                            {claim.receipt}
                          </Badge>
                        </TableCell>
                        <TableCell><Badge className={`text-[10px] ${STATUS_COLORS[claim.status] || ''}`}>{claim.status}</Badge></TableCell>
                        <TableCell>
                          {claim.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleExpenseAction(claim.id, 'approve')}><CheckCircle2 className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => handleExpenseAction(claim.id, 'reject')}><XCircle className="h-4 w-4" /></Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Expense by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={EXPENSE_BY_CATEGORY} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" paddingAngle={2}>
                      {EXPENSE_BY_CATEGORY.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`$${(value ?? 0).toLocaleString()}`, 'Amount']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Monthly Expense Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyExpenseData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => [`$${(value ?? 0).toLocaleString()}`, 'Expense']} />
                    <Bar dataKey="amount" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Travel Request Dialog */}
      <Dialog open={showTravelDialog} onOpenChange={setShowTravelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Travel Request</DialogTitle>
            <DialogDescription>Submit a new travel request for approval</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Destination</Label>
              <Input placeholder="Travel destination" value={travelForm.destination} onChange={(e) => setTravelForm(f => ({ ...f, destination: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Purpose</Label>
              <Input placeholder="Purpose of travel" value={travelForm.purpose} onChange={(e) => setTravelForm(f => ({ ...f, purpose: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Start Date</Label>
                <Input type="date" value={travelForm.startDate} onChange={(e) => setTravelForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">End Date</Label>
                <Input type="date" value={travelForm.endDate} onChange={(e) => setTravelForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Estimated Cost ($)</Label>
              <Input type="number" placeholder="0" value={travelForm.estimatedCost} onChange={(e) => setTravelForm(f => ({ ...f, estimatedCost: e.target.value }))} />
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateTravel} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Travel Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Claim Dialog */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Expense Claim</DialogTitle>
            <DialogDescription>Submit an expense claim for reimbursement</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Category</Label>
              <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flight">Flight</SelectItem>
                  <SelectItem value="hotel">Hotel</SelectItem>
                  <SelectItem value="meals">Meals</SelectItem>
                  <SelectItem value="transport">Transport</SelectItem>
                  <SelectItem value="conference">Conference</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Amount ($)</Label>
              <Input type="number" placeholder="0" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Date</Label>
              <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateExpense} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Expense Claim
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
