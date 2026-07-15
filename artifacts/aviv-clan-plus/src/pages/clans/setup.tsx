import { useState, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useGetClan, useUpdateClan, useListDiscordChannels, useListDiscordRoles } from '@workspace/api-client-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, CheckCircle2, Plus, Hash, Bell, ChevronRight, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getGetClanQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

// Steps: 1=basics(done), 2=discord, 3=kaos+alerts
type SetupStep = 2 | 3;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export default function ClanSetup({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const discordConnected = searchParams.get('discord') === 'connected';

  const { data: clan, isLoading } = useGetClan(id, { query: { enabled: !!id } });
  const updateClan = useUpdateClan();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Determine current step from clan data
  const step: SetupStep = clan?.discordServerId ? 3 : 2;

  // Step 3 form state
  const [raidKey, setRaidKey] = useState('');
  const [channelId, setChannelId] = useState('');
  const [pingRole, setPingRole] = useState('everyone');

  // Fetch invite URL
  const { data: inviteData, isLoading: inviteLoading } = useQuery({
    queryKey: ['discord-invite-url', id],
    queryFn: () => apiFetch(`/api/clans/${id}/discord/invite-url`),
    enabled: !!id && step === 2,
    retry: false,
  });

  // Create channel mutation
  const createChannel = useMutation({
    mutationFn: () => apiFetch(`/api/clans/${id}/discord/create-channel`, { method: 'POST' }),
    onSuccess: (data: any) => {
      setChannelId(data.id);
      toast({ title: 'Channel created', description: `#${data.name} is ready for raid alerts.` });
      queryClient.invalidateQueries({ queryKey: getGetClanQueryKey(id) });
      // Refresh channels list
      queryClient.invalidateQueries({ queryKey: ['discord-channels', id] });
    },
    onError: (err: any) => {
      toast({ title: 'Could not create channel', description: err.message, variant: 'destructive' });
    },
  });

  // Channels + roles (step 3)
  const { data: channels } = useListDiscordChannels(id, { query: { enabled: step === 3 } });
  const { data: roles } = useListDiscordRoles(id, { query: { enabled: step === 3 } });

  // Pre-select channel from clan data or from newly created channel
  useEffect(() => {
    if (clan?.discordChannelId && !channelId) setChannelId(clan.discordChannelId);
  }, [clan?.discordChannelId]);

  useEffect(() => {
    if (clan?.pingRole && pingRole === 'everyone') setPingRole(clan.pingRole);
  }, [clan?.pingRole]);

  // Redirect if already fully configured — must be after all hooks
  const alreadyConfigured = !!(clan?.discordServerId && clan?.hasRaidKey);
  useEffect(() => {
    if (alreadyConfigured) setLocation(`/clans/${id}`);
  }, [alreadyConfigured, id]);

  const handleFinish = () => {
    const updateData: Record<string, any> = {
      name: clan!.name,
      isPrivate: clan!.isPrivate,
      discordChannelId: channelId || undefined,
      pingRole: pingRole === 'everyone' ? undefined : pingRole,
    };
    if (raidKey.trim()) updateData.raidKey = raidKey.trim();

    updateClan.mutate({ clanId: id, data: updateData }, {
      onSuccess: () => {
        toast({ title: 'All set!', description: 'Your clan is ready to receive raid alerts.' });
        setLocation(`/clans/${id}`);
      },
      onError: (err: any) => {
        toast({ title: 'Error', description: err.error ?? 'Failed to save.', variant: 'destructive' });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clan) return null;
  if (alreadyConfigured) return null;

  return (
    <div className="max-w-2xl mx-auto mt-4 md:mt-8 pb-24 space-y-6">
      {/* Progress */}
      <div>
        <h1 className="text-3xl font-display font-bold tracking-widest uppercase mb-4">Set Up Your Clan</h1>
        <div className="flex items-center gap-2">
          {(['Clan Details', 'Discord', 'Alerts'] as const).map((label, i) => {
            const stepNum = i + 1;
            const done = stepNum < step;
            const active = stepNum === step;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono tracking-widest border transition-colors
                  ${done ? 'bg-primary/20 border-primary/40 text-primary' : active ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground'}`}>
                  {done ? <CheckCircle2 className="h-3 w-3" /> : <span>{stepNum}</span>}
                  {label}
                </div>
                {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 2 — Discord */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" /> Add the AVIV Bot to Your Server
              </CardTitle>
              <CardDescription>
                The bot needs to be in your Discord server before it can post raid alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {discordConnected ? (
                <div className="flex items-center gap-3 p-4 border border-primary/40 bg-primary/10">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-bold text-sm">Bot added successfully!</p>
                    <p className="text-xs text-muted-foreground font-mono">Your server is connected. Continue below.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground font-mono">
                    Click the button below and select your clan's Discord server. The bot will be added automatically.
                  </p>
                  <Button
                    asChild
                    disabled={inviteLoading || !inviteData?.url}
                    className="w-full"
                    size="lg"
                  >
                    <a href={inviteData?.url ?? '#'} target="_blank" rel="noopener noreferrer">
                      {inviteLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Add Bot to Discord Server
                    </a>
                  </Button>
                  <p className="text-xs text-center text-muted-foreground font-mono">
                    After adding the bot, you'll be brought back here automatically.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {discordConnected && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="h-5 w-5 text-primary" /> Set Up an Alert Channel
                </CardTitle>
                <CardDescription>
                  Want us to create a dedicated #raid-alerts channel in your server?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => createChannel.mutate()}
                  disabled={createChannel.isPending || createChannel.isSuccess}
                >
                  {createChannel.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating...</>
                  ) : createChannel.isSuccess ? (
                    <><CheckCircle2 className="h-4 w-4 mr-2 text-primary" /> #raid-alerts created</>
                  ) : (
                    <><Plus className="h-4 w-4 mr-2" /> Create #raid-alerts for me</>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground font-mono">
                  Or skip this and pick an existing channel in the next step.
                </p>
                <Button className="w-full" size="lg" onClick={() => setLocation(`/clans/${id}/setup`)}>
                  Continue to Alert Setup
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 3 — KAOS+ and alert config */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" /> Configure Raid Alerts
            </CardTitle>
            <CardDescription>
              Add your KAOS+ key and pick where alerts go in Discord.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* KAOS+ Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium">KAOS+ Raid Key</label>
              <Input
                type="password"
                placeholder={clan.hasRaidKey ? 'Key saved — enter a new one to replace it' : 'Enter your KAOS+ raid key'}
                value={raidKey}
                onChange={e => setRaidKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground font-mono">Required to receive raid alerts from your sensors.</p>
            </div>

            {/* Alert Channel */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Alert Channel</label>
              {channels && channels.length > 0 ? (
                <Select value={channelId} onValueChange={setChannelId}>
                  <SelectTrigger className="font-mono">
                    <SelectValue placeholder="Pick a channel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map(ch => (
                      <SelectItem key={ch.id} value={ch.id} className="font-mono">#{ch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 border border-border bg-card/50 text-sm text-muted-foreground font-mono">
                  Loading channels...
                </div>
              )}
              <p className="text-xs text-muted-foreground font-mono">Raid alerts will be posted to this channel.</p>
            </div>

            {/* Ping Role */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Role to Ping</label>
              <Select value={pingRole} onValueChange={setPingRole}>
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone" className="font-mono">
                    <span className="flex items-center gap-2">
                      @everyone <Badge variant="outline" className="text-[10px]">Default</Badge>
                    </span>
                  </SelectItem>
                  {roles?.map(r => (
                    <SelectItem key={r.id} value={r.id} className="font-mono">@{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground font-mono">This role gets pinged every time a raid alert fires.</p>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleFinish}
              disabled={updateClan.isPending}
            >
              {updateClan.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
              ) : (
                'Finish Setup'
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
