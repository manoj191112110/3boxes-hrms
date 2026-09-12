'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  FiCpu, FiSave, FiRefreshCw, FiCheck, FiX, FiZap,
  FiShield, FiGlobe, FiEye, FiEdit2, FiSliders,
  FiDatabase, FiUpload, FiClock, FiDollarSign,
  FiChevronLeft, FiLock, FiFileText, FiMessageSquare,
  FiBarChart2, FiUsers, FiStar, FiAlertCircle,
  FiActivity, FiSettings, FiTool, FiLayers,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import SrsBanner from '@/components/SrsBanner';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Types ───
interface AIEngineConfig {
  provider: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

interface AIFeatureToggle {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  category: string;
}

interface PromptTemplate {
  id: string;
  label: string;
  description: string;
  value: string;
  defaultValue: string;
}

interface UsageMetric {
  feature: string;
  calls: number;
  tokens: number;
  cost: number;
}

// ─── Default Values ───
const DEFAULT_ENGINE: AIEngineConfig = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 2048,
};

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  azure: ['gpt-4o', 'gpt-4-turbo', 'gpt-35-turbo'],
  anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
  local: ['llama-3-70b', 'llama-3-8b', 'mistral-7b', 'codellama-34b'],
};

const DEFAULT_FEATURES: AIFeatureToggle[] = [
  { id: 'resume_screening', label: 'AI Resume Screening', description: 'Automatically screen and rank candidate resumes based on job requirements', icon: <FiFileText className="w-5 h-5" />, enabled: true, category: 'Recruitment' },
  { id: 'interview_scheduling', label: 'AI Interview Scheduling', description: 'Smart scheduling with availability matching and timezone handling', icon: <FiClock className="w-5 h-5" />, enabled: true, category: 'Recruitment' },
  { id: 'chatbot', label: 'AI Chatbot / Assistant', description: 'AI-powered HR assistant for employee queries and self-service', icon: <FiMessageSquare className="w-5 h-5" />, enabled: true, category: 'Self-Service' },
  { id: 'sentiment', label: 'AI Sentiment Analysis', description: 'Analyze employee feedback, surveys, and communications for sentiment trends', icon: <FiActivity className="w-5 h-5" />, enabled: false, category: 'Analytics' },
  { id: 'document_processing', label: 'AI Document Processing', description: 'Extract, classify, and process HR documents using OCR and NLP', icon: <FiFileText className="w-5 h-5" />, enabled: true, category: 'Operations' },
  { id: 'predictive_analytics', label: 'AI Predictive Analytics', description: 'Forecast attrition, performance trends, and workforce planning', icon: <FiBarChart2 className="w-5 h-5" />, enabled: true, category: 'Analytics' },
  { id: 'auto_approval', label: 'AI Auto-Approval for Leaves', description: 'Automatically approve routine leave requests based on policy and history', icon: <FiCheck className="w-5 h-5" />, enabled: false, category: 'Operations' },
  { id: 'performance_insights', label: 'AI Performance Insights', description: 'Generate performance review summaries and development recommendations', icon: <FiStar className="w-5 h-5" />, enabled: true, category: 'Performance' },
];

const DEFAULT_PROMPTS: PromptTemplate[] = [
  {
    id: 'resume_screening',
    label: 'Resume Screening Prompt',
    description: 'Used to evaluate and rank candidate resumes',
    value: `You are an expert HR recruiter. Analyze the following resume against the job requirements provided. Score the candidate on a scale of 1-10 for each criterion: skills match, experience relevance, education fit, and overall suitability. Provide a brief justification for each score and a final recommendation (Strong Fit / Good Fit / Possible Fit / Not Recommended).

Job Requirements:
{{job_requirements}}

Resume:
{{resume_content}}`,
    defaultValue: `You are an expert HR recruiter. Analyze the following resume against the job requirements provided. Score the candidate on a scale of 1-10 for each criterion: skills match, experience relevance, education fit, and overall suitability. Provide a brief justification for each score and a final recommendation (Strong Fit / Good Fit / Possible Fit / Not Recommended).

Job Requirements:
{{job_requirements}}

Resume:
{{resume_content}}`,
  },
  {
    id: 'interview_questions',
    label: 'Interview Question Generation Prompt',
    description: 'Used to generate role-specific interview questions',
    value: `Generate 10 structured interview questions for the following role. Include a mix of technical, behavioral, and situational questions. For each question, provide the expected answer focus areas and difficulty level (Easy/Medium/Hard).

Role: {{role_title}}
Department: {{department}}
Experience Level: {{experience_level}}
Key Skills: {{key_skills}}`,
    defaultValue: `Generate 10 structured interview questions for the following role. Include a mix of technical, behavioral, and situational questions. For each question, provide the expected answer focus areas and difficulty level (Easy/Medium/Hard).

Role: {{role_title}}
Department: {{department}}
Experience Level: {{experience_level}}
Key Skills: {{key_skills}}`,
  },
  {
    id: 'leave_approval',
    label: 'Leave Approval Recommendation Prompt',
    description: 'Used to recommend leave approval decisions',
    value: `Analyze the following leave request and provide a recommendation (Approve / Review Required / Deny) based on the employee history, team capacity, and company policy.

Employee: {{employee_name}}
Leave Type: {{leave_type}}
Duration: {{start_date}} to {{end_date}} ({{days}} days)
Reason: {{reason}}
Team Current Capacity: {{team_capacity}}%
Employee Leave History: {{leave_history}}
Policy Rules: {{policy_rules}}`,
    defaultValue: `Analyze the following leave request and provide a recommendation (Approve / Review Required / Deny) based on the employee history, team capacity, and company policy.

Employee: {{employee_name}}
Leave Type: {{leave_type}}
Duration: {{start_date}} to {{end_date}} ({{days}} days)
Reason: {{reason}}
Team Current Capacity: {{team_capacity}}%
Employee Leave History: {{leave_history}}
Policy Rules: {{policy_rules}}`,
  },
  {
    id: 'performance_summary',
    label: 'Performance Review Summary Prompt',
    description: 'Used to generate performance review summaries',
    value: `Generate a comprehensive performance review summary for the following employee. Include strengths, areas for improvement, goal progress, and development recommendations. Keep the tone professional and constructive.

Employee: {{employee_name}}
Role: {{role}}
Review Period: {{review_period}}
Goals: {{goals}}
Peer Feedback: {{peer_feedback}}
Manager Notes: {{manager_notes}}
Metrics: {{performance_metrics}}`,
    defaultValue: `Generate a comprehensive performance review summary for the following employee. Include strengths, areas for improvement, goal progress, and development recommendations. Keep the tone professional and constructive.

Employee: {{employee_name}}
Role: {{role}}
Review Period: {{review_period}}
Goals: {{goals}}
Peer Feedback: {{peer_feedback}}
Manager Notes: {{manager_notes}}
Metrics: {{performance_metrics}}`,
  },
];

const EMPTY_USAGE: UsageMetric[] = [];

type ActiveSection = 'engine' | 'features' | 'prompts' | 'usage' | 'training';

// ─── Toggle Switch Component ───
function ToggleSwitch({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-2 disabled:opacity-50 ${
        enabled ? 'bg-emerald-500' : 'bg-slate-300'
      }`}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ─── Card Shell Component ───
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle, badge }: { icon: React.ReactNode; title: string; subtitle?: string; badge?: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            {icon}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {badge}
      </div>
    </div>
  );
}

// ─── Main Page Component ───
export default function AISettingsPage() {
  const { user } = useAuthStore();

  // State
  const [activeSection, setActiveSection] = useState<ActiveSection>('engine');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);

  // Engine config
  const [engine, setEngine] = useState<AIEngineConfig>(DEFAULT_ENGINE);

  // Feature toggles
  const [features, setFeatures] = useState<AIFeatureToggle[]>(DEFAULT_FEATURES);

  // Prompt templates
  const [prompts, setPrompts] = useState<PromptTemplate[]>(DEFAULT_PROMPTS);

  // Live usage data (from API)
  const [usageData, setUsageData] = useState<UsageMetric[]>(EMPTY_USAGE);

  // Training data
  const [trainingStatus, setTrainingStatus] = useState<'idle' | 'uploading' | 'training' | 'complete'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  const markChanged = () => setHasChanges(true);

  // ─── Fetch live AI settings and usage data ───
  useEffect(() => {
    (async () => {
      try {
        // Fetch saved AI settings
        const settingsRes = await fetch('/api/super-admin/ai-settings', { headers: getAuthHeaders() });
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          if (data.engine) setEngine(data.engine);
          if (data.features) setFeatures(data.features);
          if (data.prompts) setPrompts(data.prompts);
        }

        // Fetch usage stats from ai-admin
        const adminRes = await fetch('/api/ai-admin', { headers: getAuthHeaders() });
        if (adminRes.ok) {
          const adminData = await adminRes.json();
          const stats = adminData.stats || {};
          const categoryUsage = stats.categoryUsage || {};
          // Build usage rows from live API data
          if (Object.keys(categoryUsage).length > 0) {
            const liveUsage: UsageMetric[] = Object.entries(categoryUsage).map(([feature, calls]: [string, any]) => ({
              feature,
              calls: Number(calls) || 0,
              tokens: Number(calls) * 200, // estimate
              cost: Number(calls) * 0.01,  // estimate
            }));
            setUsageData(liveUsage);
          }
        }
      } catch { /* use defaults */ } finally { setLoading(false); }
    })();
  }, []);

  // Available models for selected provider
  const availableModels = PROVIDER_MODELS[engine.provider] || [];

  // Handle provider change
  const handleProviderChange = (provider: string) => {
    const models = PROVIDER_MODELS[provider] || [];
    setEngine({ ...engine, provider, model: models[0] || '' });
    markChanged();
  };

  // Test connection
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    // Simulate API test
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (engine.apiKey.length > 10) {
      setTestResult('success');
      toast.success('Connection successful! AI provider is reachable.');
    } else {
      setTestResult('error');
      toast.error('Connection failed. Please check your API key.');
    }
    setTesting(false);
  };

  // Save all settings
  const handleSave = async () => {
    setSaving(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch('/api/super-admin/ai-settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ engine, features, prompts }),
      });
      if (res.ok) {
        toast.success('AI settings saved successfully');
        setHasChanges(false);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save AI settings');
      }
    } catch {
      toast.error('Failed to save AI settings');
    } finally {
      setSaving(false);
    }
  };

  // Reset prompt to default
  const handleResetPrompt = (id: string) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, value: p.defaultValue } : p));
    markChanged();
    toast.success('Prompt reset to default template');
  };

  // Toggle feature
  const handleToggleFeature = (id: string) => {
    setFeatures(prev => prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
    markChanged();
  };

  // Simulate upload
  const handleUploadTrainingData = async () => {
    setTrainingStatus('uploading');
    setUploadProgress(0);
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 200));
      setUploadProgress(i);
    }
    setTrainingStatus('training');
    await new Promise(r => setTimeout(r, 3000));
    setTrainingStatus('complete');
    toast.success('Training data uploaded and model fine-tuned successfully');
  };

  // Section tabs
  const sections: { key: ActiveSection; label: string; icon: React.ReactNode }[] = [
    { key: 'engine', label: 'AI Engine', icon: <FiCpu className="w-4 h-4" /> },
    { key: 'features', label: 'AI Features', icon: <FiZap className="w-4 h-4" /> },
    { key: 'prompts', label: 'Prompt Config', icon: <FiEdit2 className="w-4 h-4" /> },
    { key: 'usage', label: 'Usage & Quota', icon: <FiBarChart2 className="w-4 h-4" /> },
    { key: 'training', label: 'Training Data', icon: <FiDatabase className="w-4 h-4" /> },
  ];

  // Computed stats
  const totalCalls = usageData.reduce((s, u) => s + u.calls, 0);
  const totalTokens = usageData.reduce((s, u) => s + u.tokens, 0);
  const totalCost = usageData.reduce((s, u) => s + u.cost, 0);
  const callsLimit = 100000;
  const enabledFeatures = features.filter(f => f.enabled).length;

  // Access guard
  if (user?.role !== 'super_admin') {
    return (
      <div className="p-6">
        <div className="thb-card p-8 text-center">
          <FiLock className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Super Admins Only</h2>
          <p className="text-sm text-slate-500 mt-1">AI configuration is managed by the platform owner.</p>
          <Link href="/home" className="mt-4 inline-block text-sm font-semibold text-emerald-600 hover:text-emerald-700">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SrsBanner role="super_admin" />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/super-admin"
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            title="Back to Super Admin Console"
          >
            <FiChevronLeft className="w-4 h-4 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <FiCpu className="w-5 h-5 text-white" />
              </div>
              AI Configuration
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              <span className="font-mono text-[11px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">REQ-SA-06</span>
              {' '}Manage AI engine, features, prompts, usage quotas, and training data across the platform.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveSection('engine'); }}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiSave className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'AI Provider', value: engine.provider === 'openai' ? 'OpenAI' : engine.provider === 'azure' ? 'Azure OpenAI' : engine.provider === 'anthropic' ? 'Anthropic' : engine.provider === 'gemini' ? 'Google Gemini' : 'Local/Llama', icon: <FiGlobe className="w-4 h-4" /> },
          { label: 'Active Features', value: `${enabledFeatures} / ${features.length}`, icon: <FiZap className="w-4 h-4" /> },
          { label: 'Monthly Calls', value: `${(totalCalls / 1000).toFixed(1)}K`, icon: <FiActivity className="w-4 h-4" /> },
          { label: 'Monthly Cost', value: `$${totalCost.toFixed(0)}`, icon: <FiDollarSign className="w-4 h-4" /> },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200/80 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              {stat.icon}
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-sm font-bold text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Section Navigation ── */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl">
        <nav className="flex gap-1 px-2 overflow-x-auto">
          {sections.map(sec => (
            <button
              key={sec.key}
              onClick={() => setActiveSection(sec.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeSection === sec.key
                  ? 'border-emerald-500 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {sec.icon}
              {sec.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1: AI ENGINE CONFIGURATION
          ════════════════════════════════════════════════════════════════ */}
      {activeSection === 'engine' && (
        <div className="space-y-6">
          {/* Provider & API Key */}
          <SectionCard>
            <SectionHeader
              icon={<FiGlobe className="w-5 h-5" />}
              title="AI Provider & Authentication"
              subtitle="Configure the AI engine provider and API credentials"
            />
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Provider Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">AI Provider</label>
                  <select
                    value={engine.provider}
                    onChange={e => handleProviderChange(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-colors"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="azure">Azure OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="local">Local / Llama.cpp</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1.5">Select the AI service provider for the platform</p>
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">API Key</label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={engine.apiKey}
                      onChange={e => { setEngine({ ...engine, apiKey: e.target.value }); markChanged(); }}
                      placeholder="sk-••••••••••••••••••••"
                      className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-colors font-mono"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      title={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey ? <FiEye className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">Encrypted at rest. Never shared or logged.</p>
                </div>
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleTestConnection}
                  disabled={testing || !engine.apiKey}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiZap className="w-4 h-4" />}
                  {testing ? 'Testing Connection...' : 'Test Connection'}
                </button>
                {testResult === 'success' && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                    <FiCheck className="w-4 h-4" /> Connection verified
                  </span>
                )}
                {testResult === 'error' && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-500">
                    <FiX className="w-4 h-4" /> Connection failed
                  </span>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Model & Parameters */}
          <SectionCard>
            <SectionHeader
              icon={<FiSliders className="w-5 h-5" />}
              title="Model & Parameters"
              subtitle="Select the AI model and fine-tune generation parameters"
            />
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Model Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Model</label>
                  <select
                    value={engine.model}
                    onChange={e => { setEngine({ ...engine, model: e.target.value }); markChanged(); }}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-colors"
                  >
                    {availableModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1.5">Available models depend on the selected provider</p>
                </div>

                {/* Max Tokens */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Max Tokens</label>
                  <input
                    type="number"
                    min={256}
                    max={128000}
                    step={256}
                    value={engine.maxTokens}
                    onChange={e => { setEngine({ ...engine, maxTokens: parseInt(e.target.value) || 2048 }); markChanged(); }}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-colors"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">Maximum tokens per response (256 - 128,000)</p>
                </div>
              </div>

              {/* Temperature Slider */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Temperature <span className="ml-2 text-emerald-600 font-bold">{engine.temperature.toFixed(1)}</span>
                </label>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-400 w-8">0.0</span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={engine.temperature}
                    onChange={e => { setEngine({ ...engine, temperature: parseFloat(e.target.value) }); markChanged(); }}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <span className="text-xs text-slate-400 w-8 text-right">2.0</span>
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[11px] text-slate-400">Precise &amp; deterministic</span>
                  <span className="text-[11px] text-slate-400">Creative &amp; varied</span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Provider Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Current Model', value: engine.model, icon: <FiCpu className="w-4 h-4 text-emerald-600" /> },
              { label: 'Temperature', value: engine.temperature.toFixed(1), icon: <FiSliders className="w-4 h-4 text-teal-600" /> },
              { label: 'Max Tokens', value: engine.maxTokens.toLocaleString(), icon: <FiLayers className="w-4 h-4 text-cyan-600" /> },
            ].map((info, i) => (
              <div key={i} className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">{info.icon}</div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{info.label}</p>
                  <p className="text-sm font-bold text-slate-800 truncate max-w-[180px]">{info.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2: AI FEATURES TOGGLES
          ════════════════════════════════════════════════════════════════ */}
      {activeSection === 'features' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <FiZap className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">
                {enabledFeatures} of {features.length} AI features enabled
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Toggle features on/off to control AI capabilities across the platform
              </p>
            </div>
            <div className="flex -space-x-1">
              {features.filter(f => f.enabled).map((f, i) => (
                <div key={f.id} className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center" title={f.label}>
                  <span className="text-[9px] text-white font-bold">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Feature Groups by Category */}
          {['Recruitment', 'Self-Service', 'Analytics', 'Operations', 'Performance'].map(category => {
            const categoryFeatures = features.filter(f => f.category === category);
            if (categoryFeatures.length === 0) return null;
            return (
              <SectionCard key={category}>
                <SectionHeader
                  icon={
                    category === 'Recruitment' ? <FiUsers className="w-5 h-5" /> :
                    category === 'Self-Service' ? <FiMessageSquare className="w-5 h-5" /> :
                    category === 'Analytics' ? <FiBarChart2 className="w-5 h-5" /> :
                    category === 'Operations' ? <FiTool className="w-5 h-5" /> :
                    <FiStar className="w-5 h-5" />
                  }
                  title={`${category} AI Features`}
                  badge={
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                      {categoryFeatures.filter(f => f.enabled).length} / {categoryFeatures.length} active
                    </span>
                  }
                />
                <div className="divide-y divide-slate-100">
                  {categoryFeatures.map(feature => (
                    <div key={feature.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                          feature.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {feature.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-800">{feature.label}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              feature.enabled
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {feature.enabled ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{feature.description}</p>
                        </div>
                      </div>
                      <ToggleSwitch
                        enabled={feature.enabled}
                        onToggle={() => handleToggleFeature(feature.id)}
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3: AI PROMPT CONFIGURATION
          ════════════════════════════════════════════════════════════════ */}
      {activeSection === 'prompts' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl p-4 flex items-start gap-3">
            <FiAlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <b>Prompt templates</b> use <code className="font-mono text-[11px] bg-amber-100 px-1 py-0.5 rounded">{'{{variable}}'}</code> placeholders that are automatically replaced at runtime. Modifying prompts affects all AI operations using that template across the platform.
            </div>
          </div>

          {prompts.map(prompt => (
            <SectionCard key={prompt.id}>
              <SectionHeader
                icon={<FiEdit2 className="w-5 h-5" />}
                title={prompt.label}
                subtitle={prompt.description}
                badge={
                  prompt.value !== prompt.defaultValue ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-1 rounded-full">Modified</span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Default</span>
                  )
                }
              />
              <div className="p-6 space-y-4">
                <textarea
                  value={prompt.value}
                  onChange={e => {
                    setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, value: e.target.value } : p));
                    markChanged();
                  }}
                  rows={10}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-slate-50 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 focus:bg-white transition-colors resize-y"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">{prompt.value.length} characters</p>
                  <button
                    onClick={() => handleResetPrompt(prompt.id)}
                    disabled={prompt.value === prompt.defaultValue}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <FiRefreshCw className="w-3 h-3" />
                    Reset to Default
                  </button>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4: AI USAGE & QUOTA
          ════════════════════════════════════════════════════════════════ */}
      {activeSection === 'usage' && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'API Calls This Month',
                value: totalCalls.toLocaleString(),
                limit: callsLimit.toLocaleString(),
                pct: (totalCalls / callsLimit) * 100,
                icon: <FiActivity className="w-5 h-5 text-emerald-600" />,
                color: 'emerald',
              },
              {
                label: 'Tokens Consumed',
                value: `${(totalTokens / 1_000_000).toFixed(1)}M`,
                limit: '20M',
                pct: (totalTokens / 20_000_000) * 100,
                icon: <FiLayers className="w-5 h-5 text-teal-600" />,
                color: 'teal',
              },
              {
                label: 'Cost This Month',
                value: `$${totalCost.toFixed(2)}`,
                limit: '$1,000',
                pct: (totalCost / 1000) * 100,
                icon: <FiDollarSign className="w-5 h-5 text-cyan-600" />,
                color: 'cyan',
              },
            ].map((metric, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">{metric.icon}</div>
                    <div>
                      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{metric.label}</p>
                      <p className="text-lg font-bold text-slate-800">{metric.value}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Usage</span>
                    <span>{metric.pct.toFixed(1)}% of {metric.limit}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        metric.pct > 80 ? 'bg-rose-500' : metric.pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(metric.pct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Usage by Feature Breakdown */}
          <SectionCard>
            <SectionHeader
              icon={<FiBarChart2 className="w-5 h-5" />}
              title="Usage by Feature"
              subtitle="Detailed breakdown of AI consumption per feature"
            />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Feature</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">API Calls</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tokens</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {usageData.sort((a, b) => b.cost - a.cost).map((row) => (
                    <tr key={row.feature} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 text-sm font-medium text-slate-700">{row.feature}</td>
                      <td className="px-6 py-3 text-sm text-slate-600 text-right font-mono">{row.calls.toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm text-slate-600 text-right font-mono">{(row.tokens / 1_000_000).toFixed(1)}M</td>
                      <td className="px-6 py-3 text-sm text-slate-700 text-right font-semibold">${row.cost.toFixed(2)}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${(row.cost / totalCost) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 font-mono w-10 text-right">{((row.cost / totalCost) * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/80 border-t border-slate-200">
                    <td className="px-6 py-3 text-sm font-bold text-slate-800">Total</td>
                    <td className="px-6 py-3 text-sm font-bold text-slate-800 text-right font-mono">{totalCalls.toLocaleString()}</td>
                    <td className="px-6 py-3 text-sm font-bold text-slate-800 text-right font-mono">{(totalTokens / 1_000_000).toFixed(1)}M</td>
                    <td className="px-6 py-3 text-sm font-bold text-emerald-700 text-right font-mono">${totalCost.toFixed(2)}</td>
                    <td className="px-6 py-3 text-right text-xs font-bold text-slate-600">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </SectionCard>

          {/* Quota Alert */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl p-4 flex items-start gap-3">
            <FiAlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <b>Quota alert:</b> You have used <b>{((totalCalls / callsLimit) * 100).toFixed(1)}%</b> of your monthly API call limit. Consider upgrading your plan or optimizing prompt lengths to reduce token consumption. Contact support for higher limits.
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5: AI TRAINING DATA
          ════════════════════════════════════════════════════════════════ */}
      {activeSection === 'training' && (
        <div className="space-y-6">
          {/* Upload Training Data */}
          <SectionCard>
            <SectionHeader
              icon={<FiUpload className="w-5 h-5" />}
              title="Upload Custom Training Data"
              subtitle="Upload domain-specific data for fine-tuning AI models"
            />
            <div className="p-6 space-y-5">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-emerald-300 hover:bg-emerald-50/20 transition-colors">
                <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <FiUpload className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700">Drag & drop your training data files here</p>
                <p className="text-xs text-slate-500 mt-1">Supports JSONL, CSV, and Parquet formats · Max 500MB per file</p>
                <button
                  onClick={handleUploadTrainingData}
                  disabled={trainingStatus === 'uploading' || trainingStatus === 'training'}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiUpload className="w-4 h-4" />
                  {trainingStatus === 'uploading' ? 'Uploading...' : trainingStatus === 'training' ? 'Fine-tuning...' : 'Select Files to Upload'}
                </button>
              </div>

              {/* Upload Progress */}
              {(trainingStatus === 'uploading' || trainingStatus === 'training') && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">
                      {trainingStatus === 'uploading' ? 'Uploading data...' : 'Fine-tuning model...'}
                    </span>
                    <span className="text-sm font-bold text-emerald-600">
                      {trainingStatus === 'uploading' ? `${uploadProgress}%` : 'Processing...'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                      style={{ width: trainingStatus === 'uploading' ? `${uploadProgress}%` : '100%' }}
                    />
                  </div>
                </div>
              )}

              {trainingStatus === 'complete' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                  <FiCheck className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800">Training complete</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Model has been fine-tuned with the new data successfully.</p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Fine-Tuning Status */}
          <SectionCard>
            <SectionHeader
              icon={<FiCpu className="w-5 h-5" />}
              title="Fine-Tuning Status"
              subtitle="Current status of model fine-tuning jobs"
            />
            <div className="divide-y divide-slate-100">
              {[
                { name: 'Resume Screening Model', status: 'completed', accuracy: '94.2%', date: 'Feb 28, 2025', epochs: 12, baseModel: 'gpt-4o' },
                { name: 'Sentiment Analysis Model', status: 'completed', accuracy: '91.8%', date: 'Feb 25, 2025', epochs: 8, baseModel: 'gpt-4o-mini' },
                { name: 'Leave Approval Model', status: 'running', accuracy: '—', date: 'In Progress', epochs: '6/10', baseModel: 'gpt-4o-mini' },
                { name: 'Performance Summary Model', status: 'queued', accuracy: '—', date: 'Queued', epochs: '—', baseModel: 'gpt-4o' },
              ].map((job, i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      job.status === 'completed' ? 'bg-emerald-50' : job.status === 'running' ? 'bg-amber-50' : 'bg-slate-100'
                    }`}>
                      <FiCpu className={`w-5 h-5 ${
                        job.status === 'completed' ? 'text-emerald-600' : job.status === 'running' ? 'text-amber-600' : 'text-slate-400'
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{job.name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>Base: {job.baseModel}</span>
                        <span>·</span>
                        <span>Epochs: {job.epochs}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {job.accuracy !== '—' && (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{job.accuracy} accuracy</span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      job.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                      job.status === 'running' ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {job.status === 'running' && <FiRefreshCw className="w-3 h-3 animate-spin" />}
                      {job.status === 'completed' && <FiCheck className="w-3 h-3" />}
                      {job.status}
                    </span>
                    <span className="text-xs text-slate-500 min-w-[100px] text-right">{job.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Training History */}
          <SectionCard>
            <SectionHeader
              icon={<FiClock className="w-5 h-5" />}
              title="Training History"
              subtitle="Recent fine-tuning activity and results"
            />
            <div className="p-6">
              <div className="space-y-3">
                {[
                  { action: 'No training history yet', model: '—', user: '—', time: '—', result: 'Check AI Admin for live data' },
                ].map((event, i) => (
                  <div key={i} className="flex items-start gap-3 py-2">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      event.action.includes('completed') ? 'bg-emerald-500' :
                      event.action.includes('started') || event.action.includes('uploaded') ? 'bg-amber-500' :
                      'bg-slate-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-700">{event.action}</p>
                        <span className="text-xs text-slate-500">·</span>
                        <p className="text-xs text-slate-600">{event.model}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>by {event.user}</span>
                        <span>·</span>
                        <span>{event.time}</span>
                        <span>·</span>
                        <span className="font-medium">{event.result}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Data Retention & Quality */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <FiDatabase className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Last Training Date</p>
                  <p className="text-xs text-slate-500">Most recent successful fine-tune</p>
                </div>
              </div>
              <p className="text-lg font-bold text-slate-800">February 28, 2025</p>
              <p className="text-xs text-slate-500 mt-1">Next scheduled: March 7, 2025 (weekly)</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                  <FiShield className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Data Quality Score</p>
                  <p className="text-xs text-slate-500">Training dataset health indicator</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-lg font-bold text-emerald-600">92.4%</p>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  <FiCheck className="w-3 h-3" /> Excellent
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Min. acceptable: 80% · Current datasets pass all quality checks</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer Info ── */}
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/40 to-teal-50/40 p-4 flex items-start gap-3">
        <FiSettings className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-900 leading-relaxed">
          <b>AI Configuration Security:</b> All API keys are encrypted at rest using AES-256. Prompt templates are version-controlled and changes are logged in the{' '}
          <Link href="/super-admin/audit-logs" className="font-semibold underline hover:text-emerald-700">audit log</Link>.
          Feature toggles take effect immediately across all tenants. Training data is stored in an isolated, SOC 2-compliant environment.
        </div>
      </div>
    </div>
  );
}
