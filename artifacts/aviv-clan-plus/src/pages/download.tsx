import { Link } from 'wouter';
import { Download as DownloadIcon, Smartphone, Shield, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoUrl from '@/assets/logo.png';
import { SiteFooter } from '@/components/site-footer';

const APK_URL = 'https://expo.dev/artifacts/eas/f0_E0JBqek625Pm8GVWqJ-1duJsmpoDY3J_x_szv-DU.apk';

const steps = [
  {
    number: '01',
    title: 'Allow Unknown Sources',
    description:
      'On your Android device, go to Settings → Apps → Special app access → Install unknown apps. Enable it for your browser.',
  },
  {
    number: '02',
    title: 'Download the APK',
    description:
      'Tap the button above on your Android phone. Your browser will download the APK file directly.',
  },
  {
    number: '03',
    title: 'Install & Open',
    description:
      'Open the downloaded file from your notifications or Downloads folder and tap Install. Open the app and sign in with Discord.',
  },
  {
    number: '04',
    title: 'Enable Alerts',
    description:
      'Tap "Enable Alerts" in the app and allow notifications. You\'ll receive a push alert every time a sensor trips.',
  },
];

export default function Download() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col relative overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded"
      >
        Skip to content
      </a>

      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20 z-0"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--primary)/0.2) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.2) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          backgroundPosition: 'center center',
        }}
      />

      {/* Header */}
      <header className="px-6 py-6 flex items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <img src={logoUrl} alt="AVIV Clan+ logo" className="h-9 w-9 object-contain" />
          <span className="font-display font-bold text-xl tracking-[0.2em]">
            AVIV<span className="text-primary">+</span>
          </span>
        </Link>
        <Button asChild variant="outline" className="clip-edges">
          <Link href="/">
            <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
            Back
          </Link>
        </Button>
      </header>

      <main id="main-content" className="flex-1 flex flex-col relative z-10">
        {/* Hero */}
        <section className="px-6 py-20 md:py-28 flex flex-col items-center text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary/30 bg-primary/10 text-primary mb-8">
            <Smartphone className="h-4 w-4" />
            <span className="font-mono text-xs font-bold tracking-widest uppercase">Android App</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-bold tracking-widest uppercase leading-tight mb-6">
            AVIV Raid<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-500">
              Alerts App
            </span>
          </h1>

          <p className="text-lg text-muted-foreground font-mono max-w-xl mb-10 leading-relaxed">
            Get push notifications directly on your phone the moment a raid sensor trips.
            Free. No Play Store required.
          </p>

          <a href={APK_URL} download>
            <Button size="lg" className="clip-edges text-lg group gap-3">
              <DownloadIcon className="h-5 w-5 group-hover:translate-y-0.5 transition-transform" />
              Download APK
            </Button>
          </a>

          <p className="mt-4 text-xs text-muted-foreground font-mono">
            Android only · Requires sideloading · v1.0
          </p>
        </section>

        {/* Warning */}
        <section className="px-6 pb-8 flex justify-center">
          <div className="max-w-2xl w-full border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="font-mono text-sm text-amber-200/80 leading-relaxed">
              This app is distributed outside the Play Store. You'll need to enable{' '}
              <strong className="text-amber-400">Install unknown apps</strong> in Android settings
              before installing. This is normal for clan-private apps.
            </p>
          </div>
        </section>

        {/* Steps */}
        <section className="px-6 py-20 bg-card/50 border-y border-border/50">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl tracking-widest uppercase text-center mb-12">
              How to Install
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="p-6 border border-border bg-background relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity font-display text-7xl font-bold leading-none select-none">
                    {step.number}
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-mono text-xs text-primary tracking-widest border border-primary/30 bg-primary/10 px-2 py-0.5">
                      {step.number}
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-primary/40" />
                  </div>
                  <h3 className="font-display text-lg tracking-widest mb-2">{step.title}</h3>
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Requirements */}
        <section className="px-6 py-16 flex flex-col items-center gap-6">
          <h2 className="font-display text-xl tracking-widest uppercase text-muted-foreground">
            Requirements
          </h2>
          <div className="flex flex-wrap justify-center gap-4 max-w-2xl">
            {[
              'Android 10+',
              'Discord account',
              'TCK clan membership',
              '~50 MB free space',
            ].map((req) => (
              <div
                key={req}
                className="flex items-center gap-2 px-4 py-2 border border-border bg-card font-mono text-sm"
              >
                <Shield className="h-3.5 w-3.5 text-primary" />
                {req}
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
