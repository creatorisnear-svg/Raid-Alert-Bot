import { useGetDashboard, useResolveJoinRequest, getGetDashboardQueryKey, useListMyClans } from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'wouter';
import { Loader2, Users, Bell, Activity, AlertTriangle, Plus, Search, Check, X, Clock, ChevronRight, Settings } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();
  const { data: myClans, isLoading: clansLoading } = useListMyClans();
  const queryClient = useQueryClient();
  const resolveRequest = useResolveJoinRequest();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dashboard) return null;

  const handleResolve = (clanId: number, requestId: number, action: 'approve' | 'reject') => {
    resolveRequest.mutate(
      { clanId, requestId, data: { action } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        }
      }
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-widest uppercase mb-2">Dashboard</h1>
        <p className="text-muted-foreground font-mono">Your clans and recent activity.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-primary/10 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary flex items-center gap-2 text-base">
              <Users className="h-5 w-5" /> My Clans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-display font-bold">{dashboard.totalClans}</div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5 text-amber-500" /> Raid Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-display font-bold">{dashboard.totalAlerts}</div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-blue-500" /> Join Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-display font-bold">{dashboard.pendingRequests}</div>
          </CardContent>
        </Card>
      </div>

      {/* My Clans */}
      <div className="space-y-4">
        <h2 className="text-xl font-display font-bold tracking-widest uppercase flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> My Clans
        </h2>

        {clansLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm p-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading clans...
          </div>
        ) : !myClans || myClans.length === 0 ? (
          <div className="p-8 text-center border border-border border-dashed bg-card/50 text-muted-foreground font-mono text-sm">
            You are not in any clans yet.
          </div>
        ) : (
          <div className="space-y-2">
            {myClans.map(clan => (
              <div
                key={clan.id}
                role="link"
                tabIndex={0}
                className="flex items-center gap-4 p-4 border border-border bg-card hover:bg-accent/50 hover:border-primary/40 transition-colors cursor-pointer group"
                onClick={() => navigate(`/clans/${clan.id}`)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/clans/${clan.id}`); }}
              >
                <Avatar className="h-10 w-10 rounded-none shrink-0">
                  <AvatarImage src={clan.imageUrl || undefined} alt={`${clan.name} image`} />
                  <AvatarFallback className="rounded-none bg-accent font-display text-sm">{clan.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold tracking-wide">{clan.name}</span>
                    <Badge variant={clan.role === 'leader' ? 'default' : 'secondary'} className="text-[10px] font-mono tracking-widest uppercase">
                      {clan.role}
                    </Badge>
                    {!clan.discordConfigured && (
                      <Badge variant="outline" className="text-[10px] font-mono tracking-widest text-amber-500 border-amber-500/40">Setup needed</Badge>
                    )}
                    {clan.pendingRequestCount > 0 && (
                      <Badge variant="outline" className="text-[10px] font-mono tracking-widest text-primary border-primary/40">{clan.pendingRequestCount} pending</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] font-mono text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{clan.memberCount}</span>
                    <span className="flex items-center gap-1"><Bell className="h-3 w-3" />{clan.alertCount} alerts</span>
                    {clan.lastAlertAt && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(clan.lastAlertAt), { addSuffix: true })}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {clan.role === 'leader' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Clan settings"
                      onClick={e => { e.stopPropagation(); navigate(`/clans/${clan.id}/settings`); }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Activity Feed */}
        <div className="space-y-4">
          <h2 className="text-xl font-display font-bold tracking-widest flex items-center gap-2 uppercase">
            <AlertTriangle className="h-5 w-5 text-primary" /> Recent Alerts
          </h2>

          <div className="space-y-3">
            {dashboard.recentAlerts.length === 0 ? (
              <div className="p-8 text-center border border-border border-dashed bg-card/50 text-muted-foreground font-mono text-sm">
                No alerts yet.
              </div>
            ) : (
              dashboard.recentAlerts.map(alert => (
                <div key={alert.id} className={`p-4 border clip-edges flex flex-col gap-2 ${alert.isTest ? 'bg-secondary/50 border-border' : 'bg-primary/5 border-primary/30'}`}>
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">{alert.clanName}</span>
                    <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <h4 className={`font-bold ${alert.isTest ? 'text-foreground' : 'text-primary'}`}>{alert.title}</h4>
                  <p className="text-sm font-mono opacity-80">{alert.body}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-xl font-display font-bold tracking-widest uppercase">Quick Actions</h2>

          <div className="grid grid-cols-2 gap-4">
            <Button asChild variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
              <Link href="/clans/create">
                <Plus className="h-6 w-6" />
                <span>Create Clan</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
              <Link href="/search">
                <Search className="h-6 w-6" />
                <span>Find Clans</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
