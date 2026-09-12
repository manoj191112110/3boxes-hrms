'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  FiMenu,
  FiX,
  FiArrowRight,
} from 'react-icons/fi';

const navLinks = [
  { label: 'Home', href: '/landing' },
  { label: 'Features', href: '/landing/features' },
  { label: 'Workflows', href: '/landing/workflows' },
  { label: 'Modules', href: '/landing/modules' },
  { label: 'Pricing', href: '/landing/pricing' },
];

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ─── Sticky Header ─── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-lg shadow-sm border-b border-slate-100'
            : 'bg-white/70 backdrop-blur-md'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 sm:h-28">
            {/* Logo */}
            <Link href="/landing" className="flex items-center gap-3">
              <Image
                src="/images/logo-3boxes-hrms.png"
                alt="3Boxes HRMS Logo"
                width={56}
                height={56}
                className="rounded-xl"
                priority
              />
              <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                3Boxes <span className="gradient-text">HRMS</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6 lg:gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* CTA + Mobile Toggle */}
            <div className="flex items-center gap-3">
              <Link
                href="/landing/trial"
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-105 transition-all"
              >
                Start Free Trial
                <FiArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 shadow-lg animate-slide-in-down">
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-slate-600 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/landing/trial"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg text-center mt-3"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 pt-20 sm:pt-28">{children}</main>

      {/* ─── Shared Footer ─── */}
      <footer className="bg-slate-900 text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Link href="/landing" className="flex items-center gap-3">
                <Image
                  src="/images/logo-3boxes-hrms.png"
                  alt="3Boxes HRMS Logo"
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
                <span className="text-xl font-bold text-white">
                  3Boxes <span className="text-green-400">HRMS</span>
                </span>
              </Link>
              <p className="mt-4 text-sm leading-relaxed">
                The complete AI-powered Human Resource Management System for modern organizations.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Product
              </h4>
              <ul className="space-y-2.5">
                <li><Link href="/landing/features" className="text-sm hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/landing/workflows" className="text-sm hover:text-white transition-colors">Workflows</Link></li>
                <li><Link href="/landing/modules" className="text-sm hover:text-white transition-colors">Modules</Link></li>
                <li><Link href="/landing/pricing" className="text-sm hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/landing/trial" className="text-sm hover:text-white transition-colors">Free Trial</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Company
              </h4>
              <ul className="space-y-2.5">
                {['About Us', 'Careers', 'Blog', 'Contact'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Legal
              </h4>
              <ul className="space-y-2.5">
                {['Privacy Policy', 'Terms of Service', 'GDPR', 'Security'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm hover:text-white transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm">
              &copy; {new Date().getFullYear()} 3Boxes HRMS. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm hover:text-white transition-colors">Privacy</a>
              <a href="#" className="text-sm hover:text-white transition-colors">Terms</a>
              <a href="#" className="text-sm hover:text-white transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
