'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  FiBriefcase, FiArrowRight, FiExternalLink, FiMail,
  FiPhone, FiMapPin, FiSend, FiUser, FiMessageSquare,
  FiLayers, FiClock, FiCheckCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { Card } from '@/components/nexus-ui';
import { validateEmail, validateName } from '@/lib/validators';

const CONTACT_CARDS = [
  { icon: FiMail, title: 'Email Us', lines: ['careers@3boxes-hrms.com', 'support@3boxes-hrms.com'], href: 'mailto:careers@3boxes-hrms.com', accent: 'from-green-500 to-emerald-600' },
  { icon: FiPhone, title: 'Call Us', lines: ['+1 (555) 014-2025', 'Mon–Fri, 9am–6pm IST'], href: 'tel:+15550142025', accent: 'from-teal-500 to-teal-600' },
  { icon: FiMapPin, title: 'Visit Us', lines: ['3 Boxes HRMS HQ', 'Cyber City, Tower B, Floor 12', 'Bengaluru, KA 560001'], href: 'https://maps.google.com/?q=Cyber+City+Bengaluru', accent: 'from-rose-500 to-pink-600' },
];

const FAQ_LINKS = [
  { label: 'How do I apply for a job?', href: '/careers#openings' },
  { label: 'Where can I track my application?', href: '/login?mode=candidate' },
  { label: 'Browse open positions', href: '/careers#openings' },
  { label: 'See hiring companies', href: '/careers/companies' },
];

interface ContactForm { name: string; email: string; subject: string; message: string; }
const EMPTY_FORM: ContactForm = { name: '', email: '', subject: '', message: '' };

export default function ContactPage() {
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  function update<K extends keyof ContactForm>(key: K, value: string) { setForm((prev) => ({ ...prev, [key]: value })); }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { name, email, subject, message } = form;
    const nameResult = validateName(name, 'Name');
    if (!nameResult.valid) { toast.error(nameResult.error!); return; }
    const emailResult = validateEmail(email);
    if (!emailResult.valid) { toast.error(emailResult.error!); return; }
    if (!subject.trim()) { toast.error('Please add a subject.'); return; }
    if (!message.trim() || message.length < 10) { toast.error('Please write a message (at least 10 characters).'); return; }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setSent(true);
    toast.success('Message sent');
    setForm(EMPTY_FORM);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* ───────────── Top Navigation ───────────── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/careers" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 flex items-center justify-center shadow-md shadow-green-500/30 group-hover:shadow-lg transition-shadow">
              <FiBriefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-extrabold text-base leading-tight">3 Boxes HRMS</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Career Portal</p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/careers" className="hover:text-green-600 transition-colors">Home</Link>
            <Link href="/careers/categories" className="hover:text-green-600 transition-colors">Categories</Link>
            <Link href="/careers/companies" className="hover:text-green-600 transition-colors">Companies</Link>
            <Link href="/careers/about" className="hover:text-green-600 transition-colors">About</Link>
            <Link href="/careers/contact" className="text-green-600 font-semibold">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login?mode=candidate" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:text-green-600 transition-colors">
              Sign In <FiExternalLink className="w-3.5 h-3.5" />
            </Link>
            <Link href="/careers#openings" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 transition-all shadow-md shadow-green-500/20">
              Browse Jobs <FiArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ───────────── Hero ───────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-green-700 via-emerald-700 to-teal-700 text-white">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-green-400/30 rounded-full blur-3xl" />
          <div className="absolute -top-40 right-0 w-[28rem] h-[28rem] bg-teal-400/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-fuchsia-400/20 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-12 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/30 text-xs font-semibold mb-5">
            <FiLayers className="w-3.5 h-3.5" /> Get in Touch
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">Contact Us</h1>
          <p className="text-base sm:text-lg text-green-100 max-w-2xl mx-auto mb-8">
            Questions about a role, an application, or the portal itself? Drop us a note.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#contact-form" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-green-700 bg-white hover:bg-green-50 transition-colors shadow-lg">
              Send a message <FiArrowRight className="w-4 h-4" />
            </a>
            <a href="#contact-cards" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-white/10 transition-colors">
              View contact info <FiArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ───────────── Contact info cards ───────────── */}
      <section id="contact-cards" className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CONTACT_CARDS.map((c) => {
            const Icon = c.icon;
            return (
              <a key={c.title} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined}
                rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="bg-white rounded-xl border border-slate-200 hover:shadow-lg hover:border-teal-300 transition-all p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.accent} flex items-center justify-center shadow-md`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{c.title}</h3>
                </div>
                <div className="space-y-1">
                  {c.lines.map((line, i) => (
                    <p key={line} className={i === 0 ? 'text-sm font-semibold text-slate-800' : 'text-xs text-slate-500'}>{line}</p>
                  ))}
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* ───────────── Main: form + sidebar ───────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div id="contact-form" className="lg:col-span-2">
            <Card className="p-6 sm:p-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Send us a message</h2>
              <p className="text-sm text-slate-500 mt-1 mb-6">Fill in the form below — we&apos;ll respond via email within one business day.</p>

              {sent && (
                <div role="status" className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800">
                  <FiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Message sent successfully!</p>
                    <p className="text-xs text-emerald-700 mt-0.5">Thanks for reaching out. Our team will reply to your email shortly.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Full name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input id="contact-name" type="text" autoComplete="name" value={form.name}
                        onChange={(e) => update('name', e.target.value)} placeholder="Jane Doe"
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-400" required />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input id="contact-email" type="email" autoComplete="email" value={form.email}
                        onChange={(e) => update('email', e.target.value)} placeholder="jane@example.com"
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-400" required />
                    </div>
                  </div>
                </div>
                <div>
                  <label htmlFor="contact-subject" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Subject <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <FiMessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input id="contact-subject" type="text" value={form.subject}
                      onChange={(e) => update('subject', e.target.value)} placeholder="Question about an open role"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-400" required />
                  </div>
                </div>
                <div>
                  <label htmlFor="contact-message" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Message <span className="text-rose-500">*</span>
                  </label>
                  <textarea id="contact-message" rows={6} value={form.message}
                    onChange={(e) => update('message', e.target.value)} placeholder="Tell us how we can help…"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-400 resize-y" required />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                  <button type="submit" disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed">
                    {submitting ? (
                      <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Sending…</>
                    ) : (
                      <><FiSend className="w-4 h-4" /> Send Message</>
                    )}
                  </button>
                  <button type="button" onClick={() => { setForm(EMPTY_FORM); setSent(false); }}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                    Clear form
                  </button>
                  <p className="text-[11px] text-slate-400 sm:ml-auto">We never share your details with third parties.</p>
                </div>
              </form>
            </Card>
          </div>

          <aside className="space-y-5">
            <Card className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                  <FiClock className="w-4 h-4 text-green-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Office Hours</h3>
              </div>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-center justify-between"><span>Monday – Friday</span><span className="font-semibold text-slate-800">9:00 AM – 6:00 PM</span></li>
                <li className="flex items-center justify-between"><span>Saturday</span><span className="font-semibold text-slate-800">10:00 AM – 2:00 PM</span></li>
                <li className="flex items-center justify-between"><span>Sunday</span><span className="font-semibold text-rose-500">Closed</span></li>
              </ul>
              <p className="text-[11px] text-slate-400 mt-3">All times in IST (UTC+5:30).</p>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Quick Links</h3>
              <ul className="space-y-2">
                {FAQ_LINKS.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="flex items-center justify-between gap-2 text-xs text-slate-700 hover:text-green-600 transition-colors group">
                      <span>{l.label}</span>
                      <FiArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-green-600 transition-colors" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-700 via-emerald-700 to-teal-700 text-white p-5">
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-teal-400/30 rounded-full blur-2xl pointer-events-none" />
              <p className="text-sm font-bold mb-1">Looking to apply?</p>
              <p className="text-xs text-green-100 mb-3">Browse all open positions across our group companies — no account required.</p>
              <Link href="/careers#openings" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-white hover:bg-green-50 transition-colors">
                Browse jobs <FiArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-auto py-6 text-center text-xs text-slate-400">© 2025 3 Boxes HRMS · Career Portal</footer>
    </div>
  );
}
