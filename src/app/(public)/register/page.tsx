'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateEmail, validatePhone, validateName } from '@/lib/validators';

const industries = [
  'Technology / IT Services',
  'Consulting',
  'Manufacturing',
  'Healthcare',
  'Finance / Banking',
  'Retail / E-Commerce',
  'Education',
  'Real Estate',
  'Logistics / Transportation',
  'Hospitality',
  'Media / Entertainment',
  'Other',
];

const availableModules = [
  { key: 'employees', label: 'Employee Management', desc: 'Employee database, profiles & documents' },
  { key: 'attendance', label: 'Attendance', desc: 'Biometric, GPS & shift-based tracking' },
  { key: 'leave', label: 'Leave Management', desc: 'Leave types, balances & approval workflows' },
  { key: 'payroll', label: 'Payroll', desc: 'Salary structures, runs & payslips' },
  { key: 'recruitment', label: 'Recruitment (ATS)', desc: 'Job postings, candidate pipeline & offers' },
  { key: 'onboarding', label: 'Onboarding', desc: 'Task checklists & welcome workflows' },
  { key: 'performance', label: 'Performance', desc: 'Reviews, goals & OKR tracking' },
  { key: 'travel_expense', label: 'Travel & Expense', desc: 'Travel requests & expense claims' },
  { key: 'helpdesk', label: 'Helpdesk', desc: 'Ticket management & SLA tracking' },
  { key: 'analytics', label: 'Analytics', desc: 'Dashboards & custom reports' },
  { key: 'ai_chatbot', label: 'AI Chatbot', desc: 'AI-powered HR assistant' },
];

export default function TrialRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);
  const [codeAvailable, setCodeAvailable] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [registrationCode, setRegistrationCode] = useState('');
  const [autoApproved, setAutoApproved] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    companyName: '',
    companyCode: '',
    companyEmail: '',
    companyPhone: '',
    companyWebsite: '',
    industry: '',
    country: 'IN',
    currency: 'INR',
    employeeCount: 10,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    designation: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    selectedModules: [] as string[],
    companyLogo: '' as string,
    employeeDataJson: '' as string,
  });

  const handleCodeCheck = async () => {
    if (!form.companyCode || form.companyCode.length < 3) return;
    setCheckingCode(true);
    setCodeAvailable(null);
    try {
      const res = await fetch('/api/trial/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyCode: form.companyCode }),
      });
      const data = await res.json();
      setCodeAvailable(data.available);
      if (data.available) {
        setRegistrationCode(data.slug);
      }
    } catch {
      setCodeAvailable(null);
    } finally {
      setCheckingCode(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm({ ...form, companyLogo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      // Parse CSV for simplicity (Excel can be saved as CSV)
      const lines = (data as string).split('\n').filter(l => l.trim());
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim());
      const employees = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim());
        const emp: any = {};
        headers.forEach((h, i) => { emp[h] = values[i] || ''; });
        return emp;
      });
      setForm({ ...form, employeeDataJson: JSON.stringify(employees) });
    };
    reader.readAsText(file);
  };

  const toggleModule = (key: string) => {
    setForm(prev => ({
      ...prev,
      selectedModules: prev.selectedModules.includes(key)
        ? prev.selectedModules.filter(m => m !== key)
        : [...prev.selectedModules, key],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation using centralized validators
    const companyNameResult = validateName(form.companyName, 'Company name');
    if (!companyNameResult.valid) { setError(companyNameResult.error!); return; }

    if (!form.companyCode || form.companyCode.trim().length < 3) {
      setError('Company code must be at least 3 characters'); return;
    }
    if (!/^[a-z0-9-]+$/i.test(form.companyCode.trim())) {
      setError('Company code can only contain letters, numbers, and hyphens'); return;
    }

    const companyEmailResult = validateEmail(form.companyEmail);
    if (!companyEmailResult.valid) { setError(companyEmailResult.error!); return; }

    if (form.companyPhone) {
      const phoneResult = validatePhone(form.companyPhone);
      if (!phoneResult.valid) { setError(phoneResult.error!); return; }
    }

    const contactNameResult = validateName(form.contactName, 'Contact name');
    if (!contactNameResult.valid) { setError(contactNameResult.error!); return; }

    const contactEmailResult = validateEmail(form.contactEmail);
    if (!contactEmailResult.valid) { setError(contactEmailResult.error!); return; }

    if (form.contactPhone) {
      const contactPhoneResult = validatePhone(form.contactPhone);
      if (!contactPhoneResult.valid) { setError(contactPhoneResult.error!); return; }
    }

    setLoading(true);

    try {
      const res = await fetch('/api/trial/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.');
        return;
      }

      setRegistrationCode(data.companyCode);
      setAutoApproved(data.autoApproved || false);
      setSubmitted(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl">
          {/* Success Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-t-2xl p-8 text-center text-white">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {autoApproved ? 'Your Trial is Ready!' : 'Registration Submitted!'}
            </h2>
            <p className="text-emerald-100">
              {autoApproved
                ? 'Your 3Boxes HRMS trial has been automatically activated. Login credentials are below.'
                : 'Thank you for your interest. Our team will review and approve your request within 24 hours.'}
            </p>
          </div>

          <div className="p-8 space-y-6">
            {/* Company Info */}
            <div className="bg-green-50 rounded-xl p-5">
              <h3 className="font-semibold text-green-900 mb-3">Your Trial Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-green-600">Company:</span> <span className="font-medium">{form.companyName}</span></div>
                <div><span className="text-green-600">Company Code:</span> <span className="font-mono bg-white px-2 py-0.5 rounded">{registrationCode}</span></div>
                <div><span className="text-green-600">Subdomain:</span> <span className="font-mono text-sm">{registrationCode}.3boxeshrms.com</span></div>
                <div><span className="text-green-600">Trial Period:</span> <span className="font-medium">15 days</span></div>
              </div>
            </div>

            {/* Auto-approved credentials */}
            {autoApproved && (
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5">
                <h3 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743A11.05 11.05 0 0110.5 7.5a2 2 0 114 0M9 15H7.5a2 2 0 01-2-2V7a2 2 0 012-2h5.5" />
                  </svg>
                  Your Login Credentials
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 bg-white p-3 rounded-lg border">
                    <span className="text-gray-500 w-24">Email:</span>
                    <span className="font-mono font-medium">{form.contactEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-3 rounded-lg border">
                    <span className="text-gray-500 w-24">Password:</span>
                    <span className="font-mono font-medium text-emerald-700">Check your email</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-3 rounded-lg border">
                    <span className="text-gray-500 w-24">Login URL:</span>
                    <span className="font-mono text-sm text-emerald-700">https://{registrationCode}.3boxeshrms.com/login</span>
                  </div>
                </div>
                <p className="text-xs text-emerald-600 mt-3">
                  A temporary password has been sent to <strong>{form.contactEmail}</strong>. 
                  Please check your inbox (and spam folder). You will be asked to change it on first login.
                </p>
              </div>
            )}

            {/* Module selection summary */}
            {form.selectedModules.length > 0 && (
              <div className="bg-emerald-50 rounded-xl p-5">
                <h3 className="font-semibold text-emerald-900 mb-3">Selected Modules for Trial</h3>
                <div className="flex flex-wrap gap-2">
                  {form.selectedModules.map(key => {
                    const mod = availableModules.find(m => m.key === key);
                    return (
                      <span key={key} className="px-3 py-1.5 bg-white rounded-lg text-sm font-medium text-emerald-700 border border-emerald-200">
                        {mod?.label || key}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Next steps */}
            <div className="bg-gray-50 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <div>
                    <p className="font-medium text-gray-800">Explore the platform</p>
                    <p className="text-gray-500">Login and try all the modules you selected. Upload sample employee data to test imports.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                  <div>
                    <p className="font-medium text-gray-800">Before trial ends</p>
                    <p className="text-gray-500">Choose a subscription plan to continue using 3Boxes HRMS without interruption.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                  <div>
                    <p className="font-medium text-gray-800">Full access after subscription</p>
                    <p className="text-gray-500">All your trial data, settings and configurations are preserved when you upgrade.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => router.push(`https://${registrationCode}.3boxeshrms.com/login`)}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-700 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-800 transition-all shadow-lg shadow-green-500/25"
              >
                Go to My Trial Login →
              </button>
              <button
                onClick={() => router.push('/login')}
                className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Back to Main Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-6 backdrop-blur-sm">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-3">Start Your Free Trial</h1>
          <p className="text-lg text-green-100 max-w-2xl mx-auto">
            Experience the full power of 3Boxes HRMS — HR, Payroll, Attendance, Recruitment, and more — free for 15 days. No credit card required.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto -mt-6 px-4 pb-16">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Step 1: Company Information */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-green-100 text-green-700 rounded-lg flex items-center justify-center text-sm font-bold">1</span>
              Company Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., Acme Technologies Pvt Ltd"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Code * <span className="text-xs text-gray-400">(becomes your subdomain)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={form.companyCode}
                    onChange={(e) => {
                      setForm({ ...form, companyCode: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') });
                      setCodeAvailable(null);
                    }}
                    onBlur={handleCodeCheck}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., acme-tech"
                  />
                  <button
                    type="button"
                    onClick={handleCodeCheck}
                    disabled={checkingCode || !form.companyCode}
                    className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 disabled:opacity-50 text-sm font-medium"
                  >
                    {checkingCode ? '...' : 'Check'}
                  </button>
                </div>
                {codeAvailable === true && (
                  <p className="text-xs text-green-600 mt-1">✓ Available — your URL: https://{form.companyCode}.3boxeshrms.com</p>
                )}
                {codeAvailable === false && (
                  <p className="text-xs text-red-600 mt-1">✗ This code is already taken</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Official Email *</label>
                <input
                  type="email"
                  required
                  value={form.companyEmail}
                  onChange={(e) => setForm({ ...form, companyEmail: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="info@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={form.companyPhone} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input type="url" value={form.companyWebsite} onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="https://www.company.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500">
                  <option value="">Select industry</option>
                  {industries.map((ind) => (<option key={ind} value={ind}>{ind}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500">
                  <option value="IN">India</option>
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                  <option value="SG">Singapore</option>
                  <option value="AE">UAE</option>
                  <option value="AU">Australia</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Employees</label>
                <input type="number" min={1} max={10000} value={form.employeeCount} onChange={(e) => setForm({ ...form, employeeCount: parseInt(e.target.value) || 10 })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" />
              </div>
            </div>
          </div>

          {/* Step 2: Contact Person */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-green-100 text-green-700 rounded-lg flex items-center justify-center text-sm font-bold">2</span>
              Contact Person <span className="text-xs text-gray-400 font-normal">(will become the admin)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" required value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" required value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="john@company.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input type="text" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="HR Manager / CEO / Director" />
              </div>
            </div>
          </div>

          {/* Step 3: Company Address */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-green-100 text-green-700 rounded-lg flex items-center justify-center text-sm font-bold">3</span>
              Company Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="123 Business Park, Sector 5" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Mumbai" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input type="text" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Maharashtra" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                <input type="text" value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="400001" />
              </div>
            </div>
          </div>

          {/* Step 4: Logo Upload */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center text-sm font-bold">4</span>
              Company Logo
            </h3>
            <div className="flex items-center gap-6">
              {form.companyLogo ? (
                <div className="w-24 h-24 rounded-xl border-2 border-gray-200 overflow-hidden">
                  <img src={form.companyLogo} alt="Logo preview" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                  </svg>
                </div>
              )}
              <div>
                <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 cursor-pointer transition-colors text-sm font-medium">
                  Upload Logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG or SVG. Max 2MB. Will appear in your HRMS portal.</p>
              </div>
            </div>
          </div>

          {/* Step 5: Sample Employee Data Upload */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center text-sm font-bold">5</span>
              Sample Employee Data <span className="text-xs text-gray-400 font-normal">(Optional)</span>
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Upload a sample of up to 5 employees to test the platform. Download our{' '}
              <a
                href="/api/trial/excel-template"
                className="text-green-600 underline hover:text-green-800 font-medium"
              >
                Excel template here
              </a>
              . You can always add more employees after your trial is activated.
            </p>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-green-400 transition-colors">
              <svg className="w-10 h-10 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <label className="px-4 py-2 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 cursor-pointer transition-colors text-sm font-medium">
                Choose File (CSV or Excel)
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Columns: EmployeeId, FirstName, LastName, Email, Phone, Department, Designation, DateOfJoining
              </p>
            </div>
          </div>

          {/* Step 6: Module Selection */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center text-sm font-bold">6</span>
              Select Modules for Trial <span className="text-xs text-gray-400 font-normal">(at least 3 recommended)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableModules.map((mod) => {
                const selected = form.selectedModules.includes(mod.key);
                return (
                  <button
                    key={mod.key}
                    type="button"
                    onClick={() => toggleModule(mod.key)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`font-medium text-sm ${selected ? 'text-emerald-900' : 'text-gray-800'}`}>
                          {mod.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{mod.desc}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                        }`}
                      >
                        {selected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {form.selectedModules.length === 0
                ? 'No modules selected. You can add modules later from Settings.'
                : `${form.selectedModules.length} module${form.selectedModules.length !== 1 ? 's' : ''} selected. These will be enabled in your trial environment.`}
            </p>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={loading || codeAvailable === false}
              className="w-full py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-700 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/25"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Setting up your trial...
                </span>
              ) : (
                'Start Free Trial — 15 Days, No Credit Card'
              )}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              By registering, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
