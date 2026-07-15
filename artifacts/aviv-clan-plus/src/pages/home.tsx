import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Zap, Bell, Users, ChevronRight } from 'lucide-react';
import logoUrl from '@/assets/logo.png';
import { useGetMe } from '@workspace/api-client-react';
import { SiteFooter } from '@/components/site-footer';

export default function Home() {
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col relative overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded"
      >
        Skip to content
      </a>

      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none opacity-20 z-0" style={{
        backgroundImage: 'linear-gradient(hsl(var(--primary)/0.2) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.2) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        backgroundPosition: 'center center'
      }} />

      {/* Header */}
      <header className="px-6 py-6 flex items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="AVIV Clan+ logo" className="h-9 w-9 object-contain" />
          <span className="font-display font-bold text-xl tracking-[0.2em]">AVIV<span className="text-primary">+</span></span>
        </div>
        <div>
          {!isLoading && (
            user ? (
              <Button asChild variant="outline" className="clip-edges">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <Button asChild className="clip-edges group">
                <a href="/api/auth/discord">
                  Sign In
                  <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </Button>
            )
          )}
        </div>
      </header>

      {/* Hero */}
      <main id="main-content" className="flex-1 flex flex-col relative z-10">
        <section className="px-6 py-24 md:py-32 flex flex-col items-center text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary/30 bg-primary/10 text-primary mb-8">
            <Bell className="h-4 w-4" />
            <span className="font-mono text-xs font-bold tracking-widest uppercase">Rust Console Edition</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-bold tracking-wide sm:tracking-widest uppercase leading-tight mb-6 break-words">
            Raid Alerts <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-500">Perfected</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground font-mono max-w-2xl mb-12 leading-relaxed">
            Keep your whole clan in the loop when a raid hits. Connect your KAOS+ sensors
            and everyone gets notified instantly — on Discord and their phone.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            {!isLoading && (
              user ? (
                <Button asChild size="lg" className="clip-edges text-lg">
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="clip-edges text-lg group">
                  <a href="/api/auth/discord">
                    Sign In with Discord
                    <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </a>
                </Button>
              )
            )}
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-24 bg-card/50 border-y border-border/50">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">

            <div className="p-8 border border-border bg-background relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap className="h-24 w-24 text-primary" />
              </div>
              <Zap className="h-10 w-10 text-primary mb-6" />
              <h3 className="font-display text-xl mb-3 tracking-widest">Instant Alerts</h3>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                Your clan gets notified the moment a sensor trips — no delays, no missed raids.
              </p>
            </div>

            <div className="p-8 border border-border bg-background relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Bell className="h-24 w-24 text-primary" />
              </div>
              <Bell className="h-10 w-10 text-primary mb-6" />
              <h3 className="font-display text-xl mb-3 tracking-widest">KAOS+ Ready</h3>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                Works directly with your existing KAOS+ setup. Add your key, pick a Discord channel, and you're done.
              </p>
            </div>

            <div className="p-8 border border-border bg-background relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users className="h-24 w-24 text-primary" />
              </div>
              <Users className="h-10 w-10 text-primary mb-6" />
              <h3 className="font-display text-xl mb-3 tracking-widest">Clan-Wide</h3>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                Ping a specific Discord role so only the right people get woken up. One setup covers your whole clan.
              </p>
            </div>

          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
