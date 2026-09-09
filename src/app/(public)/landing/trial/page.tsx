import { redirect } from 'next/navigation';

/** Legacy URL — trial signup uses the working /register form. */
export default function LandingTrialRedirectPage() {
  redirect('/register');
}
