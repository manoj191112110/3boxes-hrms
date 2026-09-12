'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiArrowRight,
  FiZap,
  FiCheck,
  FiUsers,
  FiClock,
  FiCoffee,
  FiDollarSign,
  FiBriefcase,
  FiSmile,
  FiTarget,
  FiBarChart2,
  FiShield,
  FiGlobe,
  FiClipboard,
  FiAward,
  FiCpu,
  FiHeart,
  FiFileText,
  FiPhoneCall,
  FiPackage,
  FiLayers,
  FiLock,
  FiStar,
  FiUpload,
  FiDownload,
  FiImage,
  FiPhone,
  FiMail,
  FiMapPin,
  FiHome,
  FiUser,
  FiHelpCircle,
  FiChevronRight,
  FiChevronLeft,
  FiEdit3,
  FiSearch,
  FiX,
  FiCheckCircle,
} from 'react-icons/fi';

/* ─── Module Data for Selection ─── */
const allModules = [
  { icon: FiUsers, name: 'Employee Management', desc: 'Profiles, documents & lifecycle' },
  { icon: FiClock, name: 'Attendance', desc: 'Biometric, GPS & shifts' },
  { icon: FiCoffee, name: 'Leave Management', desc: 'Types, balances & approvals' },
  { icon: FiDollarSign, name: 'Payroll', desc: 'Salary, runs & payslips' },
  { icon: FiBriefcase, name: 'Recruitment (ATS)', desc: 'Jobs, pipeline & offers' },
  { icon: FiSmile, name: 'Onboarding', desc: 'Tasks & welcome flows' },
  { icon: FiTarget, name: 'Performance', desc: 'Reviews, goals & OKRs' },
  { icon: FiBarChart2, name: 'Analytics', desc: 'Dashboards & reports' },
  { icon: FiShield, name: 'Compliance', desc: 'Statutory & audit' },
  { icon: FiGlobe, name: 'Travel & Expense', desc: 'Requests & claims' },
  { icon: FiClipboard, name: 'Helpdesk', desc: 'Tickets & SLA tracking' },
  { icon: FiAward, name: 'Learning & Training', desc: 'Courses & enrollments' },
  { icon: FiCpu, name: 'AI Chatbot', desc: 'HR assistant & analytics' },
  { icon: FiHeart, name: 'Engagement', desc: 'Surveys & sentiment' },
  { icon: FiFileText, name: 'Documents', desc: 'DMS & e-signatures' },
  { icon: FiPhoneCall, name: 'AI Interview', desc: 'Proctoring & scoring' },
  { icon: FiLayers, name: 'Company Management', desc: 'Multi-company & groups' },
  { icon: FiLock, name: 'Role-Based Access', desc: 'Permissions & RBAC' },
  { icon: FiPackage, name: 'Assets', desc: 'Tracking & assignments' },
  { icon: FiStar, name: 'Workflows', desc: 'Automation engine' },
];

/* ─── Countries List ─── */
const popularCountries = [
  'India', 'United States', 'United Kingdom', 'Singapore', 'Australia',
  'Canada', 'Germany', 'UAE', 'Saudi Arabia', 'South Africa',
  'Japan', 'Malaysia', 'Philippines', 'Netherlands', 'France',
  'Brazil', 'Mexico', 'Indonesia', 'Thailand', 'Vietnam',
];

/* ─── Industry Options ─── */
const industries = [
  'Technology / IT', 'Healthcare', 'Finance / Banking', 'Manufacturing',
  'Retail / E-commerce', 'Education', 'Construction', 'Logistics / Supply Chain',
  'Consulting', 'Media / Entertainment', 'Hospitality / Tourism',
  'Government / Public Sector', 'Non-Profit / NGO', 'Real Estate',
  'Telecommunications', 'Energy / Utilities', 'Agriculture', 'Other',
];

/* ─── Employee Size Options ─── */
const employeeSizes = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+',
];

/* ─── Trial Benefits ─── */
const trialBenefits = [
  '15-day free trial, no credit card required',
  'Create your own subdomain (companyname.3boxeshrms.com)',
  'Full access to all features during trial',
  'After 15 days, choose a subscription plan to continue',
  'Customize which modules you want to try',
  'Data migration support available',
  'Dedicated onboarding specialist',
];

export default function TrialPage() {
  // Step tracking
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  // Step 1: Company Details
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [employeeSize, setEmployeeSize] = useState('');
  const [industry, setIndustry] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Location & Coverage
  const [branches, setBranches] = useState('');
  const [headOfficeAddress, setHeadOfficeAddress] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState('');

  // Step 3: Trial Setup
  const [reference, setReference] = useState('');
  const [needSetupSupport, setNeedSetupSupport] = useState<'yes' | 'no' | 'maybe'>('maybe');
  const [employeeFile, setEmployeeFile] = useState<string | null>(null);
  const [employeeFileName, setEmployeeFileName] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const employeeInputRef = useRef<HTMLInputElement>(null);

  // Step 4: Subdomain & Confirm
  const [subdomain, setSubdomain] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Module toggle
  const handleToggleModule = (name: string) => {
    setSelectedModules((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedModules([]);
      setSelectAll(false);
    } else {
      setSelectedModules(allModules.map((m) => m.name));
      setSelectAll(true);
    }
  };

  const isAllSelected = selectedModules.length === allModules.length;

  // Country toggle
  const handleToggleCountry = (country: string) => {
    setSelectedCountries((prev) =>
      prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]
    );
  };

  // Logo upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCompanyLogo(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Employee Excel upload handler
  const handleEmployeeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEmployeeFileName(file.name);
      // Just store the filename for display; real upload would go to server
    }
  };

  // Auto-generate subdomain from company name
  const generatedSubdomain = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Step validation
  const step1Valid = companyName.trim() && contactPerson.trim() && contactEmail.trim() && employeeSize;
  const step2Valid = true; // Location is optional
  const step3Valid = selectedModules.length > 0;
  const step4Valid = subdomain.trim().length >= 3;

  const canProceed = () => {
    if (currentStep === 1) return step1Valid;
    if (currentStep === 2) return step2Valid;
    if (currentStep === 3) return step3Valid;
    if (currentStep === 4) return step4Valid;
    return false;
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  // Step labels
  const stepLabels = [
    { num: 1, label: 'Company Details', icon: FiHome },
    { num: 2, label: 'Location & Coverage', icon: FiMapPin },
    { num: 3, label: 'Trial Setup', icon: FiZap },
    { num: 4, label: 'Launch Instance', icon: FiGlobe },
  ];

  return (
    <div>
      {/* ─── Home/Back Button ─── */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/landing"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 text-white text-sm font-semibold hover:bg-white/30 transition-all border border-white/30"
          >
            <FiArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/30 border border-green-400/30">
            <FiZap className="w-4 h-4 text-green-200" />
            <span className="text-sm font-semibold text-green-200">15-Day Free Trial</span>
          </div>
        </div>
      </div>

      {/* ─── Hero ─── */}
      <section className="relative pt-8 sm:pt-10 pb-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-green-50/80 via-emerald-50/40 to-white" />
        <div className="absolute top-10 left-1/3 w-72 h-72 bg-green-400/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900">
            Start Your Free Trial{' '}
            <span className="gradient-text">in 4 Easy Steps</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
            Fill in your company details, choose your modules, and launch your personalized HRMS instance in minutes.
          </p>
        </div>
      </section>

      {/* ─── Step Progress Bar ─── */}
      <section className="bg-white border-b border-slate-100 sticky top-20 sm:top-24 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {stepLabels.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.num;
              const isCompleted = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  onClick={() => {
                    // Allow going back to completed steps
                    if (isCompleted || isActive) setCurrentStep(step.num);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/25'
                      : isCompleted
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-slate-50 text-slate-400 border border-slate-200'
                  }`}
                >
                  {isCompleted ? (
                    <FiCheckCircle className="w-4 h-4" />
                  ) : (
                    <StepIcon className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.num}</span>
                </button>
              );
            })}
          </div>
          {/* Progress line */}
          <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
            />
          </div>
        </div>
      </section>

      {/* ─── Step 1: Company Details ─── */}
      {currentStep === 1 && !submitted && (
        <section className="py-8 sm:py-12 bg-gradient-to-b from-white to-green-50/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-10">
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                  <FiHome className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">Company Details</h2>
                  <p className="text-sm text-slate-500">Tell us about your organization so we can personalize your trial</p>
                </div>
              </div>

              {/* Logo Upload */}
              <div className="mb-8">
                <label className="text-sm font-semibold text-slate-700 mb-3 block">Company Logo</label>
                <div className="flex items-center gap-6">
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className="w-24 h-24 rounded-2xl border-2 border-dashed border-green-300 bg-green-50 flex items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-100 transition-all overflow-hidden group"
                  >
                    {companyLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={companyLogo} alt="Company Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="text-center">
                        <FiImage className="w-8 h-8 text-green-400 mx-auto mb-1" />
                        <span className="text-xs text-green-500 font-medium">Upload</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <div>
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 text-green-700 border border-green-200 text-sm font-semibold hover:bg-green-100 transition-all"
                    >
                      <FiUpload className="w-4 h-4" />
                      Choose Logo
                    </button>
                    {logoFileName && (
                      <p className="mt-2 text-sm text-slate-500 flex items-center gap-1">
                        <FiCheckCircle className="w-3 h-3 text-green-500" />
                        {logoFileName}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">PNG, JPG, SVG — Max 2MB</p>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Company Name */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">
                    Company Name <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/20 transition-all">
                    <FiHome className="w-4 h-4 text-slate-400 ml-3" />
                    <input
                      type="text"
                      placeholder="e.g. Acme Technologies"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="flex-1 bg-transparent text-slate-900 text-sm px-3 py-3 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Contact Person */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">
                    Contact Person <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/20 transition-all">
                    <FiUser className="w-4 h-4 text-slate-400 ml-3" />
                    <input
                      type="text"
                      placeholder="e.g. John Smith"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="flex-1 bg-transparent text-slate-900 text-sm px-3 py-3 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">
                    Email ID <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/20 transition-all">
                    <FiMail className="w-4 h-4 text-slate-400 ml-3" />
                    <input
                      type="email"
                      placeholder="e.g. john@acme.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="flex-1 bg-transparent text-slate-900 text-sm px-3 py-3 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">
                    Contact Number
                  </label>
                  <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/20 transition-all">
                    <FiPhone className="w-4 h-4 text-slate-400 ml-3" />
                    <input
                      type="tel"
                      placeholder="e.g. +91 98765 43210"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="flex-1 bg-transparent text-slate-900 text-sm px-3 py-3 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* No of Employees */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">
                    Number of Employees <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/20 transition-all">
                    <FiUsers className="w-4 h-4 text-slate-400 ml-3" />
                    <select
                      value={employeeSize}
                      onChange={(e) => setEmployeeSize(e.target.value)}
                      className="flex-1 bg-transparent text-slate-900 text-sm px-3 py-3 outline-none appearance-none cursor-pointer"
                    >
                      <option value="" className="text-slate-400">Select range</option>
                      {employeeSizes.map((size) => (
                        <option key={size} value={size}>{size} employees</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Industry */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">
                    Industry / Sector
                  </label>
                  <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/20 transition-all">
                    <FiBriefcase className="w-4 h-4 text-slate-400 ml-3" />
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="flex-1 bg-transparent text-slate-900 text-sm px-3 py-3 outline-none appearance-none cursor-pointer"
                    >
                      <option value="" className="text-slate-400">Select industry</option>
                      {industries.map((ind) => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Required fields note */}
              <p className="mt-6 text-xs text-slate-400 flex items-center gap-1">
                <span className="text-red-400">*</span> = required fields
              </p>

              {/* Step Navigation */}
              <div className="mt-8 flex items-center justify-between">
                <Link
                  href="/landing"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-slate-600 text-sm font-semibold hover:text-green-700 transition-all"
                >
                  <FiArrowLeft className="w-4 h-4" />
                  Cancel
                </Link>
                <button
                  disabled={!step1Valid}
                  onClick={() => setCurrentStep(2)}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                    step1Valid
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-105'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Next: Location & Coverage
                  <FiArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Step 2: Location & Coverage ─── */}
      {currentStep === 2 && !submitted && (
        <section className="py-8 sm:py-12 bg-gradient-to-b from-white to-green-50/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-10">
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                  <FiMapPin className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">Location & Coverage</h2>
                  <p className="text-sm text-slate-500">Where is your company located, and which countries will use the product?</p>
                </div>
              </div>

              {/* Branches */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 mb-2 block">
                  Number of Branches / Locations
                </label>
                <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/20 transition-all">
                  <FiMapPin className="w-4 h-4 text-slate-400 ml-3" />
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 3"
                    value={branches}
                    onChange={(e) => setBranches(e.target.value)}
                    className="flex-1 bg-transparent text-slate-900 text-sm px-3 py-3 outline-none placeholder:text-slate-400"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">Total offices, branches, or work locations</p>
              </div>

              {/* Head Office Address */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 mb-2 block">
                  Head Office / Primary Address
                </label>
                <div className="flex items-start bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/20 transition-all">
                  <FiEdit3 className="w-4 h-4 text-slate-400 ml-3 mt-3" />
                  <textarea
                    placeholder="e.g. 123 Business Ave, Suite 400, Mumbai, Maharashtra, India 400001"
                    value={headOfficeAddress}
                    onChange={(e) => setHeadOfficeAddress(e.target.value)}
                    rows={3}
                    className="flex-1 bg-transparent text-slate-900 text-sm px-3 py-3 outline-none placeholder:text-slate-400 resize-none"
                  />
                </div>
              </div>

              {/* Countries Selection */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 mb-2 block">
                  Countries Where You Want to Use the Product
                </label>
                <p className="text-xs text-slate-400 mb-3">Select all countries where your organization operates or plans to use 3Boxes HRMS</p>

                {/* Search */}
                <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mb-4 focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/20 transition-all">
                  <FiSearch className="w-4 h-4 text-slate-400 ml-3" />
                  <input
                    type="text"
                    placeholder="Search countries..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    className="flex-1 bg-transparent text-slate-900 text-sm px-3 py-2 outline-none placeholder:text-slate-400"
                  />
                  {countrySearch && (
                    <button onClick={() => setCountrySearch('')} className="px-2">
                      <FiX className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                </div>

                {/* Selected countries display */}
                {selectedCountries.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedCountries.map((country) => (
                      <span
                        key={country}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium"
                      >
                        {country}
                        <button onClick={() => handleToggleCountry(country)} className="ml-1 hover:text-red-500">
                          <FiX className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Country checkboxes grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {popularCountries
                    .filter((c) => !countrySearch || c.toLowerCase().includes(countrySearch.toLowerCase()))
                    .map((country) => {
                      const isSelected = selectedCountries.includes(country);
                      return (
                        <button
                          key={country}
                          onClick={() => handleToggleCountry(country)}
                          className={`p-3 rounded-xl text-sm font-medium transition-all border ${
                            isSelected
                              ? 'bg-green-50 border-green-300 text-green-700 shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-green-200 hover:text-green-600'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {isSelected && <FiCheck className="w-3 h-3 text-green-500" />}
                            {country}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Step Navigation */}
              <div className="mt-8 flex items-center justify-between">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-slate-600 text-sm font-semibold hover:text-green-700 transition-all"
                >
                  <FiChevronLeft className="w-4 h-4" />
                  Back: Company Details
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-105 transition-all"
                >
                  Next: Trial Setup
                  <FiArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Step 3: Trial Setup ─── */}
      {currentStep === 3 && !submitted && (
        <section className="py-8 sm:py-12 bg-gradient-to-b from-white to-green-50/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-10">
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                  <FiZap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">Trial Setup</h2>
                  <p className="text-sm text-slate-500">Choose your modules, upload employee data, and configure your trial preferences</p>
                </div>
              </div>

              {/* Reference */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-slate-700 mb-2 block">
                  How did you hear about us? (Reference)
                </label>
                <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/20 transition-all">
                  <FiSearch className="w-4 h-4 text-slate-400 ml-3" />
                  <select
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="flex-1 bg-transparent text-slate-900 text-sm px-3 py-3 outline-none appearance-none cursor-pointer"
                  >
                    <option value="" className="text-slate-400">Select reference</option>
                    <option value="google">Google Search</option>
                    <option value="social">Social Media</option>
                    <option value="referral">Friend / Colleague Referral</option>
                    <option value="blog">Blog / Article</option>
                    <option value="partner">Partner / Vendor</option>
                    <option value="conference">Conference / Event</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Need Setup Support */}
              <div className="mb-8">
                <label className="text-sm font-semibold text-slate-700 mb-3 block">
                  Do you need support setting up your trial?
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'yes', label: 'Yes, I need help', desc: 'A specialist will guide you through setup', icon: FiHelpCircle },
                    { value: 'maybe', label: 'Maybe later', desc: 'I might need help after exploring', icon: FiZap },
                    { value: 'no', label: 'No, I can manage', desc: 'I will set things up myself', icon: FiCheck },
                  ].map((opt) => {
                    const OptIcon = opt.icon;
                    const isSelected = needSetupSupport === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setNeedSetupSupport(opt.value as 'yes' | 'no' | 'maybe')}
                        className={`p-4 rounded-xl text-center transition-all border ${
                          isSelected
                            ? 'bg-green-50 border-green-300 shadow-md shadow-green-500/10'
                            : 'bg-slate-50 border-slate-200 hover:border-green-200'
                        }`}
                      >
                        <OptIcon className={`w-5 h-5 mx-auto mb-2 ${isSelected ? 'text-green-600' : 'text-slate-400'}`} />
                        <p className={`text-sm font-semibold ${isSelected ? 'text-green-700' : 'text-slate-600'}`}>{opt.label}</p>
                        <p className="text-xs text-slate-400 mt-1">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Upload Employee Data */}
              <div className="mb-8">
                <label className="text-sm font-semibold text-slate-700 mb-3 block">
                  Upload Employee Data (Optional)
                </label>
                <p className="text-xs text-slate-400 mb-4">
                  Upload your employee list using our Excel template to pre-populate your trial with real data. This helps you see how 3Boxes HRMS works with your actual organization structure.
                </p>
                <div className="flex items-start gap-4">
                  {/* Download Template */}
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-semibold hover:bg-emerald-100 transition-all"
                  >
                    <FiDownload className="w-4 h-4" />
                    Download Excel Template
                  </button>
                  {/* Upload File */}
                  <div>
                    <button
                      onClick={() => employeeInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 text-green-700 border border-green-200 text-sm font-semibold hover:bg-green-100 transition-all"
                    >
                      <FiUpload className="w-4 h-4" />
                      Upload Filled Template
                    </button>
                    <input
                      ref={employeeInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleEmployeeUpload}
                    />
                    {employeeFileName && (
                      <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                        <FiCheckCircle className="w-3 h-3 text-green-500" />
                        {employeeFileName}
                        <button onClick={() => { setEmployeeFileName(''); }} className="ml-1 text-slate-400 hover:text-red-500">
                          <FiX className="w-3 h-3" />
                        </button>
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-400 leading-relaxed">
                  <p className="font-semibold text-slate-500 mb-1">Template includes columns for:</p>
                  <p>Employee Name, Email, Department, Designation, Date of Joining, Phone, Location, Manager Name</p>
                </div>
              </div>

              {/* Module Selection */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-semibold text-slate-700">
                    Select Modules to Try <span className="text-red-400">*</span>
                  </label>
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700">
                    {selectedModules.length} / {allModules.length} selected
                  </div>
                </div>

                {/* Select All / Clear */}
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={handleSelectAll}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isAllSelected
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-sm'
                    }`}
                  >
                    {isAllSelected ? (
                      <>
                        <FiCheck className="w-3 h-3" />
                        All Selected
                      </>
                    ) : (
                      'Select All'
                    )}
                  </button>
                  <button
                    onClick={() => { setSelectedModules([]); setSelectAll(false); }}
                    disabled={selectedModules.length === 0}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                      selectedModules.length === 0
                        ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-green-200'
                    }`}
                  >
                    Clear All
                  </button>
                </div>

                {/* Module Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {allModules.map((mod, idx) => {
                    const Icon = mod.icon;
                    const isSelected = selectedModules.includes(mod.name);
                    return (
                      <button
                        key={idx}
                        onClick={() => handleToggleModule(mod.name)}
                        className={`group p-3 rounded-xl transition-all duration-200 text-center border ${
                          isSelected
                            ? 'bg-green-50 border-green-300 shadow-md shadow-green-500/10'
                            : 'bg-slate-50 border-slate-200 hover:shadow-md hover:border-green-200'
                        }`}
                      >
                        <div className={`mb-2 inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {isSelected ? (
                            <FiCheck className="w-4 h-4" />
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                        </div>
                        <h4 className="text-xs font-semibold text-slate-900 mb-0.5">{mod.name}</h4>
                        <p className="text-[10px] text-slate-500 leading-snug">{mod.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step Navigation */}
              <div className="mt-8 flex items-center justify-between">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-slate-600 text-sm font-semibold hover:text-green-700 transition-all"
                >
                  <FiChevronLeft className="w-4 h-4" />
                  Back: Location
                </button>
                <button
                  disabled={!step3Valid}
                  onClick={() => setCurrentStep(4)}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                    step3Valid
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-105'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Next: Launch Instance
                  <FiArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Step 4: Subdomain & Confirm ─── */}
      {currentStep === 4 && !submitted && (
        <section className="py-8 sm:py-12 bg-slate-900 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-900/50 via-slate-900 to-emerald-900/30" />
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 sm:p-10 shadow-2xl">
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                  <FiGlobe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-white">Launch Your HRMS Instance</h2>
                  <p className="text-sm text-slate-400">Choose your subdomain and review everything before launching</p>
                </div>
              </div>

              {/* Subdomain Input */}
              <div className="mb-8">
                <label className="text-sm text-slate-300 mb-2 block font-semibold">Your Subdomain <span className="text-red-400">*</span></label>
                <div className="flex items-center bg-slate-700 rounded-xl border border-slate-600 overflow-hidden focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/20 transition-all">
                  <FiGlobe className="w-4 h-4 text-slate-400 ml-3" />
                  <input
                    type="text"
                    placeholder={generatedSubdomain || 'e.g. acme'}
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    className="flex-1 bg-transparent text-white text-sm px-3 py-3 outline-none placeholder:text-slate-500"
                  />
                  <div className="px-3 py-3 bg-slate-600 text-slate-300 text-sm font-mono">
                    .3boxeshrms.com
                  </div>
                </div>
                {subdomain && (
                  <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm">
                    <FiCheck className="w-4 h-4" />
                    <span className="font-mono">{subdomain}.3boxeshrms.com</span>
                    <span className="text-slate-500">is available</span>
                  </div>
                )}
                {!subdomain && generatedSubdomain && (
                  <button
                    onClick={() => setSubdomain(generatedSubdomain)}
                    className="mt-3 text-sm text-green-400 hover:text-green-300 font-medium"
                  >
                    Use auto-generated: {generatedSubdomain}.3boxeshrms.com
                  </button>
                )}
              </div>

              {/* Summary */}
              <div className="mb-8 p-5 rounded-xl bg-slate-700/50 border border-slate-600">
                <h3 className="text-sm font-semibold text-white mb-4">Trial Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <FiHome className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-slate-300">Company:</span>
                    <span className="text-sm font-semibold text-white">{companyName}</span>
                    {companyLogo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={companyLogo} alt="Logo" className="w-6 h-6 rounded object-contain" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <FiUser className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-slate-300">Contact:</span>
                    <span className="text-sm font-semibold text-white">{contactPerson}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FiMail className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-slate-300">Email:</span>
                    <span className="text-sm font-semibold text-white">{contactEmail}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FiUsers className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-slate-300">Employees:</span>
                    <span className="text-sm font-semibold text-white">{employeeSize}</span>
                  </div>
                  {industry && (
                    <div className="flex items-center gap-3">
                      <FiBriefcase className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-slate-300">Industry:</span>
                      <span className="text-sm font-semibold text-white">{industry}</span>
                    </div>
                  )}
                  {branches && (
                    <div className="flex items-center gap-3">
                      <FiMapPin className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-slate-300">Branches:</span>
                      <span className="text-sm font-semibold text-white">{branches}</span>
                    </div>
                  )}
                  {selectedCountries.length > 0 && (
                    <div className="flex items-center gap-3">
                      <FiGlobe className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-slate-300">Countries:</span>
                      <span className="text-sm font-semibold text-white">{selectedCountries.join(', ')}</span>
                    </div>
                  )}
                  {reference && (
                    <div className="flex items-center gap-3">
                      <FiSearch className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-slate-300">Reference:</span>
                      <span className="text-sm font-semibold text-white capitalize">{reference}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <FiHelpCircle className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-slate-300">Setup Support:</span>
                    <span className="text-sm font-semibold text-white capitalize">{needSetupSupport}</span>
                  </div>
                  {employeeFileName && (
                    <div className="flex items-center gap-3">
                      <FiFileText className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-slate-300">Employee Data:</span>
                      <span className="text-sm font-semibold text-white">{employeeFileName}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-3 pt-2 border-t border-slate-600">
                    <FiZap className="w-4 h-4 text-green-400 mt-0.5" />
                    <span className="text-sm text-slate-300">Modules:</span>
                    <span className="text-sm font-semibold text-white">{selectedModules.length} selected — {selectedModules.slice(0, 3).join(', ')}{selectedModules.length > 3 ? ` +${selectedModules.length - 3} more` : ''}</span>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="mb-8 space-y-2">
                {trialBenefits.slice(0, 4).map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center mt-0.5">
                      <FiCheck className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span className="text-sm text-slate-300">{benefit}</span>
                  </div>
                ))}
              </div>

              {/* Step Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-slate-400 text-sm font-semibold hover:text-green-300 transition-all"
                >
                  <FiChevronLeft className="w-4 h-4" />
                  Back: Trial Setup
                </button>
                <button
                  disabled={!step4Valid}
                  onClick={handleSubmit}
                  className={`inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold transition-all ${
                    step4Valid
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-xl shadow-green-500/25 hover:shadow-green-500/40 hover:scale-105'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Launch Your 15-Day Free Trial
                  <FiZap className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Success / Confirmation ─── */}
      {submitted && (
        <section className="py-12 sm:py-20 bg-gradient-to-b from-green-50/80 to-white min-h-[60vh] flex items-center justify-center">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-green-500/30 mx-auto mb-6">
              <FiCheckCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
              Your Trial is <span className="gradient-text">Ready!</span>
            </h1>
            <p className="text-lg text-slate-600 mb-6">
              Your 3Boxes HRMS instance has been created. You can now access your personalized HRMS platform.
            </p>

            {/* Subdomain Link */}
            <div className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-green-50 border border-green-200 mb-6">
              <FiGlobe className="w-5 h-5 text-green-600" />
              <span className="text-lg font-bold text-green-700 font-mono">
                {subdomain}.3boxeshrms.com
              </span>
            </div>

            {/* What's Next */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 mb-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4">What happens next?</h3>
              <div className="space-y-3">
                {[
                  { icon: FiMail, text: 'A confirmation email has been sent to ' + contactEmail, color: 'text-green-500' },
                  { icon: FiClock, text: 'Your 15-day trial starts now — full access to all selected modules', color: 'text-emerald-500' },
                  { icon: FiUsers, text: selectedModules.length + ' modules are activated for your trial', color: 'text-teal-500' },
                  { icon: FiHelpCircle, text: needSetupSupport === 'yes' ? 'An onboarding specialist will contact you within 24 hours' : 'Self-service setup — explore at your own pace', color: 'text-green-500' },
                ].map((item, idx) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <ItemIcon className={`w-4 h-4 ${item.color} mt-0.5`} />
                      <span className="text-sm text-slate-700">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <Link
                href="/landing"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-slate-600 text-sm font-semibold hover:text-green-700 transition-all"
              >
                <FiArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>
              <button
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-105 transition-all"
              >
                <FiArrowRight className="w-4 h-4" />
                Go to My HRMS Instance
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
