import { useState } from 'react';
import { useGetClan, useListAlerts, useListClanMembers, useSendTestAlert, getListAlertsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { Loader2, Settings, Users, Bell, Activity, Clock, BellRing, BellOff, FlaskConical, Download, X, Trash2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useRaidSiren } from '@/hooks/use-raid-siren';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function ClanDetail({ id }: { id: number }) {
  const { data: clan, isLoading: clanLoading } = useGetClan(id, { query: { enabled: !!id } });
  const { data: members, isLoading: membersLoading } = useListClanMembers(id, { query: { enabled: !!id } });
  const { data: alerts, isLoading: alertsLoading } = useListAlerts(id, { query: { enabled: !!id } });
  const siren = useRaidSiren(id);
  const install = useInstallPrompt();
  const sendTestAlert = useSendTestAlert();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const dismissAlert = (alertId: number) => setDismissedIds(prev => new Set(prev).add(alertId));
  const clearAllAlerts = () => setDismissedIds(new Set((alerts ?? []).map(a => a.id)));

  const isLoading = clanLoading || membersLoading || alertsLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clan) return null;

  const isMember = clan.myRole !== null;
  const isLeader = clan.myRole === 'leader';

  const handleTestAlert = () => {
    sendTestAlert.mutate({ clanId: id }, {
      onSuccess: () => {
        toast({ title: 'Test alert sent', description: 'Check Discord and your phone.' });
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey(id) });
      },
      onError: (err: any) => {
        toast({ title: 'Failed to send test alert', description: err?.error ?? 'Something went wrong.', variant: 'destructive' });
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Install banner — shown persistently until the app is installed */}
      {isMember && install.canInstall && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 border border-primary/40 bg-primary/10">
          <div className="flex items-center gap-3 min-w-0">
            <Download className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-sm">Add AVIV Clan+ to your home screen</p>
              <p className="text-xs font-mono text-muted-foreground">Get instant raid alerts as push notifications.</p>
            </div>
          </div>
          <Button size="sm" onClick={install.install} disabled={install.isInstalling} className="shrink-0">
            {install.isInstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Install'}
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="relative border border-border bg-card p-6 md:p-10 flex flex-col md:flex-row items-center md:items-end gap-6 overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 z-0 pointer-events-none" />

        <Avatar className="h-28 w-28 rounded-none border-4 border-background z-10 shadow-lg">
          <AvatarImage src={clan.imageUrl || undefined} alt={`${clan.name} clan image`} />
          <AvatarFallback className="rounded-none bg-accent font-display text-4xl">{clan.name.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex-1 text-center md:text-left z-10">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-2 flex-wrap">
            <h1 className="text-4xl font-display font-bold tracking-widest uppercase">{clan.name}</h1>
            {clan.isPrivate && <Badge variant="outline" className="font-mono text-[10px] tracking-widest">Private</Badge>}
          </div>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 font-mono text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {clan.memberCount} members</span>
            <span className="flex items-center gap-1"><Bell className="h-4 w-4" /> {clan.alertCount} alerts</span>
            <span className="flex items-center gap-1 capitalize">Leader: {clan.leaderUsername}</span>
          </div>
        </div>

        <div className="z-10 flex flex-col gap-2 w-full md:w-auto">
          {isLeader && (
            <Button asChild variant="outline" className="w-full md:w-auto bg-background">
              <Link href={`/clans/${clan.id}/settings`}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Link>
            </Button>
          )}
          {isLeader && (
            <Button
              variant="outline"
              className="w-full md:w-auto bg-background"
              disabled={sendTestAlert.isPending}
              onClick={handleTestAlert}
            >
              {sendTestAlert.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <FlaskConical className="mr-2 h-4 w-4" />}
              Send Test Alert
            </Button>
          )}
          {isMember && !isLeader && (
            <Button variant="secondary" className="w-full md:w-auto pointer-events-none">
              Member
            </Button>
          )}
          {isMember && siren.supported && !siren.checking && (
            siren.subscribed ? (
              <Button
                variant="outline"
                className="w-full md:w-auto bg-background"
                disabled={siren.disabling}
                onClick={() => siren.disable()}
              >
                {siren.disabling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4 text-primary" />}
                Alerts On
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full md:w-auto bg-background"
                disabled={siren.enabling || siren.permission === 'denied'}
                onClick={() => siren.enable()}
              >
                {siren.enabling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : siren.permission === 'denied' ? (
                  <BellOff className="mr-2 h-4 w-4" />
                ) : (
                  <Bell className="mr-2 h-4 w-4" />
                )}
                {siren.permission === 'denied' ? 'Alerts Blocked' : 'Enable Alerts'}
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Alert Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold tracking-widest uppercase flex-1">Raid Alerts</h2>
            {alerts && alerts.length > 0 && dismissedIds.size < alerts.length && (
              <Button variant="ghost" size="sm" className="font-mono text-xs text-muted-foreground hover:text-foreground h-7 px-2" onClick={clearAllAlerts}>
                <Trash2 className="h-3 w-3 mr-1" /> Clear all
              </Button>
            )}
          </div>

          {!isMember ? (
            <div className="p-8 text-center border border-border border-dashed bg-card/50">
              <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="font-mono text-sm text-muted-foreground">Join this clan to see raid alerts.</p>
            </div>
          ) : !alerts || alerts.filter(a => !dismissedIds.has(a.id)).length === 0 ? (
            <div className="p-8 text-center border border-border bg-card/50">
              <p className="font-mono text-sm text-muted-foreground">No alerts yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.filter(a => !dismissedIds.has(a.id)).map(alert => (
                <Card key={alert.id} className={`bg-background border-l-4 ${alert.isTest ? 'border-l-secondary' : 'border-l-primary'}`}>
                  <CardContent className="p-4 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs tracking-widest uppercase font-bold ${alert.isTest ? 'text-muted-foreground' : 'text-primary'}`}>
                          {alert.isTest ? 'Test Alert' : 'Raid Alert'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {format(new Date(alert.createdAt), 'HH:mm:ss')}
                        </span>
                        <button onClick={() => dismissAlert(alert.id)} className="text-muted-foreground hover:text-foreground transition-colors ml-1" aria-label="Dismiss">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-bold text-lg">{alert.title}</h3>
                    <p className="font-mono text-sm text-muted-foreground">{alert.body}</p>
                    <div className="mt-2 text-[10px] text-muted-foreground font-mono">
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold tracking-widest uppercase">Members</h2>
          </div>

          {!isMember ? (
            <div className="p-8 text-center border border-border border-dashed bg-card/50">
              <p className="font-mono text-sm text-muted-foreground">Join to see members.</p>
            </div>
          ) : (
            <div className="bg-card border border-border">
              {members?.map((member, i) => (
                <div key={member.userId} className={`p-3 flex items-center justify-between ${i !== members.length - 1 ? 'border-b border-border/50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 rounded-none">
                      <AvatarImage src={member.avatar || undefined} alt={`${member.username}'s avatar`} />
                      <AvatarFallback className="rounded-none bg-accent text-xs font-display">{member.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-bold text-sm">{member.username}</div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                        {member.role === 'leader' ? <span className="text-primary">Leader</span> : 'Member'}
                      </div>
                    </div>
                  </div>
                  {member.silenced && (
                    <Badge variant="outline" className="text-[10px] border-muted-foreground text-muted-foreground">Muted</Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Install prompt (fallback for non-banner browsers like iOS Safari) */}
          {isMember && !install.isInstalled && !install.canInstall && (
            <div className="p-4 border border-border bg-card/50 space-y-2">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <span className="font-bold text-sm">Add to Home Screen</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                On iPhone: tap the <span className="text-foreground font-medium">Share</span> button in Safari, then <span className="text-foreground font-medium">Add to Home Screen</span>.<br />
                On Android: tap the browser menu and select <span className="text-foreground font-medium">Add to Home Screen</span>.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
