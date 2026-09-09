'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore, isHiddenTenant } from '@/store/companyContextStore';
import { FiMail, FiStar, FiHeart, FiGift, FiArrowRight } from 'react-icons/fi';

interface WelcomeGreetingProps {
  onComplete: () => void;
}

// Pre-defined confetti particle data (deterministic)
function generateConfettiData() {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f43f5e'];
  const particles = [];
  let seed = 42;
  const seededRandom = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 50; i++) {
    particles.push({
      id: i,
      delay: seededRandom() * 2,
      duration: 2 + seededRandom() * 3,
      left: seededRandom() * 100,
      color: colors[Math.floor(seededRandom() * colors.length)],
      size: 4 + seededRandom() * 8,
      isRound: seededRandom() > 0.5,
    });
  }
  return particles;
}

const CONFETTI_DATA = generateConfettiData();

export default function WelcomeGreeting({ onComplete }: WelcomeGreetingProps) {
  const { user } = useAuthStore();
  // ─── GOLDEN RULE: Use filtered tenant from companyContextStore ───
  const ctxTenant = useCompanyContextStore(s => s.tenant);
  const safeTenantLogo = (ctxTenant && ctxTenant.slug && !isHiddenTenant(ctxTenant.slug))
    ? ctxTenant.logo
    : null;
  const [show, setShow] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hasTriggeredOnComplete = useRef(false);

  useEffect(() => {
    setMounted(true);
    try {
      const welcomed = localStorage.getItem('3boxes_welcomed');
      if (!welcomed) {
        const showTimer = setTimeout(() => setShow(true), 100);
        const openTimer = setTimeout(() => {
          setIsOpen(true);
          setTimeout(() => setShowContent(true), 600);
        }, 1600);
        return () => {
          clearTimeout(showTimer);
          clearTimeout(openTimer);
        };
      }
    } catch {
      // localStorage might not be available
    }
  }, []);

  const handleCardClick = useCallback(() => {
    if (!isOpen) {
      setIsOpen(true);
      setTimeout(() => setShowContent(true), 600);
    }
  }, [isOpen]);

  const handleGetStarted = useCallback(() => {
    try { localStorage.setItem('3boxes_welcomed', 'true'); } catch { /* ignore */ }
    setShow(false);
    if (!hasTriggeredOnComplete.current) {
      hasTriggeredOnComplete.current = true;
      onComplete();
    }
  }, [onComplete]);

  // Don't render until mounted (avoid SSR/hydration issues)
  if (!mounted || !show) return null;

  const userName = user?.name || 'Team Member';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Confetti */}
      {isOpen && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {CONFETTI_DATA.map((p) => (
            <div
              key={p.id}
              className="absolute top-0 pointer-events-none"
              style={{
                left: `${p.left}%`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                animationFillMode: 'both',
                animationName: 'confettiFall',
                animationIterationCount: '1',
              }}
            >
              <div
                style={{
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  borderRadius: p.isRound ? '50%' : '2px',
                  animation: `confettiSpin ${p.duration * 0.5}s linear infinite`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Card Container */}
      <div
        className="relative z-10 cursor-pointer"
        style={{
          perspective: '1200px',
          width: 'min(500px, 90vw)',
          height: 'min(600px, 85vh)',
        }}
        onClick={handleCardClick}
      >
        {/* Card Base (inside content) */}
        <div
          className="absolute inset-0 rounded-2xl bg-white shadow-2xl overflow-hidden"
          style={{
            boxShadow: '0 25px 60px rgba(0,0,0,0.3), 0 0 80px rgba(99,102,241,0.15)',
          }}
        >
          {/* Inside card content */}
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            {/* Brand Logo */}
            <div
              className="mb-6"
              style={{
                animation: showContent ? 'fadeInUp 0.6s ease-out 0.2s both' : 'none',
              }}
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 via-indigo-500 to-violet-600 flex items-center justify-center shadow-lg mx-auto mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={safeTenantLogo || user?.employee?.companyLogo || '/images/logo-3boxes-hrms.png'} alt="Company Logo" className="w-16 h-16 rounded-xl object-contain" />
              </div>
            </div>

            {/* Welcome message */}
            <div style={{ animation: showContent ? 'fadeInUp 0.6s ease-out 0.4s both' : 'none' }}>
              <p className="text-sm font-semibold text-indigo-500 tracking-widest uppercase mb-2">
                Welcome to
              </p>
              <h1 className="text-3xl font-extrabold text-slate-900 mb-1">
                3Boxes HRMS
              </h1>
            </div>

            <div style={{ animation: showContent ? 'fadeInUp 0.6s ease-out 0.6s both' : 'none' }}>
              <p className="text-lg text-slate-500 mb-6">
                Hello, <span className="font-bold text-indigo-600">{userName}</span>!
              </p>
            </div>

            <div style={{ animation: showContent ? 'fadeInUp 0.6s ease-out 0.8s both' : 'none' }}>
              <p className="text-slate-600 leading-relaxed max-w-sm mx-auto mb-8">
                We&apos;re thrilled to have you on board! 3Boxes HRMS is your all-in-one platform for managing
                leaves, attendance, payroll, and so much more. Let&apos;s get you started on this exciting journey!
              </p>
            </div>

            {/* Feature highlights */}
            <div
              className="grid grid-cols-3 gap-4 w-full max-w-sm mb-8"
              style={{ animation: showContent ? 'fadeInUp 0.6s ease-out 1s both' : 'none' }}
            >
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-indigo-50">
                <FiStar className="w-5 h-5 text-indigo-500" />
                <span className="text-xs font-semibold text-indigo-700">Easy Leave</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-emerald-50">
                <FiHeart className="w-5 h-5 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-700">Payroll</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-amber-50">
                <FiGift className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-700">Benefits</span>
              </div>
            </div>

            {/* Get Started Button */}
            <div style={{ animation: showContent ? 'fadeInUp 0.6s ease-out 1.2s both' : 'none' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGetStarted();
                }}
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 transition-all duration-200"
              >
                Let&apos;s Get Started
                <FiArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Card Front Flap (envelope cover) */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{
            transformOrigin: 'top center',
            transform: isOpen ? 'rotateX(-180deg)' : 'rotateX(0deg)',
            transition: 'transform 0.8s cubic-bezier(0.4, 0.0, 0.2, 1)',
            zIndex: isOpen ? -1 : 10,
            backfaceVisibility: 'hidden',
          }}
        >
          {/* Front of envelope */}
          <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex flex-col items-center justify-center p-8 text-center">
            {/* Envelope seal decoration */}
            <div className="relative mb-8">
              <div
                className="w-24 h-24 rounded-full bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/20"
                style={{
                  animation: !isOpen ? 'envelopePulse 2s ease-in-out infinite' : 'none',
                }}
              >
                <FiMail className="w-10 h-10 text-white" />
              </div>
              {/* Sparkle dots */}
              <div
                className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-amber-400"
                style={{ animation: 'floatUp 1.5s ease-in-out infinite' }}
              />
              <div
                className="absolute -bottom-1 -left-3 w-3 h-3 rounded-full bg-pink-400"
                style={{ animation: 'floatUp 2s ease-in-out infinite 0.5s' }}
              />
              <div
                className="absolute top-0 -left-6 w-2 h-2 rounded-full bg-emerald-400"
                style={{ animation: 'floatUp 1.8s ease-in-out infinite 1s' }}
              />
            </div>

            {/* Brand */}
            <div className="mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={safeTenantLogo || user?.employee?.companyLogo || '/images/logo-3boxes-hrms.png'} alt="Company Logo" className="w-10 h-10 rounded-lg object-contain" />
              </div>
              <h2 className="text-2xl font-extrabold text-white mb-1">
                Welcome to 3Boxes HRMS
              </h2>
            </div>

            <p className="text-white/80 text-lg font-medium mb-2">
              Hello, {userName}!
            </p>

            <p className="text-white/60 text-sm">
              {isOpen ? '' : 'Tap to open your welcome card'}
            </p>

            {/* Decorative bottom edge */}
            <div className="absolute bottom-0 left-0 right-0">
              <svg viewBox="0 0 500 40" className="w-full" preserveAspectRatio="none">
                <path d="M0,40 L250,0 L500,40 Z" fill="rgba(255,255,255,0.1)" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
