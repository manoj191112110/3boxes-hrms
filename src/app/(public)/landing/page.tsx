'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  FiCheck,
  FiArrowRight,
  FiZap,
  FiPlay,
  FiStar,
  FiGrid,
  FiUsers,
  FiClock,
  FiDollarSign,
  FiCpu,
  FiLayers,
  FiGlobe,
  FiShield,
} from 'react-icons/fi';

/* ─── Animated Counter ─── */
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  return <span>{count.toLocaleString()}{suffix}</span>;
}

export default function LandingHomePage() {
  return (
    <div>
      {/* ─── Hero Section ─── */}
      <section className="relative pt-12 sm:pt-20 lg:pt-28 pb-16 sm:pb-24 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-50/80 via-emerald-50/40 to-white" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-green-400/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-[600px] h-[300px] bg-teal-300/8 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-50 border border-green-100 mb-8">
              <FiZap className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                AI-Powered Human Resource Management
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight">
              Transform Your HR{' '}
              <span className="gradient-text">with 3Boxes HRMS</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              The all-in-one platform that modernizes every aspect of your HR operations — from
              hiring to retiring. Empower your team with AI-driven insights and seamless automation.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-base font-semibold shadow-xl shadow-green-500/25 hover:shadow-green-500/40 hover:scale-105 transition-all"
              >
                Start Your 15-Day Free Trial
                <FiArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/landing/workflows"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-slate-700 text-base font-semibold border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
              >
                <FiPlay className="w-5 h-5 text-green-600" />
                See How It Works
              </Link>
              {/* Super Admin Login — only shown on main domain (3boxeshrms.com) */}
              {typeof window !== 'undefined' && (window.location.hostname === '3boxeshrms.com' || window.location.hostname === 'www.3boxeshrms.com') && (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-slate-900 text-white text-base font-semibold shadow-xl shadow-slate-500/25 hover:shadow-slate-500/40 hover:scale-105 transition-all"
                >
                  <FiShield className="w-5 h-5" />
                  Super Admin Login
                </Link>
              )}
            </div>

            {/* Trust Badges */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <FiCheck className="w-4 h-4 text-emerald-500" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <FiCheck className="w-4 h-4 text-emerald-500" />
                Setup in 2 minutes
              </div>
              <div className="flex items-center gap-2">
                <FiCheck className="w-4 h-4 text-emerald-500" />
                Cancel anytime
              </div>
            </div>
          </div>

          {/* Software Screenshots */}
          <div className="mt-16 sm:mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden shadow-xl shadow-green-500/10 border border-green-100 hover:shadow-2xl hover:shadow-green-500/20 transition-all group">
              <Image
                src="/images/hr-dashboard.png"
                alt="HR Dashboard - 3Boxes HRMS"
                width={400}
                height={300}
                className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-900/60 to-transparent p-4">
                <span className="text-white text-sm font-semibold">HR Dashboard</span>
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-xl shadow-emerald-500/10 border border-emerald-100 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all group">
              <Image
                src="/images/hr-team.png"
                alt="Team Management - 3Boxes HRMS"
                width={400}
                height={300}
                className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-900/60 to-transparent p-4">
                <span className="text-white text-sm font-semibold">Team Management</span>
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-xl shadow-teal-500/10 border border-teal-100 hover:shadow-2xl hover:shadow-teal-500/20 transition-all group">
              <Image
                src="/images/recruitment-ui.png"
                alt="Recruitment UI - 3Boxes HRMS"
                width={400}
                height={300}
                className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-teal-900/60 to-transparent p-4">
                <span className="text-white text-sm font-semibold">Recruitment Pipeline</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 sm:mt-20 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {[
              { value: 500, suffix: '+', label: 'Companies Trust Us' },
              { value: 50, suffix: 'K+', label: 'Employees Managed' },
              { value: 20, suffix: '+', label: 'HR Modules' },
              { value: 99, suffix: '.9%', label: 'Uptime SLA' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="text-center p-4 sm:p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all"
              >
                <div className="text-2xl sm:text-3xl font-bold gradient-text">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── "See How It Works" Section ─── */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-white to-green-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-4">
              <FiPlay className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                See How It Works
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Visualize the Power of 3Boxes HRMS
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Explore the screens that make HR management effortless — from onboarding to payroll.
            </p>
          </div>

          {/* Screenshot Cards */}
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            <div className="group relative rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:border-green-200 transition-all duration-300">
              <Image
                src="/images/onboarding-ui.png"
                alt="Onboarding UI - 3Boxes HRMS"
                width={500}
                height={350}
                className="w-full h-auto object-cover"
              />
              <div className="p-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg mb-3">
                  <FiUsers className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Employee Onboarding</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Automate welcome flows, document collection, and task assignment for new hires.
                </p>
                <Link href="/landing/workflows" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                  View Workflow <FiArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="group relative rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all duration-300">
              <Image
                src="/images/payroll-ui.png"
                alt="Payroll UI - 3Boxes HRMS"
                width={500}
                height={350}
                className="w-full h-auto object-cover"
              />
              <div className="p-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg mb-3">
                  <FiDollarSign className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Payroll Processing</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Accurate, compliant salary runs with auto tax, PF, ESI calculations and bank files.
                </p>
                <Link href="/landing/workflows" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                  View Workflow <FiArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="group relative rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:border-teal-200 transition-all duration-300">
              <Image
                src="/images/attendance-ui.png"
                alt="Attendance UI - 3Boxes HRMS"
                width={500}
                height={350}
                className="w-full h-auto object-cover"
              />
              <div className="p-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-green-500 text-white shadow-lg mb-3">
                  <FiClock className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Attendance & Leave</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Biometric, GPS, shift-based attendance with geofencing, overtime, and smart leave workflows.
                </p>
                <Link href="/landing/features" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                  View Features <FiArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── "What is 3Boxes HRMS?" Section ─── */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-100 mb-4">
                <FiGlobe className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">
                  About 3Boxes HRMS
                </span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                What is <span className="gradient-text">3Boxes HRMS</span>?
              </h2>

              <p className="mt-6 text-lg text-slate-600 leading-relaxed">
                3Boxes HRMS is a comprehensive, AI-powered Human Resource Management System
                designed for modern organizations. It covers every aspect of HR — from hiring
                to retiring — with 20+ integrated modules that work together seamlessly.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                  <FiLayers className="w-5 h-5 text-green-600 mb-2" />
                  <h4 className="text-sm font-bold text-slate-900">Multi-Company</h4>
                  <p className="text-xs text-slate-500 mt-1">Manage group entities from one dashboard</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <FiCpu className="w-5 h-5 text-emerald-600 mb-2" />
                  <h4 className="text-sm font-bold text-slate-900">AI-Powered</h4>
                  <p className="text-xs text-slate-500 mt-1">Chatbot, screening & predictive analytics</p>
                </div>
                <div className="p-4 rounded-xl bg-teal-50 border border-teal-100">
                  <FiStar className="w-5 h-5 text-teal-600 mb-2" />
                  <h4 className="text-sm font-bold text-slate-900">20+ Modules</h4>
                  <p className="text-xs text-slate-500 mt-1">Covering every HR function end-to-end</p>
                </div>
                <div className="p-4 rounded-xl bg-lime-50 border border-lime-100">
                  <FiGrid className="w-5 h-5 text-lime-600 mb-2" />
                  <h4 className="text-sm font-bold text-slate-900">Custom Workflows</h4>
                  <p className="text-xs text-slate-500 mt-1">85% automation, {'<1%'} error rate</p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/landing/features"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-105 transition-all"
                >
                  Explore Features <FiArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/landing/modules"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-slate-700 text-sm font-semibold border border-slate-200 hover:border-green-300 hover:text-green-700 shadow-sm hover:shadow-md transition-all"
                >
                  View All Modules <FiArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right: Feature Highlights */}
            <div className="relative">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Why 3Boxes HRMS?</h3>
                <div className="space-y-4">
                  {[
                    'End-to-end HR coverage: hire to retire in one platform',
                    'AI-powered automation reduces 60% of manual HR tasks',
                    'Multi-company, multi-branch, multi-country support',
                    'Real-time dashboards and predictive analytics',
                    'Compliance-ready: PF, ESI, TDS, GST built-in',
                    'Custom workflows with 85% automation rate',
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                        <FiCheck className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-slate-700 text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Decorative dots */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-green-400/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Explore More Section ─── */}
      <section className="py-16 sm:py-24 bg-gradient-to-r from-green-600 to-emerald-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            Ready to Transform<br className="hidden sm:block" /> Your HR Operations?
          </h2>
          <p className="mt-6 text-lg sm:text-xl text-green-200 max-w-2xl mx-auto">
            Join hundreds of companies that trust 3Boxes HRMS to manage their workforce.
            Start your free trial today — no credit card required.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-green-600 text-base font-bold shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
            >
              Start Free Trial
              <FiArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/landing/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-green-500/30 text-white text-base font-semibold border border-green-400/40 hover:bg-green-500/40 transition-all"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
