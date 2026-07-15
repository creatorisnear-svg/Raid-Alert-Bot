import { useState } from 'react';
import { useGetClan, useUpdateClan, useListDiscordChannels, useListDiscordRoles, useDeleteClan, getGetClanQueryKey, useListJoinRequests, useResolveJoinRequest, getListJoinRequestsQueryKey, useGetInviteToken, useRegenerateInviteToken, getGetInviteTokenQueryKey } from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/image-upload';
import { useLocation } from 'wouter';
import { Loader2, Shield, Trash2, Key, Save, Users, Check, X, Link2, Copy, RefreshCw, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const updateClanSchema = z.object({
  name: z.string().min(3).max(40),
  imageUrl: z.string().optional().or(z.literal('')),
  isPrivate: z.boolean(),
  raidKey: z.string().optional(),
  discordServerId: z.string().optional(),
  discordChannelId: z.string().optional(),
  pingRole: z.string().optional()
});

export default function ClanSettings({ id }: { id: number }) {
  const { data: clan, isLoading: clanLoading } = useGetClan(id, { query: { enabled: !!id } });
  const { data: channels } = useListDiscordChannels(id, { query: { enabled: !!clan?.discordServerId } });
  const { data: roles } = useListDiscordRoles(id, { query: { enabled: !!clan?.discordServerId } });
  const { data: joinRequests } = useListJoinRequests(id, { query: { enabled: !!id } });

  const updateClan = useUpdateClan();
  const deleteClan = useDeleteClan();
  const resolveRequest = useResolveJoinRequest();
  const { data: inviteToken, isLoading: inviteLoading } = useGetInviteToken(id, { query: { enabled: !!id } });
  const regenerateToken = useRegenerateInviteToken();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(updateClanSchema),
    values: {
      name: clan?.name || '',
      imageUrl: clan?.imageUrl || '',
      isPrivate: clan?.isPrivate ?? false,
      raidKey: '',
      discordServerId: clan?.discordServerId || '',
      discordChannelId: clan?.discordChannelId || '',
      pingRole: clan?.pingRole || ''
    }
  });

  if (clanLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>;
  if (!clan) return null;

  const onSubmit = (data: z.infer<typeof updateClanSchema>) => {
    const updateData = { ...data };
    if (!updateData.raidKey) delete updateData.raidKey;

    updateClan.mutate({ clanId: id, data: updateData }, {
      onSuccess: () => {
        toast({ title: "Settings Saved", description: "Clan settings have been updated." });
        queryClient.invalidateQueries({ queryKey: getGetClanQueryKey(id) });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.error || "Failed to update.", variant: "destructive" });
      }
    });
  };

  const handleCopyInvite = () => {
    if (!inviteToken?.url) return;
    navigator.clipboard.writeText(inviteToken.url).then(() => {
      toast({ title: "Copied", description: "Invite link copied to clipboard." });
    });
  };

  const handleRegenerateInvite = () => {
    regenerateToken.mutate({ clanId: id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInviteTokenQueryKey(id) });
        toast({ title: "Link Regenerated", description: "The old invite link is now invalid." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to regenerate link.", variant: "destructive" });
      }
    });
  };

  const handleResolveRequest = (requestId: number, action: 'approve' | 'reject') => {
    resolveRequest.mutate({ clanId: id, requestId, data: { action } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListJoinRequestsQueryKey(id) });
      }
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure? This will permanently delete the clan and all its data. This cannot be undone.")) {
      deleteClan.mutate({ clanId: id }, {
        onSuccess: () => setLocation('/dashboard')
      });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-24">
      <div>
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 font-mono text-muted-foreground hover:text-foreground" onClick={() => setLocation(`/clans/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to clan
        </Button>
        <h1 className="text-3xl font-display font-bold tracking-widest uppercase mb-2">Clan Settings</h1>
        <p className="text-muted-foreground font-mono">Manage settings for {clan.name}.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Clan Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clan Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="imageUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clan Image</FormLabel>
                    <FormControl>
                      <ImageUpload value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="isPrivate" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between border border-border p-4 bg-background">
                    <div>
                      <FormLabel>Private Clan</FormLabel>
                      <FormDescription>Hidden from search. Members join by invite only.</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-primary" /> KAOS+ Integration</CardTitle>
                <CardDescription>Connect KAOS+ to start receiving raid alerts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="raidKey" render={({ field }) => (
                  <FormItem>
                    <FormLabel>KAOS+ Raid Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={clan.hasRaidKey ? "Key saved — enter a new one to replace it" : "Enter your raid key"}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Required to receive raid alerts from KAOS+.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="discordServerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discord Server ID</FormLabel>
                    <FormControl><Input placeholder="1234567890" {...field} /></FormControl>
                    <FormDescription>The ID of the Discord server where alerts get posted.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                {clan.discordServerId && channels && channels.length > 0 && (
                  <FormField control={form.control} name="discordChannelId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alert Channel</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="font-mono rounded-none"><SelectValue placeholder="Select a channel" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {channels.map(ch => <SelectItem key={ch.id} value={ch.id} className="font-mono">#{ch.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {clan.discordServerId && roles && roles.length > 0 && (
                  <FormField control={form.control} name="pingRole" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ping Role (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="font-mono rounded-none"><SelectValue placeholder="No role ping" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" className="font-mono">No role ping</SelectItem>
                          {roles.map(r => <SelectItem key={r.id} value={r.id} className="font-mono">@{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </CardContent>
            </Card>

            <Button type="submit" disabled={updateClan.isPending} className="w-full" size="lg">
              {updateClan.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Save Settings
            </Button>
          </form>
        </Form>

        {/* Invite Link */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" /> Invite Link</CardTitle>
            <CardDescription>Share this link to let players join the clan. Regenerate to invalidate the old one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {inviteLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Generating link...</div>
            ) : inviteToken?.url ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 block truncate bg-muted px-3 py-2 text-xs font-mono border border-border rounded-none select-all">
                  {inviteToken.url}
                </code>
                <Button size="icon" variant="outline" aria-label="Copy invite link" className="shrink-0 h-9 w-9" onClick={handleCopyInvite}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" aria-label="Regenerate invite link" className="shrink-0 h-9 w-9" onClick={handleRegenerateInvite} disabled={regenerateToken.isPending}>
                  {regenerateToken.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Join Requests */}
        {clan.isPrivate && joinRequests && joinRequests.length > 0 && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Join Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {joinRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-3 border border-border bg-background">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 rounded-none">
                      <AvatarImage src={req.avatar || undefined} alt={`${req.username}'s avatar`} />
                      <AvatarFallback className="rounded-none bg-accent">{req.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-bold text-sm">{req.username}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{formatDistanceToNow(new Date(req.createdAt))} ago</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="outline" aria-label={`Approve ${req.username}`} className="h-8 w-8 text-primary border-primary/50 hover:bg-primary/10" onClick={() => handleResolveRequest(req.id, 'approve')}>
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button size="icon" variant="outline" aria-label={`Reject ${req.username}`} className="h-8 w-8 text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => handleResolveRequest(req.id, 'reject')}>
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Danger Zone */}
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2"><Trash2 className="h-5 w-5" /> Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm mb-4">Deleting this clan is permanent and cannot be undone. All alerts and member data will be lost.</p>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteClan.isPending}>
              Delete Clan
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
