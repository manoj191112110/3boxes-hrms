import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, localeNames } from "@/i18n/routing";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3B82F6" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "3Boxes HRMS",
    template: "%s | 3Boxes HRMS",
  },
  description: "3Boxes HRMS — SaaS-Based AI HRMS Platform by Marq AI Tech Group. People · Process · Technology. Comprehensive human resource management with AI-powered interviews, recruitment, payroll, and more.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "3Boxes HRMS",
    startupImage: [
      { url: "/icons/splash-750x1334.png", media: "(device-width: 375px) and (device-height: 667px)" },
      { url: "/icons/splash-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px)" },
      { url: "/icons/splash-1242x2688.png", media: "(device-width: 414px) and (device-height: 896px)" },
      { url: "/icons/splash-640x1136.png", media: "(device-width: 320px) and (device-height: 568px)" },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  applicationName: "3Boxes HRMS",
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png?v=3boxes-2026", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16x16.png?v=3boxes-2026", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png?v=3boxes-2026", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "3Boxes HRMS - AI-Powered HR Management",
    description: "3Boxes HRMS — People · Process · Technology. A Proud Product of Marq AI Tech Group. SaaS-Based AI HRMS Platform with AI-powered interviews, recruitment, payroll, and more.",
    siteName: "3Boxes HRMS",
    type: "website",
  },
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale?: string }>;
}>) {
  // Validate locale param (if present) against our supported locales
  const { locale } = await params;
  if (locale && !hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Get the locale + messages for the current request
  const activeLocale = locale ?? (await getLocale());
  const messages = await getMessages();
  const dir = localeNames[activeLocale as keyof typeof localeNames]?.dir ?? 'ltr';

  return (
    <html lang={activeLocale} dir={dir} className={`${inter.variable} h-full antialiased`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png?v=3boxes-2026" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png?v=3boxes-2026" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png?v=3boxes-2026" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3B82F6" />
        <meta name="msapplication-navbutton-color" content="#3B82F6" />
      </head>
      <body className="min-h-full flex flex-col">
        {/* ─── GOLDEN RULE: Nuclear localStorage cleanup (FOOLPROOF) ───
             Runs synchronously BEFORE React hydrates. This is the
             ULTIMATE backstop — it checks window.location.hostname
             DIRECTLY (no env vars, no site-mode detection) and removes
             any persisted company context data that references hidden
             tenants ('3boxeshrms', '3boxes-hrms-demo').
             This prevents even a single frame of "Marq AI Tech Pvt Ltd"
             appearing in the company switcher from stale localStorage. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try{
                // ─── CRITICAL: Per-tab session token storage ───
                // Migrate tb_token from localStorage (shared across tabs)
                // to sessionStorage (per-tab). This prevents session/role
                // bleed when two tabs are logged in as different users.
                var TOKEN_KEY='tb_token';
                var ssTok=sessionStorage.getItem(TOKEN_KEY);
                var lsTok=localStorage.getItem(TOKEN_KEY);
                if(!ssTok && lsTok){
                  sessionStorage.setItem(TOKEN_KEY, lsTok);
                  localStorage.removeItem(TOKEN_KEY);
                }
                // Install localStorage shim: redirect tb_token reads/writes
                // to sessionStorage so all 200+ existing call sites work.
                var origGet=localStorage.getItem.bind(localStorage);
                var origSet=localStorage.setItem.bind(localStorage);
                var origRm=localStorage.removeItem.bind(localStorage);
                localStorage.getItem=function(k){
                  if(k===TOKEN_KEY)return sessionStorage.getItem(TOKEN_KEY);
                  return origGet(k);
                };
                localStorage.setItem=function(k,v){
                  if(k===TOKEN_KEY){sessionStorage.setItem(TOKEN_KEY,v);return;}
                  origSet(k,v);
                };
                localStorage.removeItem=function(k){
                  if(k===TOKEN_KEY){sessionStorage.removeItem(TOKEN_KEY);return;}
                  origRm(k);
                };

                var h=window.location.hostname.toLowerCase();
                // FOOLPROOF: Direct hostname check — no env vars, no detection
                var isLive=h==='3boxeshrms.com'||h.endsWith('.3boxeshrms.com')||h==='www.3boxeshrms.com';
                var isDemo=h.endsWith('.vercel.app')&&!h.includes('3boxeshrms.com');
                // Nuke the OLD v1 key completely — it contains stale hidden tenant data
                localStorage.removeItem('tb_company_ctx');
                // Also scrub the v2 key if it has hidden tenant data
                var keys=['tb_company_ctx_v2'];
                for(var i=0;i<keys.length;i++){
                  var raw=localStorage.getItem(keys[i]);
                  if(!raw)continue;
                  var d=JSON.parse(raw);
                  if(!d||!d.state)continue;
                  var s=d.state;
                  var changed=false;
                  // LIVE site: ALWAYS hide '3boxes-hrms-demo' and '3boxeshrms'
                  // This is HARDCODED — no env vars, no detection, no way to bypass
                  if(isLive){
                    var hidden=['3boxes-hrms-demo','3boxeshrms'];
                    if(s.tenant&&s.tenant.slug&&hidden.indexOf(s.tenant.slug)!==-1){
                      s.tenant=null;s.tenantId=null;s.selectedTenantId=null;s.ownCompany=null;s.ownCompanyId=null;changed=true;
                    }
                    if(s.availableTenants&&Array.isArray(s.availableTenants)){
                      var before=s.availableTenants.length;
                      s.availableTenants=s.availableTenants.filter(function(t){return hidden.indexOf(t.slug)===-1;});
                      if(s.availableTenants.length!==before)changed=true;
                    }
                    // ALSO: Check by tenant NAME as a nuclear backstop
                    // If tenant.name contains "Marq AI Tech Pvt Ltd", remove it
                    if(s.tenant&&s.tenant.name&&s.tenant.name.indexOf('Marq AI Tech Pvt Ltd')!==-1){
                      s.tenant=null;s.tenantId=null;s.selectedTenantId=null;s.ownCompany=null;s.ownCompanyId=null;changed=true;
                    }
                    if(s.availableTenants&&Array.isArray(s.availableTenants)){
                      var before2=s.availableTenants.length;
                      s.availableTenants=s.availableTenants.filter(function(t){return !t.name||t.name.indexOf('Marq AI Tech Pvt Ltd')===-1;});
                      if(s.availableTenants.length!==before2)changed=true;
                    }
                  }
                  if(isDemo){
                    if(s.tenant&&s.tenant.slug&&s.tenant.slug==='marqaitechgroup'){
                      s.tenant=null;s.tenantId=null;s.selectedTenantId=null;changed=true;
                    }
                  }
                  if(changed){
                    localStorage.setItem(keys[i],JSON.stringify(d));
                    console.warn('[GOLDEN RULE] Scrubbed hidden tenant from localStorage before React hydrate');
                  }
                }
              }catch(e){}
            })();`,
          }}
        />
        <NextIntlClientProvider locale={activeLocale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('3Boxes SW registered:', registration.scope);
                    // Check for updates on load
                    registration.update();
                  }).catch(function(error) {
                    console.log('3Boxes SW registration failed:', error);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
