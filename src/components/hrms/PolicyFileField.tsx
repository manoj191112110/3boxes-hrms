'use client';

/**
 * Policy Document Upload — shared field + helpers for all Policy forms
 * (Leave Policy, Attendance Policy, Company Policies, Travel Policy).
 *
 * Lets the admin attach the FULL policy document (PDF/DOCX) to a policy
 * record instead of pasting lengthy policy text into the description box.
 *
 * Storage follows the platform-wide pattern: files up to 3MB are stored as
 * base64 data URLs (same as employee photos / employee documents). Larger
 * files cannot be accepted because serverless request bodies are capped
 * (~4.5MB on Vercel).
 */
import { useRef } from 'react';
import { FiFile, FiDownload, FiX, FiUpload } from 'react-icons/fi';
import toast from 'react-hot-toast';

export const POLICY_FILE_ACCEPT = '.pdf,.doc,.docx';
export const MAX_POLICY_FILE_MB = 3;
const MAX_POLICY_FILE_BYTES = MAX_POLICY_FILE_MB * 1024 * 1024;

export interface PolicyFileData {
  fileUrl: string;
  fileName: string;
  fileSize: string; // kept as string — policy forms use Record<string,string>
  fileMimeType: string;
}

export function formatPolicyFileSize(bytes?: number | string | null): string {
  const n = Number(bytes || 0);
  if (!n || isNaN(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate + read a policy document file into data-URL form fields.
 * Returns null (after showing a toast) when the file is invalid.
 */
export function readPolicyFile(file: File): Promise<PolicyFileData | null> {
  return new Promise((resolve) => {
    const lower = file.name.toLowerCase();
    const okExt = lower.endsWith('.pdf') || lower.endsWith('.doc') || lower.endsWith('.docx');
    if (!okExt) {
      toast.error('Only PDF, DOC or DOCX files are supported');
      resolve(null);
      return;
    }
    if (file.size > MAX_POLICY_FILE_BYTES) {
      toast.error(`File must be under ${MAX_POLICY_FILE_MB}MB`, { duration: 6000 });
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        fileUrl: reader.result as string,
        fileName: file.name,
        fileSize: String(file.size),
        fileMimeType: file.type || 'application/octet-stream',
      });
    };
    reader.onerror = () => {
      toast.error('Failed to read the file. Please try again.');
      resolve(null);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * The upload field rendered inside the Add/Edit policy form.
 * Self-contained: reads/writes via the page's `form` record + `updateForm`.
 */
export function PolicyFileUploadField({
  form,
  updateForm,
  inputClass,
}: {
  form: Record<string, string>;
  updateForm: (field: string, value: string) => void;
  inputClass?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasFile = Boolean(form.fileUrl);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const data = await readPolicyFile(file);
    if (!data) return;
    updateForm('fileUrl', data.fileUrl);
    updateForm('fileName', data.fileName);
    updateForm('fileSize', data.fileSize);
    updateForm('fileMimeType', data.fileMimeType);
    toast.success('Policy document attached — it will be saved with the policy');
  };

  const handleRemove = () => {
    updateForm('fileUrl', '');
    updateForm('fileName', '');
    updateForm('fileSize', '');
    updateForm('fileMimeType', '');
  };

  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <label className="block text-xs font-medium text-thb-text-secondary mb-1">
        Policy Document (PDF / DOCX) <span className="text-[10px] font-normal text-thb-text-muted">— upload the complete policy instead of typing it in the description</span>
      </label>
      <div className="flex items-center gap-2">
        <label className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed text-sm cursor-pointer truncate ${hasFile ? 'border-teal-400 bg-teal-50/50 text-teal-700' : 'border-thb-border text-thb-text-muted hover:bg-slate-50'}`}>
          {hasFile ? <FiFile className="w-4 h-4 shrink-0 text-teal-500" /> : <FiUpload className="w-4 h-4 shrink-0" />}
          <span className="truncate">
            {hasFile
              ? `${form.fileName || 'policy-document'}${form.fileSize ? ` (${formatPolicyFileSize(form.fileSize)})` : ''}`
              : `Choose file — PDF, DOC, DOCX (max ${MAX_POLICY_FILE_MB}MB)`}
          </span>
          <input ref={inputRef} type="file" accept={POLICY_FILE_ACCEPT} className="hidden" onChange={handlePick} />
        </label>
        {hasFile && (
          <button type="button" onClick={handleRemove} className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0" title="Remove document">
            <FiX className="w-4 h-4" />
          </button>
        )}
      </div>
      <p className="text-[10px] text-thb-text-muted mt-1">
        The uploaded document is available for download to all admins/HR viewing this policy. Keep the Description as a short summary.
      </p>
    </div>
  );
}

/**
 * Download/View button for a policy's attached document.
 * data: URLs use the download attribute (browsers block target=_blank for data URLs).
 */
export function PolicyFileDownloadLink({ fileUrl, fileName, className }: { fileUrl?: string | null; fileName?: string | null; className?: string }) {
  if (!fileUrl) return null;
  const isData = fileUrl.startsWith('data:');
  const name = fileName || 'policy-document';
  return (
    <a
      href={fileUrl}
      {...(isData ? { download: name } : { target: '_blank', rel: 'noopener noreferrer' })}
      className={className || 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-medium transition-colors'}
    >
      <FiDownload className="w-3.5 h-3.5" /> {isData ? 'Download' : 'Open'} Policy Document
    </a>
  );
}
