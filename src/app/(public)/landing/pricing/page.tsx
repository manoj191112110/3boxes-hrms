'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FiCheck,
  FiArrowRight,
  FiDollarSign,
  FiZap,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';

/* ─── Pricing Plans ─── */
const pricingPlans = [
  {
    name: 'Starter',
    price: '₹4,999',
    period: '/month',
    description: 'Perfect for small teams getting started with HR automation.',
    features: [
      'Up to 50 employees',
      'Core HR & Employee Management',
      'Attendance & Leave',
      'Basic Payroll',
      'Recruitment ATS',
      'Email Support',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '₹12,999',
    period: '/month',
    description: 'For growing companies that need advanced HR capabilities.',
    features: [
      'Up to 250 employees',
      'Everything in Starter',
      'Performance & OKRs',
      'Advanced Payroll & Compliance',
      'AI Chatbot & Analytics',
      'Multi-Company Support',
      'Custom Workflows',
      'Priority Support',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Coming Soon',
    period: '',
    description: 'For large organizations with complex HR needs.',
    features: [
      'Unlimited employees',
      'Everything in Professional',
      'AI-Powered Insights',
      'Custom Integrations',
      'Dedicated Account Manager',
      'SLA Guarantee',
      'On-Premise Option',
      'Custom Training',
    ],
    cta: 'Contact Us',
    highlighted: false,
  },
];

/* ─── FAQ Data ─── */
const faqs = [
  {
    question: 'How does the 15-day free trial work?',
    answer: 'You get full access to all 3Boxes HRMS features for 15 days. No credit card is required to start. After the trial period, you can choose a subscription plan that fits your needs or simply let the trial expire — no strings attached.',
  },
  {
    question: 'Can I change my plan later?',
    answer: 'Yes, you can upgrade or downgrade your plan at any time. When upgrading, you gain immediate access to additional features. When downgrading, the change takes effect at the start of your next billing cycle.',
  },
  {
    question: 'What happens when I exceed the employee limit?',
    answer: 'If you exceed your plan\'s employee limit, you\'ll be notified and can upgrade to a higher plan. We won\'t restrict access during your billing period, but you\'ll need to upgrade before the next renewal.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. 3Boxes HRMS uses bank-grade encryption, regular security audits, and follows GDPR compliance standards. Your data is stored securely with daily backups and access controls.',
  },
  {
    question: 'Do you offer custom pricing for large organizations?',
    answer: 'Yes, our Enterprise plan supports custom pricing based on your organization\'s size and requirements. Contact our sales team to discuss tailored solutions for your needs.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards, debit cards, net banking, and UPI payments. For Enterprise plans, we also support bank transfers and custom billing arrangements.',
  },
];

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div>
      {/* ─── Hero ─── */}
      <section className="relative pt-12 sm:pt-20 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/80 via-green-50/40 to-white" />
        <div className="absolute top-10 left-1/3 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/3 w-96 h-96 bg-green-400/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-4">
            <FiDollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Pricing
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900">
            Simple, <span className="gradient-text">Transparent Pricing</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
            Start with a 15-day free trial, then choose the plan that fits your organization.
            No hidden fees, no surprises.
          </p>
        </div>
      </section>

      {/* ─── Pricing Cards ─── */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, idx) => (
              <div
                key={idx}
                className={`relative rounded-2xl p-6 sm:p-8 transition-all duration-300 ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-green-600 to-emerald-600 text-white shadow-2xl shadow-green-500/25 scale-[1.02] lg:scale-105'
                    : plan.name === 'Enterprise'
                    ? 'bg-slate-900 text-white border border-slate-800'
                    : 'bg-white border border-slate-200 shadow-sm hover:shadow-lg'
                }`}
              >
                {/* Popular Badge */}
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-amber-400 text-slate-900 text-xs font-bold shadow-lg">
                    Most Popular
                  </div>
                )}

                {/* Enterprise Badge */}
                {plan.name === 'Enterprise' && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-slate-700 text-slate-300 text-xs font-bold">
                    Coming Soon
                  </div>
                )}

                <h3
                  className={`text-xl font-bold ${
                    plan.highlighted ? 'text-white' : plan.name === 'Enterprise' ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {plan.name}
                </h3>

                <div className="mt-4">
                  <span
                    className={`text-4xl sm:text-5xl font-extrabold ${
                      plan.highlighted ? 'text-white' : plan.name === 'Enterprise' ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span
                      className={`text-sm ${
                        plan.highlighted ? 'text-green-200' : 'text-slate-500'
                      }`}
                    >
                      {plan.period}
                    </span>
                  )}
                </div>

                <p
                  className={`mt-3 text-sm leading-relaxed ${
                    plan.highlighted ? 'text-green-200' : plan.name === 'Enterprise' ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {plan.description}
                </p>

                <div className="mt-6 space-y-3">
                  {plan.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2.5">
                      <FiCheck
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          plan.highlighted ? 'text-green-200' : plan.name === 'Enterprise' ? 'text-slate-500' : 'text-emerald-500'
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          plan.highlighted ? 'text-green-100' : plan.name === 'Enterprise' ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <Link
                  href={plan.name === 'Enterprise' ? '/landing' : '/landing/trial'}
                  className={`mt-8 flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                    plan.highlighted
                      ? 'bg-white text-green-600 hover:bg-green-50 shadow-lg'
                      : plan.name === 'Enterprise'
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {plan.cta}
                  <FiArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>

          {/* Trust note */}
          <div className="mt-10 text-center">
            <p className="text-sm text-slate-500">
              All plans include a 15-day free trial. No credit card required to start.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FAQ Section ─── */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-green-50/50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-4">
              <FiZap className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                FAQ
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Got questions about pricing? We&apos;ve got answers.
            </p>
          </div>

          {/* FAQ Items */}
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                >
                  <span className="text-base font-semibold text-slate-900 pr-4">{faq.question}</span>
                  {openFaq === idx ? (
                    <FiChevronUp className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <FiChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-5 border-t border-slate-100 pt-4">
                    <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-green-600 to-emerald-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Start Your 15-Day Free Trial Today
          </h2>
          <p className="mt-4 text-lg text-green-200">
            No credit card required. Full access to every feature for 15 days.
          </p>
          <div className="mt-8">
            <Link
              href="/landing/trial"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-green-600 text-base font-bold shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
            >
              Start Free Trial <FiArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
