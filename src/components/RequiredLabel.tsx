'use client';

import { ReactNode } from 'react';

/**
 * RequiredLabel — A reusable label component that displays a red asterisk (*)
 * next to the field label to indicate it's a mandatory field.
 *
 * Usage:
 *   <RequiredLabel>First Name</RequiredLabel>
 *   <RequiredLabel label="Email Address" />
 *
 * Renders:
 *   <label>First Name <span className="text-red-500">*</span></label>
 *
 * The asterisk is red and bold so users can easily identify required fields.
 */
interface RequiredLabelProps {
  children?: ReactNode;
  label?: string;
  htmlFor?: string;
  className?: string;
}

export function RequiredLabel({ children, label, htmlFor, className = '' }: RequiredLabelProps) {
  const text = label || children;
  return (
    <label htmlFor={htmlFor} className={`block text-sm font-medium text-thb-text-secondary mb-1 ${className}`}>
      {text} <span className="text-red-500 font-bold">*</span>
    </label>
  );
}

/**
 * RequiredAsterisk — Just the red asterisk, for inline use after an existing label.
 *
 * Usage:
 *   <label>Email <RequiredAsterisk /></label>
 *   <span>Phone Number <RequiredAsterisk /></span>
 */
export function RequiredAsterisk() {
  return <span className="text-red-500 font-bold ml-0.5">*</span>;
}

export default RequiredLabel;
