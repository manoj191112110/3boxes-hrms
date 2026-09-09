'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Building2, Users, Briefcase, Headphones, Globe, Zap, Star, ArrowRight } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '₹29,000/mo',
    priceAnnual: '₹2,90,000/yr (Save 17%)',
    description: 'For small businesses getting started with HR',
    features: ['Employee Management', 'Leave & Attendance', 'Basic Payroll', 'Email Support', '5 GB Storage'],
    icon: Building2,
    color: 'blue',
  },
  {
    name: 'Professional',
    price: '₹79,000/mo',
    priceAnnual: '₹7,90,000/yr (Save 17%)',
    description: 'For growing companies that need full HR capabilities',
    features: ['All Starter features', 'Recruitment & Onboarding', 'AI Interview (Basic)', 'Payroll Management', 'Performance Reviews', 'Priority Support', '25 GB Storage'],
    icon: Users,
    color: 'purple',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '₹1,99,000/mo',
    priceAnnual: '₹19,90,000/yr (Save 17%)',
    description: 'For large organizations with complex needs',
    features: ['All Professional features', 'AI Interview (Advanced)', 'Custom Workflows', 'Dedicated Account Manager', 'API Access', 'Unlimited Storage'],
    icon: Globe,
    color: 'emerald',
  },
];

export default function ChoosePlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  const tenantSlug = searchParams.get('tenant') || '';
  const email = searchParams.get('email') || '';

  const handleSelectPlan = async (planName: string) => {
    setLoading(planName);
    try {
      const res = await fetch('/api/trial/choose-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planName, tenantSlug, email }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(data.redirectUrl || '/login');
      }
    } catch {
      // Silent error handling
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-6">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Your trial is almost ready!</h1>
          <p className="text-lg text-gray-600">
            Choose a plan to continue using 3Boxes HRMS after your trial ends. No charges until the trial period is over.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center mb-8 gap-3">
          <span className={billing === 'monthly' ? 'font-semibold text-gray-900' : 'text-gray-500'}>Monthly</span>
          <button
            onClick={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              billing === 'annual' ? 'bg-emerald-600' : 'bg-gray-300'
            }`}
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              billing === 'annual' ? 'translate-x-7' : 'translate-x-0.5'
            }`} />
          </button>
          <span className={billing === 'annual' ? 'font-semibold text-gray-900' : 'text-gray-500'}>
            Annual
            <span className="ml-1.5 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">Save 17%</span>
          </span>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border-2 p-6 transition-all ${
                plan.popular
                  ? 'border-emerald-500 shadow-xl scale-105'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-600 text-white text-sm font-semibold rounded-full">
                  Most Popular
                </div>
              )}

              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                plan.color === 'blue' ? 'bg-green-100 text-green-600' :
                plan.color === 'purple' ? 'bg-teal-100 text-teal-600' :
                'bg-emerald-100 text-emerald-600'
              }`}>
                <plan.icon className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold text-gray-900">
                  {billing === 'annual' ? plan.priceAnnual : plan.price}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-2">{plan.description}</p>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.name)}
                disabled={loading === plan.name}
                className={`w-full mt-8 py-3 px-4 rounded-xl font-semibold transition-all ${
                  plan.popular
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/25'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                {loading === plan.name ? 'Setting up...' : `Choose ${plan.name}`}
                <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-sm text-gray-500 mt-8">
          All plans include a 15-day free trial. No credit card required until the trial period ends.
        </p>
      </div>
    </div>
  );
}
