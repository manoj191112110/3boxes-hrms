'use client';

import { useState, useRef, useCallback } from 'react';
import {
  FiUpload,
  FiDownload,
  FiFileText,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiUsers,
  FiBriefcase,
  FiUserCheck,
  FiGlobe,
  FiCalendar,
  FiDollarSign,
  FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */
interface BulkImportTabProps {
  module?: string;
}

interface ImportError {
  row: number;
  message: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: ImportError[];
  total: number;
  module: string;
}

/* ──────────────────────────────────────────────
   Module Definitions
   ────────────────────────────────────────────── */
const modules = [
  { key: 'employees', label: 'Employees', icon: <FiUsers />, description: 'Import employee records with personal, employment, and bank details' },
  { key: 'departments', label: 'Departments', icon: <FiBriefcase />, description: 'Import department codes and names' },
  { key: 'designations', label: 'Designations', icon: <FiUserCheck />, description: 'Import job titles, grades, and salary bands' },
  { key: 'branches', label: 'Branches', icon: <FiGlobe />, description: 'Import office locations and addresses' },
  { key: 'leave-types', label: 'Leave Types', icon: <FiCalendar />, description: 'Import leave type definitions and default allocations' },
  { key: 'salary-structures', label: 'Salary Structures', icon: <FiDollarSign />, description: 'Import salary structure templates' },
];

/* ──────────────────────────────────────────────
   Auth Helper
   ────────────────────────────────────────────── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ──────────────────────────────────────────────
   BulkImportTab Component
   ────────────────────────────────────────────── */
export default function BulkImportTab({ module: initialModule = 'employees' }: BulkImportTabProps) {
  const [selectedModule, setSelectedModule] = useState(initialModule);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentModule = modules.find(m => m.key === selectedModule) || modules[0];

  /* ── File Validation ── */
  const validateAndSetFile = (f: File) => {
    const validExtensions = ['.xlsx', '.xls'];
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext)) {
      toast.error('Invalid file type. Please upload .xlsx or .xls files only.');
      return;
    }
    setFile(f);
    setImportResult(null);
  };

  /* ── Drag & Drop Handlers ── */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      validateAndSetFile(selected);
    }
  };

  const removeFile = () => {
    setFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /* ── Download Template ── */
  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/import/template?module=${selectedModule}`, { headers });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to download template');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedModule}-import-template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Template downloaded successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to download template';
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  };

  /* ── Upload & Import ── */
  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }
    setUploading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('module', selectedModule);

      const headers = getAuthHeaders();
      const response = await fetch('/api/import/bulk', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setImportResult(data);

      if (data.failed === 0) {
        toast.success(`Successfully imported ${data.success} ${currentModule.label.toLowerCase()} records`);
      } else if (data.success > 0) {
        toast(`Partially imported: ${data.success} succeeded, ${data.failed} failed`, { icon: '⚠️' });
      } else {
        toast.error(`Import failed: all ${data.failed} records had errors`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  /* ── Render ── */
  return (
    <div className="space-y-4">
      {/* Module Selector */}
      <div className="thb-card">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-500">
              <FiFileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-thb-text-primary">Select Module</h3>
              <p className="text-xs text-thb-text-muted">Choose which module data to import</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {modules.map(mod => (
              <button
                key={mod.key}
                onClick={() => {
                  setSelectedModule(mod.key);
                  setFile(null);
                  setImportResult(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-center ${
                  selectedModule === mod.key
                    ? 'border-green-500 bg-green-50/50 text-green-600 shadow-sm'
                    : 'border-thb-border/50 hover:border-thb-border hover:bg-slate-50 text-thb-text-muted'
                }`}
              >
                <span className={`text-lg ${selectedModule === mod.key ? 'text-green-500' : 'text-slate-400'}`}>
                  {mod.icon}
                </span>
                <span className="text-xs font-medium leading-tight">{mod.label}</span>
              </button>
            ))}
          </div>

          {currentModule && (
            <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-thb-border/30">
              <p className="text-xs text-thb-text-muted">{currentModule.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* File Upload Area */}
      <div className="thb-card">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
              <FiUpload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-thb-text-primary">Upload File</h3>
              <p className="text-xs text-thb-text-muted">Drag & drop or click to select an Excel file</p>
            </div>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-green-500 bg-green-50/30'
                : file
                  ? 'border-emerald-400 bg-emerald-50/30'
                  : 'border-thb-border/50 hover:border-green-300 hover:bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />

            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-500">
                  <FiFileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-thb-text-primary">{file.name}</p>
                  <p className="text-xs text-thb-text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile();
                  }}
                  className="mt-1 p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-500 transition-colors"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                  <FiUpload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-thb-text-primary">
                    {isDragging ? 'Drop your file here' : 'Drop your Excel file here, or click to browse'}
                  </p>
                  <p className="text-xs text-thb-text-muted mt-1">Supports .xlsx and .xls files</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
            <button
              onClick={handleDownloadTemplate}
              disabled={downloading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-thb-border/50 text-sm font-medium text-thb-text-primary hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <div className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full" />
              ) : (
                <FiDownload className="w-4 h-4" />
              )}
              {downloading ? 'Downloading...' : 'Download Template'}
            </button>

            <button
              onClick={handleUpload}
              disabled={uploading || !file}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 shadow-sm shadow-green-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <FiUpload className="w-4 h-4" />
              )}
              {uploading ? 'Importing...' : 'Upload & Import'}
            </button>
          </div>
        </div>
      </div>

      {/* Import Results */}
      {importResult && (
        <div className="thb-card">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                importResult.failed === 0
                  ? 'bg-emerald-50 text-emerald-500'
                  : importResult.success > 0
                    ? 'bg-amber-50 text-amber-500'
                    : 'bg-red-50 text-red-500'
              }`}>
                {importResult.failed === 0 ? (
                  <FiCheckCircle className="w-5 h-5" />
                ) : importResult.success > 0 ? (
                  <FiAlertCircle className="w-5 h-5" />
                ) : (
                  <FiXCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-thb-text-primary">Import Results</h3>
                <p className="text-xs text-thb-text-muted">
                  {importResult.total} total records processed for {modules.find(m => m.key === importResult.module)?.label || importResult.module}
                </p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-slate-50 border border-thb-border/30 text-center">
                <p className="text-lg font-bold text-thb-text-primary">{importResult.total}</p>
                <p className="text-xs text-thb-text-muted">Total</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200/50 text-center">
                <p className="text-lg font-bold text-emerald-600">{importResult.success}</p>
                <p className="text-xs text-emerald-600/70">Succeeded</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200/50 text-center">
                <p className="text-lg font-bold text-red-600">{importResult.failed}</p>
                <p className="text-xs text-red-600/70">Failed</p>
              </div>
            </div>

            {/* Error List */}
            {importResult.errors && importResult.errors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FiXCircle className="w-4 h-4 text-red-500" />
                  <h4 className="text-xs font-semibold text-thb-text-primary">Error Details</h4>
                  <span className="thb-badge text-red-600 bg-red-50 border-red-200/50">{importResult.errors.length} error{importResult.errors.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {importResult.errors.map((err, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50/50 border border-red-100/50 text-xs">
                      <FiAlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-medium text-red-600">Row {err.row}:</span>{' '}
                        <span className="text-red-500">{err.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Success message when all passed */}
            {importResult.failed === 0 && importResult.success > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200/50">
                <FiCheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-xs text-emerald-600 font-medium">
                  All {importResult.success} records imported successfully!
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
