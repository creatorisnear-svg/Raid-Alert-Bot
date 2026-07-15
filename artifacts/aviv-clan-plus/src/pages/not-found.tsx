import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
      <ShieldAlert className="h-24 w-24 text-destructive mb-6 opacity-80" />
      <h1 className="text-6xl font-display font-bold tracking-widest text-destructive mb-2 uppercase">404</h1>
      <h2 className="text-2xl font-mono tracking-widest uppercase mb-8">Sector Not Found</h2>
      <p className="text-muted-foreground font-mono max-w-md mb-8">
        The coordinates you requested do not exist in the active network grid.
      </p>
      <Button asChild size="lg" className="clip-edges">
        <Link href="/">Return to Safe Zone</Link>
      </Button>
    </div>
  );
}
