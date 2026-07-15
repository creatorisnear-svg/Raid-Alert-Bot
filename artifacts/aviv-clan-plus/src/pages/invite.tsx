import { useGetInviteInfo, useJoinViaInvite } from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Loader2, ShieldAlert, Users, LogIn } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

export default function InviteJoin({ token }: { token: string }) {
  const { data: invite, isLoading, isError } = useGetInviteInfo(token, { query: { retry: false } });
  const joinClan = useJoinViaInvite();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !invite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/50">
          <CardContent className="p-8 text-center flex flex-col items-center">
            <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
            <h2 className="font-display text-xl uppercase tracking-widest mb-2">Invalid Code</h2>
            <p className="font-mono text-sm text-muted-foreground mb-6">This access token has expired or does not exist.</p>
            <Button asChild variant="outline">
              <a href="/">Return to Base</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleJoin = () => {
    joinClan.mutate({ token }, {
      onSuccess: () => {
        toast({ title: "Clearance Granted", description: `You have joined ${invite.name}.` });
        setLocation(`/clans/${invite.clanId}`);
      },
      onError: (err) => {
        // If 401, redirect to auth
        if (err.error?.includes("unauthorized") || err.error?.includes("login")) {
          window.location.href = `/api/auth/discord?returnTo=/invite/${token}`;
        } else {
          toast({ title: "Access Denied", description: err.error || "Failed to join.", variant: "destructive" });
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20 z-0" style={{
        backgroundImage: 'linear-gradient(hsl(var(--primary)/0.2) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.2) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        backgroundPosition: 'center center'
      }}></div>

      <Card className="max-w-md w-full relative z-10 border-primary/30 shadow-xl shadow-primary/5">
        <CardHeader className="text-center pb-0 pt-8">
          <Avatar className="h-24 w-24 mx-auto mb-4 rounded-none border-2 border-border">
            <AvatarImage src={invite.imageUrl || undefined} />
            <AvatarFallback className="rounded-none bg-accent font-display text-2xl">{invite.name.substring(0,2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="text-xs font-mono tracking-widest text-primary mb-1 uppercase">Clearance Request</div>
          <CardTitle className="font-display text-3xl tracking-widest uppercase">{invite.name}</CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center flex flex-col items-center">
          <div className="flex items-center justify-center gap-6 mb-8 font-mono text-sm text-muted-foreground uppercase w-full border-y border-border py-3">
            <span className="flex flex-col items-center"><Users className="h-4 w-4 mb-1" /> {invite.memberCount} Operatives</span>
            <span className="flex flex-col items-center"><ShieldAlert className="h-4 w-4 mb-1" /> Cmdr {invite.leaderUsername}</span>
          </div>
          
          <Button onClick={handleJoin} className="w-full h-12 text-lg group" disabled={joinClan.isPending}>
            {joinClan.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>
                <LogIn className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                ACCEPT ASSIGNMENT
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
