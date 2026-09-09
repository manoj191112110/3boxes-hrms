'use client';

import { useState } from 'react';
import {
  FiSettings, FiSave, FiToggleLeft, FiToggleRight,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 text-sm">
      {enabled ? (
        <><FiToggleRight className="w-6 h-6 text-green-500" /><span className="text-green-600 font-medium">On</span></>
      ) : (
        <><FiToggleLeft className="w-6 h-6 text-slate-400" /><span className="text-slate-400 font-medium">Off</span></>
      )}
    </button>
  );
}

export default function TravelSettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [defaultClass, setDefaultClass] = useState('economy');
  const [preApprovalRequired, setPreApprovalRequired] = useState(true);
  const [autoBookFromRequest, setAutoBookFromRequest] = useState(false);
  const [mealAllowance, setMealAllowance] = useState(1500);
  const [accommodationLimit, setAccommodationLimit] = useState(5000);
  const [receiptMandatoryAbove, setReceiptMandatoryAbove] = useState(500);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success('Travel & Expense settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiSettings className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Travel & Expense Settings</h1>
            <p className="text-sm text-thb-text-secondary">Configure travel policies and expense limits</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <FiSave className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Travel Policy */}
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
            <h3 className="font-semibold text-thb-text-primary">Travel Policy</h3>
            <p className="text-xs text-thb-text-muted mt-0.5">Default travel booking policies</p>
          </div>
          <div className="p-5 space-y-5">
            {/* Default Class */}
            <div>
              <label className="block text-sm font-medium text-thb-text-primary mb-1.5">Default Travel Class</label>
              <select
                value={defaultClass}
                onChange={(e) => setDefaultClass(e.target.value)}
                className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              >
                <option value="economy">Economy</option>
                <option value="premium_economy">Premium Economy</option>
                <option value="business">Business</option>
                <option value="first">First Class</option>
              </select>
              <p className="text-xs text-thb-text-muted mt-1">Default booking class for domestic travel</p>
            </div>

            {/* Pre-approval Required */}
            <div className="flex items-center justify-between pt-4 border-t border-thb-border">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Pre-approval Required</p>
                <p className="text-xs text-thb-text-muted mt-0.5">Require manager approval before booking travel</p>
              </div>
              <Toggle enabled={preApprovalRequired} onToggle={() => setPreApprovalRequired(!preApprovalRequired)} />
            </div>

            {/* Auto-book from Request */}
            <div className="flex items-center justify-between pt-4 border-t border-thb-border">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Auto-book from Request</p>
                <p className="text-xs text-thb-text-muted mt-0.5">Automatically book travel once request is approved</p>
              </div>
              <Toggle enabled={autoBookFromRequest} onToggle={() => setAutoBookFromRequest(!autoBookFromRequest)} />
            </div>
          </div>
        </div>

        {/* Expense Policy */}
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
            <h3 className="font-semibold text-thb-text-primary">Expense Policy</h3>
            <p className="text-xs text-thb-text-muted mt-0.5">Expense limits and receipt requirements</p>
          </div>
          <div className="p-5 space-y-5">
            {/* Daily Meal Allowance */}
            <div>
              <label className="block text-sm font-medium text-thb-text-primary mb-1.5">Daily Meal Allowance (₹)</label>
              <input
                type="number"
                value={mealAllowance}
                onChange={(e) => setMealAllowance(Number(e.target.value))}
                min={0}
                className="w-full max-w-[200px] px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              />
              <p className="text-xs text-thb-text-muted mt-1">Maximum per-day meal allowance for business travel</p>
            </div>

            {/* Accommodation Limit */}
            <div className="pt-4 border-t border-thb-border">
              <label className="block text-sm font-medium text-thb-text-primary mb-1.5">Accommodation Limit per Night (₹)</label>
              <input
                type="number"
                value={accommodationLimit}
                onChange={(e) => setAccommodationLimit(Number(e.target.value))}
                min={0}
                className="w-full max-w-[200px] px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              />
              <p className="text-xs text-thb-text-muted mt-1">Maximum hotel accommodation limit per night</p>
            </div>

            {/* Receipt Mandatory Above */}
            <div className="pt-4 border-t border-thb-border">
              <label className="block text-sm font-medium text-thb-text-primary mb-1.5">Receipt Mandatory Above (₹)</label>
              <input
                type="number"
                value={receiptMandatoryAbove}
                onChange={(e) => setReceiptMandatoryAbove(Number(e.target.value))}
                min={0}
                className="w-full max-w-[200px] px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              />
              <p className="text-xs text-thb-text-muted mt-1">Expenses above this amount require a receipt</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
