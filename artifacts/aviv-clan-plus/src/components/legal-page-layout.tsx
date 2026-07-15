import { Link } from 'wouter';
import { ShieldAlert, ChevronLeft } from 'lucide-react';
import { SiteFooter } from '@/components/site-footer';

export function LegalPageLayout({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <a
        href="#legal-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded"
      >
        Skip to content
      </a>

      <header className="px-6 py-6 flex items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-sm">
          <ShieldAlert className="h-8 w-8 text-primary" aria-hidden="true" />
          <span className="font-display font-bold text-xl tracking-[0.2em]">
            AVIV<span className="text-primary">+</span>
          </span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>
      </header>

      <main id="legal-content" className="flex-1 px-6 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-widest uppercase mb-2">
            {title}
          </h1>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-10">
            Effective date: {effectiveDate}
          </p>
          <div className="prose prose-invert prose-sm md:prose-base max-w-none font-sans leading-relaxed space-y-6 [&_h2]:font-display [&_h2]:tracking-wide [&_h2]:uppercase [&_h2]:text-xl [&_h2]:mt-10 [&_h2]:mb-3 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">
            {children}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
