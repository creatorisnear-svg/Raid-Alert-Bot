import { useGetMe } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { Loader2, LayoutDashboard, Users, Search, Menu, LogOut, ChevronRight, Plus } from 'lucide-react';
import logoUrl from '@/assets/logo.png';
import { Button } from './ui/button';
import { useLogout } from '@workspace/api-client-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useGetMe({
    query: { retry: false }
  });
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const logout = useLogout();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="font-display tracking-widest text-sm text-muted-foreground animate-pulse">Initializing System</p>
        </div>
      </div>
    );
  }

  if (isError || !user) {
    setLocation('/');
    return null;
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLocation('/');
      }
    });
  };

  const NavItems = () => (
    <>
      <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-none transition-colors ${location === '/dashboard' ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground border-l-2 border-transparent'}`}>
        <LayoutDashboard className="h-5 w-5" />
        <span className="font-display text-sm tracking-widest mt-1">Dashboard</span>
      </Link>
      <Link href="/search" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-none transition-colors ${location === '/search' ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground border-l-2 border-transparent'}`}>
        <Search className="h-5 w-5" />
        <span className="font-display text-sm tracking-widest mt-1">Find Clans</span>
      </Link>
      <Link href="/clans/create" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-none transition-colors ${location === '/clans/create' ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground border-l-2 border-transparent'}`}>
        <Plus className="h-5 w-5" />
        <span className="font-display text-sm tracking-widest mt-1">New Clan</span>
      </Link>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded"
      >
        Skip to content
      </a>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-50">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src={logoUrl} alt="AVIV Clan+ logo" className="h-7 w-7 object-contain" />
          <span className="font-display font-bold tracking-widest">AVIV</span>
        </Link>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation menu">
              <Menu className="h-6 w-6" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[80vw] bg-card border-r border-border p-0 flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-2 mb-8">
                <img src={logoUrl} alt="AVIV Clan+ logo" className="h-9 w-9 object-contain" />
                <span className="font-display font-bold text-xl tracking-widest">AVIV CLAN+</span>
              </div>
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  <AvatarImage src={user.avatar || undefined} alt={`${user.username}'s avatar`} />
                  <AvatarFallback className="bg-accent text-accent-foreground font-display">{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-bold">{user.username}</div>
                  <div className="text-xs text-muted-foreground font-mono">ID {user.discordId}</div>
                </div>
              </div>
            </div>
            <nav className="flex-1 py-4 flex flex-col gap-1">
              <NavItems />
            </nav>
            <div className="p-4 border-t border-border">
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                <LogOut className="h-5 w-5 mr-3" />
                Disconnect
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border h-screen sticky top-0">
        <div className="p-6 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-3 group cursor-pointer">
            <div className="bg-primary/10 p-2 rounded clip-edges group-hover:bg-primary/20 transition-colors">
              <img src={logoUrl} alt="AVIV Clan+ logo" className="h-6 w-6 object-contain" />
            </div>
            <div>
              <span className="block font-display font-bold tracking-widest leading-none">AVIV</span>
              <span className="block text-[10px] text-muted-foreground tracking-widest mt-1">CLAN NETWORK</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-2">
          <NavItems />
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 p-2 mb-4 bg-accent/50 rounded clip-edges">
            <Avatar className="h-10 w-10 rounded-sm">
              <AvatarImage src={user.avatar || undefined} alt={`${user.username}'s avatar`} />
              <AvatarFallback className="bg-background font-display rounded-sm">{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <div className="font-bold text-sm truncate">{user.username}</div>
              <div className="text-[10px] text-primary font-mono tracking-widest">VERIFIED</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs" onClick={handleLogout}>
            <span>DISCONNECT</span>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-30 z-0 mix-blend-overlay" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground)) 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }}></div>
        <div id="main-content" className="max-w-6xl mx-auto p-4 md:p-8 relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
