import { Link } from 'wouter';
import { ShieldAlert, Mail } from 'lucide-react';

export const SUPPORT_EMAIL = 'creatorisnear@gmail.com';

export function SiteFooter() {
  return (
    <footer className="px-6 py-10 border-t border-border bg-background text-center flex flex-col items-center gap-4 relative z-10">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <span className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
          AVIV Clan Network
        </span>
      </div>

      <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-widest">
        <Link href="/terms" className="text-muted-foreground hover:text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-sm">
          Terms of Service
        </Link>
        <Link href="/privacy" className="text-muted-foreground hover:text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-sm">
          Privacy Policy
        </Link>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-muted-foreground hover:text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded-sm inline-flex items-center gap-1.5"
        >
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          Support
        </a>
      </nav>

      <p className="font-mono text-[10px] text-muted-foreground/70 max-w-md">
        AVIV Clan+ is an independent tool and is not affiliated with, endorsed by, or
        sponsored by Facepunch Studios, Rust, KAOS+, or Discord Inc.
      </p>
    </footer>
  );
}
