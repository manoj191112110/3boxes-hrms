'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getAssets, createAsset, updateAsset } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Monitor, Laptop, Smartphone, Printer, Wifi, Server, Plus, RotateCcw, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';

const ASSET_TYPE_ICONS: Record<string, React.ReactNode> = {
  laptop: <Laptop className="h-5 w-5" />,
  desktop: <Monitor className="h-5 w-5" />,
  mobile: <Smartphone className="h-5 w-5" />,
  printer: <Printer className="h-5 w-5" />,
  network: <Wifi className="h-5 w-5" />,
  server: <Server className="h-5 w-5" />,
};

const STATUS_COLORS: Record<string, string> = {
  allocated: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  available: 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400',
  damaged: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
  return_requested: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
};

const ASSET_DISTRIBUTION = [
  { name: 'Allocated', value: 1083, color: '#059669' },
  { name: 'Available', value: 67, color: '#3b82f6' },
  { name: 'Damaged', value: 12, color: '#ef4444' },
  { name: 'In Repair', value: 8, color: '#f59e0b' },
];

interface AssetData {
  id: string; assetName: string; assetType: string; serial: string; status: string;
  condition: string; assignedTo: string | { firstName: string; lastName: string }; allocatedDate: string;
}

export function Assets() {
  const { user, currentCompany } = useAppStore();
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    assetName: '', assetType: 'laptop', serial: '',
  });

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAssets({ companyId: currentCompany?.id });
      setAssets((res as { data: AssetData[] }).data || []);
    } catch {
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  // Compute asset type summaries
  const assetTypeMap = new Map<string, { count: number; allocated: number; available: number }>();
  assets.forEach(a => {
    const type = a.assetType || 'other';
    if (!assetTypeMap.has(type)) assetTypeMap.set(type, { count: 0, allocated: 0, available: 0 });
    const entry = assetTypeMap.get(type)!;
    entry.count++;
    if (a.status === 'allocated') entry.allocated++;
    if (a.status === 'available') entry.available++;
  });

  const assetTypeCards = Array.from(assetTypeMap.entries()).map(([type, data]) => ({
    type, ...data, icon: ASSET_TYPE_ICONS[type] || <Monitor className="h-5 w-5" />,
    color: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600',
  }));

  const getAssignedTo = (asset: AssetData) => {
    if (!asset.assignedTo) return 'Unallocated';
    if (typeof asset.assignedTo === 'string') return asset.assignedTo;
    return `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}`;
  };

  const handleCreateAsset = async () => {
    try {
      setSubmitting(true);
      await createAsset({
        ...form,
        status: 'available',
        condition: 'good',
        companyId: currentCompany?.id,
      });
      toast.success('Asset added successfully');
      setShowAddDialog(false);
      setForm({ assetName: '', assetType: 'laptop', serial: '' });
      fetchAssets();
    } catch {
      toast.error('Failed to add asset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnAsset = async (id: string) => {
    try {
      await updateAsset(id, { status: 'available', assignedTo: null });
      toast.success('Asset returned successfully');
      fetchAssets();
    } catch {
      toast.error('Failed to return asset');
    }
  };

  const handleAllocateAsset = async (id: string) => {
    const employeeId = user?.employeeId;
    if (!employeeId) {
      toast.error('Employee ID not found. Please log in again.');
      return;
    }
    try {
      await updateAsset(id, {
        status: 'allocated',
        assignedTo: employeeId,
        allocatedDate: new Date().toISOString().split('T')[0],
      });
      toast.success('Asset allocated');
      fetchAssets();
    } catch {
      toast.error('Failed to allocate asset');
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
          <h1 className="text-2xl font-bold tracking-tight">Asset Management</h1>
          <p className="text-muted-foreground text-sm">Track and manage company assets</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Asset
        </Button>
      </div>

      {/* Asset Type Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {assetTypeCards.length > 0 ? assetTypeCards.map(asset => (
          <Card key={asset.type}>
            <CardContent className="p-4 text-center">
              <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center mb-2 ${asset.color}`}>
                {asset.icon}
              </div>
              <p className="text-lg font-bold">{asset.count}</p>
              <p className="text-xs text-muted-foreground capitalize">{asset.type}</p>
              <div className="flex items-center justify-center gap-2 mt-2 text-[10px]">
                <span className="text-emerald-600">{asset.allocated} used</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-green-600">{asset.available} free</span>
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card className="col-span-full">
            <CardContent className="p-4 text-center text-muted-foreground">
              No assets found. Add one to get started.
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Asset Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Asset Allocations</CardTitle>
            <CardDescription>Current asset assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map(asset => (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{asset.assetName}</p>
                          <p className="text-xs text-muted-foreground capitalize">{asset.assetType}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{asset.serial || '—'}</TableCell>
                      <TableCell>{getAssignedTo(asset)}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${STATUS_COLORS[asset.status] || ''}`}>{asset.status.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>
                        {asset.status === 'available' ? (
                          <Button size="sm" variant="outline" onClick={() => handleAllocateAsset(asset.id)}>Allocate</Button>
                        ) : asset.status === 'return_requested' ? (
                          <Button size="sm" variant="outline" onClick={() => handleReturnAsset(asset.id)}><RotateCcw className="h-3 w-3 mr-1" />Accept Return</Button>
                        ) : asset.status === 'allocated' ? (
                          <Button size="sm" variant="ghost" onClick={() => handleReturnAsset(asset.id)}><RotateCcw className="h-3 w-3 mr-1" />Return</Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Asset Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={ASSET_DISTRIBUTION} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" paddingAngle={2}>
                  {ASSET_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Add Asset Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
            <DialogDescription>Register a new company asset</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Asset Name</Label>
              <Input placeholder="e.g. MacBook Pro 16&quot;" value={form.assetName} onChange={(e) => setForm(f => ({ ...f, assetName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Asset Type</Label>
              <Select value={form.assetType} onValueChange={(v) => setForm(f => ({ ...f, assetType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                  <SelectItem value="mobile">Mobile Phone</SelectItem>
                  <SelectItem value="printer">Printer</SelectItem>
                  <SelectItem value="network">Network Device</SelectItem>
                  <SelectItem value="server">Server</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Serial Number</Label>
              <Input placeholder="Serial number" value={form.serial} onChange={(e) => setForm(f => ({ ...f, serial: e.target.value }))} />
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateAsset} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Asset
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
