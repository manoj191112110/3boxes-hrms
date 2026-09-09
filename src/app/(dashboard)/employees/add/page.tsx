'use client';

import { Suspense } from 'react';
import { EmployeesPageContent } from '../page';

/**
 * /employees/add — Dedicated Add Employee page
 * Renders ONLY the employee form (Personal, Address, Employment, Bank, etc.)
 * without the dashboard stats, employee list, or bulk import tabs.
 */
export default function AddEmployeePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4" />
          <p className="text-sm text-thb-text-secondary">Loading Add Employee Form...</p>
        </div>
      </div>
    }>
      <EmployeesPageContent formOnly={true} />
    </Suspense>
  );
}
