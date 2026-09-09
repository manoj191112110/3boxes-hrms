'use client';

import { useState } from 'react';
import { FiSettings, FiRefreshCw, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

export default function KnowledgeSettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [saving, setSaving] = useState(false);

  // Documentation Preferences
  const [versionControl, setVersionControl] = useState(true);
  const [autoIndex, setAutoIndex] = useState(true);
  const [aiAssistedWriting, setAiAssistedWriting] = useState(false);

  // Access Control
  const [publicKnowledgeBase, setPublicKnowledgeBase] = useState(false);
  const [editPermissions, setEditPermissions] = useState(true);

  const handleRefresh = () => {
    setVersionControl(true);
    setAutoIndex(true);
    setAiAssistedWriting(false);
    setPublicKnowledgeBase(false);
    setEditPermissions(true);
    toast.success('Settings refreshed to defaults');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      toast.success('Knowledge settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50 text-green-600">
            <FiSettings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Knowledge Settings</h1>
            <p className="text-sm text-thb-text-secondary">
              Configure documentation preferences and access control for the knowledge base
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
          >
            <FiRefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {isAdmin && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiSave className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documentation Preferences */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Documentation Preferences</h2>

          {/* Version Control */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Version Control</p>
              <p className="text-xs text-thb-text-muted">
                Track document revisions and allow rollback to previous versions
              </p>
            </div>
            <button
              onClick={() => setVersionControl(!versionControl)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                versionControl ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {versionControl ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Auto-index */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Auto-index</p>
              <p className="text-xs text-thb-text-muted">
                Automatically index new documents for search and categorization
              </p>
            </div>
            <button
              onClick={() => setAutoIndex(!autoIndex)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                autoIndex ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {autoIndex ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* AI-assisted Writing */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">AI-assisted Writing</p>
              <p className="text-xs text-thb-text-muted">
                Use AI to suggest improvements and generate content drafts
              </p>
            </div>
            <button
              onClick={() => setAiAssistedWriting(!aiAssistedWriting)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                aiAssistedWriting ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {aiAssistedWriting ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* Access Control */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Access Control</h2>

          {/* Public Knowledge Base */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Public Knowledge Base</p>
              <p className="text-xs text-thb-text-muted">
                Make the knowledge base accessible to external users without login
              </p>
            </div>
            <button
              onClick={() => setPublicKnowledgeBase(!publicKnowledgeBase)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                publicKnowledgeBase ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {publicKnowledgeBase ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Edit Permissions */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Edit Permissions</p>
              <p className="text-xs text-thb-text-muted">
                Allow all internal team members to edit knowledge base articles
              </p>
            </div>
            <button
              onClick={() => setEditPermissions(!editPermissions)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                editPermissions ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {editPermissions ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
