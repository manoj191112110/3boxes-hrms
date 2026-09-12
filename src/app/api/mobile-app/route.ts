import { NextResponse } from 'next/server';

export async function GET() {
  // Redirect to the download page
  // The actual APK file would be hosted in public/downloads/
  // For now, redirect to the download landing page
  return NextResponse.redirect('https://nexus-hrms-mu.vercel.app/downloads/');
}
