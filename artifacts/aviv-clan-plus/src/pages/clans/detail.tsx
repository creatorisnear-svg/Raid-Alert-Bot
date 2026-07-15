import { useState } from 'react';
import { useGetClan, useListAlerts, useListClanMembers } from '@workspace/api-client-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { Loader2, Settings, ShieldAlert, Users, Radio, Activity, Clock, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export default function ClanDetail({ id }: { id: number }) {
  const { data: clan, isLoading: clanLoading } = useGetClan(id, { query: { enabled: !!id } });
  const { data: members, isLoading: membersLoading } = useListClanMembers(id, { query: { enabled: !!id } });
  const { data: alerts, isLoading: alertsLoading } = useListAlerts(id, { query: { enabled: !!id } });

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

  return (
    <div className="space-y-6">
      {/* Header Profile */}
      <div className="relative border border-border bg-card p-6 md:p-10 flex flex-col md:flex-row items-center md:items-end gap-6 overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 z-0 pointer-events-none"></div>
        <div className="absolute top-0 right-0 p-8 opacity-5 z-0 pointer-events-none">
          <ShieldAlert className="h-48 w-48 text-primary" />
        </div>
        
        <Avatar className="h-32 w-32 rounded-none border-4 border-background z-10 shadow-lg">
          <AvatarImage src={clan.imageUrl || undefined} />
          <AvatarFallback className="rounded-none bg-accent font-display text-4xl">{clan.name.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex-1 text-center md:text-left z-10">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
            <h1 className="text-4xl font-display font-bold tracking-widest uppercase">{clan.name}</h1>
            {clan.isPrivate && <Badge variant="outline" className="font-mono text-[10px] tracking-widest border-primary/50 text-primary">COVERT</Badge>}
          </div>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 font-mono text-sm text-muted-foreground uppercase">
            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {clan.memberCount} OPERATIVES</span>
            <span className="flex items-center gap-1"><Radio className="h-4 w-4" /> {clan.alertCount} SIGNALS</span>
            <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> LEADER: {clan.leaderUsername}</span>
          </div>
        </div>

        <div className="z-10 flex flex-col gap-2 w-full md:w-auto">
          {isLeader && (
            <Button asChild variant="outline" className="w-full md:w-auto bg-background">
              <Link href={`/clans/${clan.id}/settings`}>
                <Settings className="mr-2 h-4 w-4" /> CONFIGURATION
              </Link>
            </Button>
          )}
          {isMember && !isLeader && (
            <Button variant="secondary" className="w-full md:w-auto pointer-events-none">
              ACTIVE OPERATIVE
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Intel Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold tracking-widest uppercase">Intel Log</h2>
          </div>

          {!isMember ? (
            <div className="p-8 text-center border border-border border-dashed bg-card/50">
              <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="font-mono text-sm text-muted-foreground uppercase">Logs restricted to active operatives.</p>
            </div>
          ) : !alerts || alerts.length === 0 ? (
            <div className="p-8 text-center border border-border bg-card/50">
              <p className="font-mono text-sm text-muted-foreground uppercase">No signals recorded.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map(alert => (
                <Card key={alert.id} className={`bg-background border-l-4 ${alert.isTest ? 'border-l-secondary' : 'border-l-primary'}`}>
                  <CardContent className="p-4 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {alert.isTest ? <Settings className="h-4 w-4 text-muted-foreground" /> : <ShieldAlert className="h-4 w-4 text-primary" />}
                        <span className={`font-mono text-xs tracking-widest uppercase font-bold ${alert.isTest ? 'text-muted-foreground' : 'text-primary'}`}>
                          {alert.isTest ? 'TEST SIGNAL' : 'BREACH DETECTED'}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {format(new Date(alert.createdAt), 'HH:mm:ss')}
                      </span>
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

        {/* Right Column - Roster */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold tracking-widest uppercase">Roster</h2>
          </div>

          {!isMember ? (
            <div className="p-8 text-center border border-border border-dashed bg-card/50">
              <p className="font-mono text-sm text-muted-foreground uppercase">Roster restricted.</p>
            </div>
          ) : (
            <div className="bg-card border border-border">
              {members?.map((member, i) => (
                <div key={member.userId} className={`p-3 flex items-center justify-between ${i !== members.length - 1 ? 'border-b border-border/50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 rounded-none">
                      <AvatarImage src={member.avatar || undefined} />
                      <AvatarFallback className="rounded-none bg-accent text-xs font-display">{member.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-bold text-sm">{member.username}</div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                        {member.role === 'leader' ? <span className="text-primary">COMMANDER</span> : 'OPERATIVE'}
                      </div>
                    </div>
                  </div>
                  {member.silenced && (
                    <Badge variant="outline" className="text-[10px] border-muted-foreground text-muted-foreground">SILENCED</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
