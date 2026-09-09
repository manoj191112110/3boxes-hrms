'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect to the consolidated Attendance Policy & Settings page.
 * The attendance-policy content is now a tab inside /attendance/settings.
 */
export default function AttendancePolicyRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/attendance/settings?tab=documents')
  }, [router])
  return null
}
