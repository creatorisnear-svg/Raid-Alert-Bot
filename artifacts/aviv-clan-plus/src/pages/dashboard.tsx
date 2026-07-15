import { useGetDashboard, useResolveJoinRequest, getGetDashboardQueryKey } from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Loader2, RadioReceiver, ShieldAlert, Check, X, AlertTriangle, Activity } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();
  const queryClient = useQueryClient();
  const resolveRequest = useResolveJoinRequest();

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
        <h1 className="text-3xl font-display font-bold tracking-widest uppercase mb-2">Command Center</h1>
        <p className="text-muted-foreground font-mono">Overview of your network and recent intel.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/10 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Active Clans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-display font-bold">{dashboard.totalClans}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <RadioReceiver className="h-5 w-5 text-amber-500" /> Total Intel Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-display font-bold">{dashboard.totalAlerts}</div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" /> Pending Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-display font-bold">{dashboard.pendingRequests}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Activity Feed */}
        <div className="space-y-4">
          <h2 className="text-xl font-display font-bold tracking-widest flex items-center gap-2 uppercase">
            <AlertTriangle className="h-5 w-5 text-primary" /> Recent Intel
          </h2>
          
          <div className="space-y-3">
            {dashboard.recentAlerts.length === 0 ? (
              <div className="p-8 text-center border border-border border-dashed bg-card/50 text-muted-foreground font-mono text-sm">
                No recent activity recorded.
              </div>
            ) : (
              dashboard.recentAlerts.map(alert => (
                <div key={alert.id} className={`p-4 border clip-edges flex flex-col gap-2 ${alert.isTest ? 'bg-secondary/50 border-border' : 'bg-primary/5 border-primary/30'}`}>
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">{alert.clanName}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
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

        {/* Dashboard actions / My Clans */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-display font-bold tracking-widest uppercase">Quick Actions</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Button asChild variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
              <Link href="/clans/create">
                <ShieldAlert className="h-6 w-6" />
                <span>Establish Clan</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
              <Link href="/search">
                <Search className="h-6 w-6" />
                <span>Search Network</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Ensure Search is imported for the icon above
import { Search } from 'lucide-react';
