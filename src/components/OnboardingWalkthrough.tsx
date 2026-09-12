'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  FiHome, FiUser, FiCalendar, FiClock, FiDollarSign,
  FiFileText, FiHelpCircle, FiSettings, FiUsers,
  FiBriefcase, FiBarChart2, FiArrowRight, FiX,
  FiChevronLeft, FiChevronRight, FiStar, FiZap,
  FiShield, FiTarget, FiCheckCircle,
} from 'react-icons/fi';

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  link?: string;
  linkLabel?: string;
  features?: string[];
}

const employeeSteps: OnboardingStep[] = [
  {
    id: 1,
    title: 'Welcome to 3Boxes HRMS!',
    description: 'Your all-in-one platform for managing everything HR — from leaves and attendance to payroll and documents. Let us show you around!',
    icon: FiStar,
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    iconColor: 'text-white',
    features: [
      'Apply for leaves & track balances',
      'Mark attendance & view timesheets',
      'Access payslips anytime',
      'Upload & manage documents',
    ],
  },
  {
    id: 2,
    title: 'Your Dashboard',
    description: 'Your home base! See quick stats, pending actions, upcoming events, and important announcements at a glance.',
    icon: FiHome,
    iconBg: 'bg-gradient-to-br from-green-500 to-cyan-500',
    iconColor: 'text-white',
    link: '/home',
    linkLabel: 'Go to Dashboard',
    features: [
      'Quick action cards for common tasks',
      'Pending items that need your attention',
      'Upcoming holidays & birthdays',
      'Company announcements feed',
    ],
  },
  {
    id: 3,
    title: 'My Profile',
    description: 'View and update your personal information, contact details, emergency contacts, and more.',
    icon: FiUser,
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
    iconColor: 'text-white',
    link: '/my-profile',
    linkLabel: 'Go to My Profile',
    features: [
      'Update personal details',
      'View employment information',
      'Manage emergency contacts',
      'Update bank account details',
    ],
  },
  {
    id: 4,
    title: 'Leave Management',
    description: 'Apply for leaves, check your leave balance, track approval status, and view your leave history.',
    icon: FiCalendar,
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
    iconColor: 'text-white',
    link: '/leave',
    linkLabel: 'Go to Leave',
    features: [
      'Apply for different leave types',
      'Check leave balance & history',
      'Track approval status in real-time',
      'View team leave calendar',
    ],
  },
  {
    id: 5,
    title: 'Attendance',
    description: 'Mark your daily attendance, check in/check out, and view your timesheets and attendance records.',
    icon: FiClock,
    iconBg: 'bg-gradient-to-br from-pink-500 to-rose-500',
    iconColor: 'text-white',
    link: '/attendance',
    linkLabel: 'Go to Attendance',
    features: [
      'Quick check-in & check-out',
      'View daily attendance summary',
      'Track working hours & overtime',
      'View monthly timesheets',
    ],
  },
  {
    id: 6,
    title: 'Payslips',
    description: 'View your monthly payslips, salary breakdown, deductions, and download payslip PDFs.',
    icon: FiDollarSign,
    iconBg: 'bg-gradient-to-br from-teal-500 to-teal-600',
    iconColor: 'text-white',
    link: '/payroll',
    linkLabel: 'Go to Payroll',
    features: [
      'View monthly payslip details',
      'Download payslip PDFs',
      'Track salary components',
      'View tax deductions & net pay',
    ],
  },
  {
    id: 7,
    title: 'Documents',
    description: 'Upload, manage, and access all your important documents — from ID proofs to certificates.',
    icon: FiFileText,
    iconBg: 'bg-gradient-to-br from-sky-500 to-green-600',
    iconColor: 'text-white',
    link: '/documents',
    linkLabel: 'Go to Documents',
    features: [
      'Upload personal documents',
      'View company-shared documents',
      'Download & share documents',
      'Organized by category',
    ],
  },
  {
    id: 8,
    title: 'Help & Support',
    description: 'Need help? Reach out to HR, raise support tickets, or use the AI assistant for quick answers.',
    icon: FiHelpCircle,
    iconBg: 'bg-gradient-to-br from-slate-500 to-slate-700',
    iconColor: 'text-white',
    features: [
      'Contact HR directly',
      'Raise support tickets',
      'Use the AI assistant for help',
      'Browse FAQs & guides',
    ],
  },
];

const adminSteps: OnboardingStep[] = [
  {
    id: 1,
    title: 'Welcome, Admin!',
    description: 'You have full control over your organization\'s HR management. Set up your company, manage employees, configure policies, and much more!',
    icon: FiShield,
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    iconColor: 'text-white',
    features: [
      'Complete company setup wizard',
      'Add & manage all employees',
      'Configure leave & attendance policies',
      'Set up payroll & manage recruitment',
    ],
  },
  {
    id: 2,
    title: 'Setup Wizard',
    description: 'First time here? Use the setup wizard to quickly configure your company details, departments, designations, and organizational structure.',
    icon: FiZap,
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
    iconColor: 'text-white',
    link: '/setup-wizard',
    linkLabel: 'Go to Setup Wizard',
    features: [
      'Configure company details',
      'Set up departments & designations',
      'Define leave types & policies',
      'Import employees in bulk',
    ],
  },
  {
    id: 3,
    title: 'Employee Management',
    description: 'Add employees one by one or bulk import via Excel. Manage profiles, documents, and employment details.',
    icon: FiUsers,
    iconBg: 'bg-gradient-to-br from-green-500 to-cyan-500',
    iconColor: 'text-white',
    link: '/employees',
    linkLabel: 'Go to Employees',
    features: [
      'Add employees individually',
      'Bulk import from Excel files',
      'Manage employee profiles',
      'View org chart & directory',
    ],
  },
  {
    id: 4,
    title: 'Settings',
    description: 'Configure modules, set up company policies, manage roles & permissions, and customize your HRMS experience.',
    icon: FiSettings,
    iconBg: 'bg-gradient-to-br from-slate-500 to-slate-700',
    iconColor: 'text-white',
    link: '/settings',
    linkLabel: 'Go to Settings',
    features: [
      'Module configuration',
      'Role & permission management',
      'Company branding settings',
      'Notification preferences',
    ],
  },
  {
    id: 5,
    title: 'Leave & Attendance Policies',
    description: 'Define leave types, set accrual rules, configure attendance policies, and manage holiday calendars.',
    icon: FiTarget,
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
    iconColor: 'text-white',
    link: '/settings?tab=leave',
    linkLabel: 'Go to Leave Settings',
    features: [
      'Create custom leave types',
      'Set accrual & carry-forward rules',
      'Configure attendance tracking',
      'Manage holiday calendar',
    ],
  },
  {
    id: 6,
    title: 'Payroll Configuration',
    description: 'Set up salary structures, configure tax deductions, define allowances, and process payroll runs.',
    icon: FiDollarSign,
    iconBg: 'bg-gradient-to-br from-teal-500 to-teal-600',
    iconColor: 'text-white',
    link: '/settings?tab=payroll',
    linkLabel: 'Go to Payroll Settings',
    features: [
      'Define salary structures',
      'Configure tax & deductions',
      'Set up allowance components',
      'Process monthly payroll runs',
    ],
  },
  {
    id: 7,
    title: 'Recruitment',
    description: 'Post job openings, manage applications, schedule interviews, and hire the best talent for your team.',
    icon: FiBriefcase,
    iconBg: 'bg-gradient-to-br from-pink-500 to-rose-500',
    iconColor: 'text-white',
    link: '/recruitment',
    linkLabel: 'Go to Recruitment',
    features: [
      'Post job openings',
      'Review & screen applications',
      'Schedule interviews',
      'Manage hiring pipeline',
    ],
  },
  {
    id: 8,
    title: 'Reports & Analytics',
    description: 'Gain insights with comprehensive reports on employees, attendance, leave, payroll, and more.',
    icon: FiBarChart2,
    iconBg: 'bg-gradient-to-br from-sky-500 to-green-600',
    iconColor: 'text-white',
    link: '/reports',
    linkLabel: 'Go to Reports',
    features: [
      'Employee demographics reports',
      'Attendance & leave analytics',
      'Payroll summaries',
      'Custom report generation',
    ],
  },
];

export default function OnboardingWalkthrough() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [show, setShow] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isAdmin = user?.role === 'tenant_admin' || user?.role === 'admin' || user?.role === 'super_admin';
  const steps = isAdmin ? adminSteps : employeeSteps;

  useEffect(() => {
    setMounted(true);
    try {
      // Only show if welcome has been completed and onboarding not yet completed
      const welcomed = localStorage.getItem('3boxes_welcomed');
      const onboardingCompleted = localStorage.getItem('3boxes_onboarding_completed');
      if (welcomed && !onboardingCompleted) {
        const timer = setTimeout(() => setShow(true), 500);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage might not be available
    }
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1 && !isAnimating) {
      setSlideDirection('left');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
        setIsAnimating(false);
      }, 200);
    }
  }, [currentStep, steps.length, isAnimating]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0 && !isAnimating) {
      setSlideDirection('right');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev - 1);
        setIsAnimating(false);
      }, 200);
    }
  }, [currentStep, isAnimating]);

  const handleSkip = useCallback(() => {
    localStorage.setItem('3boxes_onboarding_completed', 'true');
    setShow(false);
  }, []);

  const handleGetStarted = useCallback(() => {
    localStorage.setItem('3boxes_onboarding_completed', 'true');
    setShow(false);
  }, []);

  const handleLinkClick = useCallback((link: string) => {
    localStorage.setItem('3boxes_onboarding_completed', 'true');
    setShow(false);
    router.push(link);
  }, [router]);

  const handleDotClick = useCallback((idx: number) => {
    if (!isAnimating && idx !== currentStep) {
      setSlideDirection(idx > currentStep ? 'left' : 'right');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(idx);
        setIsAnimating(false);
      }, 200);
    }
  }, [isAnimating, currentStep]);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  if (!mounted || !show || !step) return null;

  const Icon = step.icon;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ animation: 'onboardingFadeIn 0.3s ease-out' }}
    >
        {/* Backdrop with spotlight */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleSkip} />

        {/* Modal Card */}
        <div
          className="relative z-10 w-full max-w-lg"
          style={{ animation: 'scaleIn 0.4s ease-out' }}
        >
          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute -top-1 -right-1 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all backdrop-blur-sm border border-white/10"
          >
            <FiX className="w-5 h-5" />
          </button>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header with gradient */}
            <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 px-8 pt-8 pb-12 overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

              {/* Step counter */}
              <div className="relative flex items-center justify-between mb-6">
                <span className="text-xs font-bold text-white/50 uppercase tracking-widest">
                  Step {currentStep + 1} of {steps.length}
                </span>
                <div className={`${step.iconBg} w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg`}>
                  <Icon className={`w-7 h-7 ${step.iconColor}`} />
                </div>
              </div>

              {/* Step title */}
              <h2 className="relative text-2xl font-extrabold text-white mb-1">
                {step.title}
              </h2>
              <p className="relative text-sm text-white/60 leading-relaxed max-w-sm">
                {step.description}
              </p>
            </div>

            {/* Content */}
            <div
              className="px-8 py-6"
              key={currentStep}
              style={{
                animation: slideDirection === 'left'
                  ? 'slideInLeft 0.3s ease-out'
                  : 'slideInRight 0.3s ease-out',
              }}
            >
              {/* Features list */}
              {step.features && step.features.length > 0 && (
                <div className="space-y-3 mb-6">
                  {step.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <FiCheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-600">{feature}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Link button */}
              {step.link && (
                <button
                  onClick={() => handleLinkClick(step.link!)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-800 transition-colors mb-6 group"
                >
                  {step.linkLabel}
                  <FiArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              {/* Progress dots */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {steps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleDotClick(idx)}
                    className={`transition-all duration-300 rounded-full ${
                      idx === currentStep
                        ? 'w-6 h-2 bg-emerald-500'
                        : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    currentStep === 0
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  <FiChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Skip Tour
                  </button>

                  {isLastStep ? (
                    <button
                      onClick={handleGetStarted}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/35 hover:scale-105 transition-all duration-200"
                    >
                      <FiCheckCircle className="w-4 h-4" />
                      Get Started!
                    </button>
                  ) : (
                    <button
                      onClick={handleNext}
                      className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/35 hover:scale-105 transition-all duration-200"
                    >
                      Next
                      <FiChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
