import { NextResponse } from 'next/server';

/**
 * APK Download API
 * 
 * Serves the 3Boxes HRMS Android APK file.
 * The APK is built from the Flutter project (hrms_app/) via GitHub Actions CI/CD.
 * 
 * For local development, the APK should be placed at: public/downloads/3boxes-hrms.apk
 * For production, it's served from the same location.
 */
export async function GET() {
  // Check if the APK file exists in the public directory
  // Since we can't check filesystem in edge runtime, redirect to the download page
  // which has a direct link to the APK file
  
  // Redirect to the APK download location
  // The file is served statically from /downloads/3boxes-hrms.apk
  return NextResponse.redirect('https://nexus-hrms-mu.vercel.app/downloads/3boxes-hrms.apk');
}
