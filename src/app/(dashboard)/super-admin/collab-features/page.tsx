'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiLock, FiPlus, FiZap, FiRefreshCw, FiCheck, FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface FeatureFlag {
  id: string;
  featureKey: string;
  isEnabled: boolean;
  maxCallDurationMin: number;
  maxFileUploadMB: number;
  maxChatAttachments: number;
}

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  native_calling: 'Enable 1:1 native WebRTC audio/video calls',
  ai_translation: 'Enable real-time AI translation of chat messages',
  file_preview: 'Enable inline preview of PDFs, DOCX, images in browser',
  webrtc_group_calls: 'Enable multi-party WebRTC group calls (heavier server load)',
  sentiment_analysis: 'Enable anonymous sentiment analysis on chat activity',
  chat_summarization: 'Enable AI-powered chat summarization for project managers',
  document_intelligence: 'Enable AI document intelligence (extract data from certificates)',
  dlp_scan: 'Enable DLP scanning on chat messages and file uploads',
  watermarking: 'Enable dynamic watermarking on sensitive documents',
  sso_jit: 'Enable Just-In-Time user provisioning via SSO',
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFlags = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/collaboration/feature-flags', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFlags(data.flags || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleToggle = async (featureKey: string, isEnabled: boolean) => {
    try {
      const res = await fetch('/api/collaboration/feature-flags', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ featureKey, isEnabled: !isEnabled }),
      });
      if (res.ok) {
        toast.success(`${featureKey} ${!isEnabled ? 'enabled' : 'disabled'}`);
        fetchFlags();
      } else {
        toast.error('Failed to update flag');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiZap className="w-6 h-6 text-amber-500" />
            Collaboration Feature Toggles
          </h1>
          <p className="text-sm text-thb-text-secondary mt-1">
            Enable/Disable Native Calling, AI Translation, and other features for this tenant to manage server load
          </p>
        </div>
        <button
          onClick={fetchFlags}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-thb-text-secondary hover:bg-slate-100 rounded-md"
        >
          <FiRefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading ? (
          <div className="col-span-2 p-8 text-center text-sm text-thb-text-muted">Loading...</div>
        ) : flags.length === 0 ? (
          <div className="col-span-2 p-8 text-center text-sm text-thb-text-muted">No feature flags configured</div>
        ) : (
          flags.map((flag) => (
            <div key={flag.id} className="thb-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-thb-text-primary">{flag.featureKey.replace(/_/g, ' ')}</h3>
                  <p className="text-xs text-thb-text-muted mt-1 leading-relaxed">
                    {FEATURE_DESCRIPTIONS[flag.featureKey] || 'Custom feature flag'}
                  </p>
                  <div className="flex items-center gap-3 mt-3 text-[10px] text-thb-text-muted">
                    <span>Max call: {flag.maxCallDurationMin}min</span>
                    <span>Max upload: {flag.maxFileUploadMB}MB</span>
                    <span>Max attachments: {flag.maxChatAttachments}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(flag.featureKey, flag.isEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    flag.isEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      flag.isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
