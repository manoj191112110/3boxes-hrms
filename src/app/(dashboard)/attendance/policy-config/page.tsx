'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect to the consolidated Attendance Policy & Settings page.
 * The policy-config content is now a tab inside /attendance/settings.
 */
export default function PolicyConfigRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/attendance/settings?tab=config')
  }, [router])
  return null
}
