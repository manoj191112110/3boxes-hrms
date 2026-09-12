'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FiUpload, FiFileText, FiDownload, FiArrowLeft, FiArrowRight,
  FiCheck, FiZap, FiMail, FiPhone, FiMapPin,
  FiGlobe, FiStar, FiAward, FiEdit2, FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

// ─── Resume Templates ───
const TEMPLATES = [
  {
    id: 'modern',
    name: 'Modern Professional',
    description: 'Clean, contemporary design with accent colors',
    accent: 'from-green-500 to-emerald-600',
    preview: 'bg-gradient-to-r from-green-50 to-emerald-50',
  },
  {
    id: 'executive',
    name: 'Executive Classic',
    description: 'Traditional, authoritative layout',
    accent: 'from-slate-700 to-slate-900',
    preview: 'bg-gradient-to-r from-slate-50 to-slate-100',
  },
  {
    id: 'creative',
    name: 'Creative Edge',
    description: 'Bold, eye-catching for design roles',
    accent: 'from-teal-500 to-pink-500',
    preview: 'bg-gradient-to-r from-teal-50 to-pink-50',
  },
  {
    id: 'minimal',
    name: 'Minimal ATS-Friendly',
    description: 'Simple, optimized for ATS systems',
    accent: 'from-emerald-500 to-teal-600',
    preview: 'bg-gradient-to-r from-emerald-50 to-teal-50',
  },
] as const;

interface ResumeData {
  name: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  education: Array<{
    degree: string;
    institution: string;
    year: string;
    gpa?: string;
  }>;
  skills: string[];
  certifications: string[];
  languages: string[];
}

interface OptimizationAspect {
  category: string;
  score: number;
  maxScore: number;
  feedback: string;
  suggestions: string[];
  icon: React.ReactNode;
}

export default function ResumeBuilderPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'template' | 'preview' | 'optimize'>('upload');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('modern');
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aspects, setAspects] = useState<OptimizationAspect[]>([]);
  const [overallScore, setOverallScore] = useState<number>(0);

  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_candidate_token') : null;

  // ─── File upload handler ───
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Resume must be under 5 MB');
      return;
    }
    setUploadedFile(file);
    setIsProcessing(true);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      // Parse resume using existing API
      const parseRes = await fetch('/api/public/parse-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeDataUrl: dataUrl }),
      });

      if (parseRes.ok) {
        const parseData = await parseRes.json();
        const p = parseData.parsed;
        setResumeData({
          name: p.name || '',
          email: p.email || '',
          phone: p.phone || '',
          location: p.location || '',
          website: p.website || '',
          summary: p.summary || '',
          experience: p.experience || [],
          education: p.education || [],
          skills: Array.isArray(p.skills) ? p.skills : [],
          certifications: p.certifications || [],
          languages: p.languages || [],
        });
        toast.success('Resume parsed successfully!');
        setStep('template');
      } else {
        throw new Error('Failed to parse resume');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to process resume');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Rebuild resume with AI ───
  const handleRebuildResume = async () => {
    if (!resumeData || !token || !uploadedFile) return;
    setIsProcessing(true);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(uploadedFile);
      });

      const rebuildRes = await fetch('/api/candidate-portal/resume/rebuild', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resumeDataUrl: dataUrl,
          templateId: selectedTemplate,
        }),
      });

      if (rebuildRes.ok) {
        const rebuildData = await rebuildRes.json();
        if (rebuildData.resume) {
          setResumeData(rebuildData.resume);
        }
        if (rebuildData.aspects) {
          setAspects(rebuildData.aspects);
          setOverallScore(rebuildData.overallScore || 0);
        }
        toast.success('Resume rebuilt with AI!');
        setStep('optimize');
      } else {
        throw new Error('Failed to rebuild resume');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to rebuild');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Download resume ───
  const handleDownloadResume = () => {
    if (!resumeData) return;
    const content = generateResumeText(resumeData, selectedTemplate);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume-${resumeData.name || 'candidate'}-${selectedTemplate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Resume downloaded!');
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Please login to access the resume builder.</p>
          <Link href="/candidate-portal/login" className="text-teal-600 hover:underline">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/candidate-portal/dashboard" className="text-slate-500 hover:text-teal-600">
              <FiArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 text-white flex items-center justify-center">
              <FiFileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">AI Resume Builder</h1>
              <p className="text-[11px] text-slate-500">Upload, rebuild, and optimize your resume</p>
            </div>
          </div>
          {/* Step indicator */}
          <div className="hidden sm:flex items-center gap-2">
            {['upload', 'template', 'preview', 'optimize'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s ? 'bg-teal-600 text-white' :
                  ['upload', 'template', 'preview', 'optimize'].indexOf(step) > i ? 'bg-teal-200 text-teal-700' : 'bg-slate-200 text-slate-500'
                }`}>
                  {i + 1}
                </div>
                {i < 3 && <div className={`w-6 h-0.5 ${['upload', 'template', 'preview', 'optimize'].indexOf(step) > i ? 'bg-teal-400' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* ─── STEP 1: Upload ─── */}
        {step === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                <FiUpload className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload Your Resume</h2>
              <p className="text-sm text-slate-500">We&apos;ll parse your resume and help you rebuild it with AI</p>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/50 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.rtf,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              {isProcessing ? (
                <div className="space-y-3">
                  <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-slate-600">Parsing your resume...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <FiFileText className="w-12 h-12 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">Click to upload or drag and drop</p>
                  <p className="text-xs text-slate-500">PDF, DOC, DOCX, RTF, or TXT (max 5 MB)</p>
                </div>
              )}
            </div>

            {/* Quick features */}
            <div className="grid grid-cols-3 gap-4 mt-8">
              {[
                { icon: FiZap, title: 'AI Rebuild', desc: 'Reformat & enhance' },
                { icon: FiStar, title: '4 Templates', desc: 'Professional designs' },
                { icon: FiZap, title: 'ATS Optimized', desc: 'Pass automated screening' },
              ].map((f, i) => (
                <div key={i} className="text-center p-4 rounded-xl bg-white border border-slate-200">
                  <f.icon className="w-6 h-6 text-teal-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">{f.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── STEP 2: Choose Template ─── */}
        {step === 'template' && resumeData && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Choose a Template</h2>
              <p className="text-sm text-slate-500">Select a design that matches your industry and style</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`relative p-6 rounded-2xl border-2 transition-all text-left ${
                    selectedTemplate === template.id
                      ? 'border-teal-500 ring-4 ring-teal-100 shadow-lg'
                      : 'border-slate-200 hover:border-teal-300 hover:shadow-md'
                  }`}
                >
                  {selectedTemplate === template.id && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center">
                      <FiCheck className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`w-full h-24 rounded-lg mb-4 ${template.preview} flex items-center justify-center`}>
                    <div className={`w-16 h-3 rounded bg-gradient-to-r ${template.accent}`} />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm">{template.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{template.description}</p>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setStep('upload')}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Back
              </button>
              <button
                onClick={() => setStep('preview')}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 shadow-lg shadow-teal-500/25"
              >
                Preview Resume <FiArrowRight className="inline w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Preview ─── */}
        {step === 'preview' && resumeData && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">Preview Your Resume</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep('template')}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Change Template
                </button>
                <button
                  onClick={handleRebuildResume}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 disabled:opacity-60 shadow-lg shadow-teal-500/25 flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Rebuilding...
                    </>
                  ) : (
                    <>
                      <FiZap className="w-4 h-4" /> Rebuild with AI
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Resume preview */}
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-8 max-w-3xl mx-auto">
              <ResumePreview data={resumeData} templateId={selectedTemplate} />
            </div>

            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => setStep('template')}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Back
              </button>
              <button
                onClick={handleRebuildResume}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 disabled:opacity-60 shadow-lg shadow-teal-500/25"
              >
                {isProcessing ? 'Rebuilding...' : <>Rebuild with AI <FiArrowRight className="inline w-4 h-4 ml-1" /></>}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Optimization Results ─── */}
        {step === 'optimize' && resumeData && (
          <div>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white mb-4">
                <FiCheck className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Resume Optimized!</h2>
              <p className="text-sm text-slate-500">Your resume has been rebuilt and optimized for maximum impact</p>
            </div>

            {/* Overall score */}
            <div className="max-w-3xl mx-auto mb-8">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800">Overall Score</h3>
                  <div className={`text-3xl font-bold ${
                    overallScore >= 80 ? 'text-emerald-600' :
                    overallScore >= 60 ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {overallScore}%
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div
                    className={`h-full rounded-full transition-all ${
                      overallScore >= 80 ? 'bg-emerald-500' :
                      overallScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${overallScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Optimization aspects */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto mb-8">
              {aspects.map((aspect, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-teal-500">{aspect.icon}</span>
                      <h4 className="font-semibold text-slate-800 text-sm">{aspect.category}</h4>
                    </div>
                    <span className={`text-sm font-bold ${
                      aspect.score >= aspect.maxScore * 0.8 ? 'text-emerald-600' :
                      aspect.score >= aspect.maxScore * 0.6 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {aspect.score}/{aspect.maxScore}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">{aspect.feedback}</p>
                  {aspect.suggestions.length > 0 && (
                    <ul className="space-y-1">
                      {aspect.suggestions.map((s, j) => (
                        <li key={j} className="text-xs text-slate-500 flex items-start gap-1.5">
                          <span className="text-teal-500 mt-0.5">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {/* Final resume preview */}
            <div className="max-w-3xl mx-auto mb-8">
              <h3 className="font-semibold text-slate-800 mb-3">Your Optimized Resume</h3>
              <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-8">
                <ResumePreview data={resumeData} templateId={selectedTemplate} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setStep('preview')}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-2"
              >
                <FiEdit2 className="w-4 h-4" /> Edit Resume
              </button>
              <button
                onClick={handleDownloadResume}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 flex items-center gap-2"
              >
                <FiDownload className="w-4 h-4" /> Download Resume
              </button>
              <Link
                href="/candidate-portal/dashboard"
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Resume Preview Component ───
function ResumePreview({ data, templateId }: { data: ResumeData; templateId: string }) {
  const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];

  return (
    <div className="font-sans">
      {/* Header */}
      <div className={`pb-4 mb-4 border-b-2`}>
        <h1 className={`text-2xl font-bold bg-gradient-to-r ${template.accent} bg-clip-text text-transparent`}>
          {data.name || 'Your Name'}
        </h1>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-600">
          {data.email && <span className="flex items-center gap-1"><FiMail className="w-3 h-3" /> {data.email}</span>}
          {data.phone && <span className="flex items-center gap-1"><FiPhone className="w-3 h-3" /> {data.phone}</span>}
          {data.location && <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3" /> {data.location}</span>}
          {data.website && <span className="flex items-center gap-1"><FiGlobe className="w-3 h-3" /> {data.website}</span>}
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="mb-4">
          <h2 className={`text-sm font-bold uppercase tracking-wider mb-2 bg-gradient-to-r ${template.accent} bg-clip-text text-transparent`}>
            Professional Summary
          </h2>
          <p className="text-xs text-slate-700 leading-relaxed">{data.summary}</p>
        </div>
      )}

      {/* Experience */}
      {data.experience.length > 0 && (
        <div className="mb-4">
          <h2 className={`text-sm font-bold uppercase tracking-wider mb-2 bg-gradient-to-r ${template.accent} bg-clip-text text-transparent`}>
            Experience
          </h2>
          <div className="space-y-3">
            {data.experience.map((exp, i) => (
              <div key={i}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{exp.title}</h3>
                    <p className="text-xs text-slate-600">{exp.company} {exp.location && `· ${exp.location}`}</p>
                  </div>
                  <span className="text-[10px] text-slate-500">{exp.startDate} - {exp.endDate}</span>
                </div>
                {exp.description && <p className="text-xs text-slate-700 mt-1 leading-relaxed">{exp.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {data.education.length > 0 && (
        <div className="mb-4">
          <h2 className={`text-sm font-bold uppercase tracking-wider mb-2 bg-gradient-to-r ${template.accent} bg-clip-text text-transparent`}>
            Education
          </h2>
          <div className="space-y-2">
            {data.education.map((edu, i) => (
              <div key={i} className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{edu.degree}</h3>
                  <p className="text-xs text-slate-600">{edu.institution}</p>
                </div>
                <span className="text-[10px] text-slate-500">{edu.year}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {data.skills.length > 0 && (
        <div className="mb-4">
          <h2 className={`text-sm font-bold uppercase tracking-wider mb-2 bg-gradient-to-r ${template.accent} bg-clip-text text-transparent`}>
            Skills
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {data.skills.map((skill, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {data.certifications.length > 0 && (
        <div className="mb-4">
          <h2 className={`text-sm font-bold uppercase tracking-wider mb-2 bg-gradient-to-r ${template.accent} bg-clip-text text-transparent`}>
            Certifications
          </h2>
          <ul className="space-y-1">
            {data.certifications.map((cert, i) => (
              <li key={i} className="text-xs text-slate-700 flex items-center gap-1.5">
                <FiAward className="w-3 h-3 text-slate-400" /> {cert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Languages */}
      {data.languages.length > 0 && (
        <div>
          <h2 className={`text-sm font-bold uppercase tracking-wider mb-2 bg-gradient-to-r ${template.accent} bg-clip-text text-transparent`}>
            Languages
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.languages.map((lang, i) => (
              <span key={i} className="text-xs text-slate-700">{lang}{i < data.languages.length - 1 && ','}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper: Generate resume text ───
function generateResumeText(data: ResumeData, _templateId: string): string {
  let text = `${data.name}\n`;
  text += `${[data.email, data.phone, data.location, data.website].filter(Boolean).join(' | ')}\n\n`;

  if (data.summary) {
    text += `PROFESSIONAL SUMMARY\n${data.summary}\n\n`;
  }

  if (data.experience.length > 0) {
    text += `EXPERIENCE\n`;
    data.experience.forEach(exp => {
      text += `\n${exp.title}\n${exp.company}${exp.location ? `, ${exp.location}` : ''}\n${exp.startDate} - ${exp.endDate}\n`;
      if (exp.description) text += `${exp.description}\n`;
    });
    text += '\n';
  }

  if (data.education.length > 0) {
    text += `EDUCATION\n`;
    data.education.forEach(edu => {
      text += `\n${edu.degree}\n${edu.institution}, ${edu.year}\n`;
    });
    text += '\n';
  }

  if (data.skills.length > 0) {
    text += `SKILLS\n${data.skills.join(', ')}\n\n`;
  }

  if (data.certifications.length > 0) {
    text += `CERTIFICATIONS\n${data.certifications.join(', ')}\n\n`;
  }

  if (data.languages.length > 0) {
    text += `LANGUAGES\n${data.languages.join(', ')}\n`;
  }

  return text;
}
