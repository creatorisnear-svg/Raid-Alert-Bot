import { useState } from 'react';
import { useGetClan, useUpdateClan, useListDiscordChannels, useListDiscordRoles, useDeleteClan, getGetClanQueryKey, useListJoinRequests, useResolveJoinRequest, getListJoinRequestsQueryKey } from '@workspace/api-client-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocation } from 'wouter';
import { Loader2, Settings, Shield, Trash2, Key, Link as LinkIcon, Save, Users, Check, X } from 'lucide-react';
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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(updateClanSchema),
    values: {
      name: clan?.name || '',
      imageUrl: clan?.imageUrl || '',
      isPrivate: clan?.isPrivate ?? false,
      raidKey: '', // Empty initially unless they want to update it
      discordServerId: clan?.discordServerId || '',
      discordChannelId: clan?.discordChannelId || '',
      pingRole: clan?.pingRole || ''
    }
  });

  if (clanLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>;
  if (!clan) return null;

  const onSubmit = (data: z.infer<typeof updateClanSchema>) => {
    // Only send raidKey if it's not empty
    const updateData = { ...data };
    if (!updateData.raidKey) delete updateData.raidKey;

    updateClan.mutate({ clanId: id, data: updateData }, {
      onSuccess: () => {
        toast({ title: "Configuration Saved", description: "Clan settings have been updated." });
        queryClient.invalidateQueries({ queryKey: getGetClanQueryKey(id) });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.error || "Failed to update.", variant: "destructive" });
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
    if (confirm("WARNING: This will permanently delete the division and all logs. Proceed?")) {
      deleteClan.mutate({ clanId: id }, {
        onSuccess: () => setLocation('/dashboard')
      });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-widest uppercase mb-2">Division Settings</h1>
        <p className="text-muted-foreground font-mono">Modify parameters for {clan.name}.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* Main Settings Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-widest">Designation</FormLabel>
                    <FormControl><Input className="font-mono" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="imageUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-widest">Insignia URL</FormLabel>
                    <FormControl><Input className="font-mono" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="isPrivate" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between border border-border p-4 bg-background">
                    <div>
                      <FormLabel className="font-mono text-xs uppercase tracking-widest">Covert Status</FormLabel>
                      <FormDescription className="font-mono text-xs">Hide from public searches.</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-primary" /> Integration</CardTitle>
                <CardDescription>Link KAOS+ sensors to your network.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="raidKey" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-widest">KAOS+ Key</FormLabel>
                    <FormControl><Input type="password" placeholder={clan.hasRaidKey ? "KEY CONFIGURED - ENTER NEW TO OVERWRITE" : "ENTER SENSOR KEY"} className="font-mono" {...field} /></FormControl>
                    <FormDescription className="font-mono text-xs">Required to receive sensor signals.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="discordServerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-widest">Discord Server ID</FormLabel>
                    <FormControl><Input className="font-mono" placeholder="1234567890" {...field} /></FormControl>
                    <FormDescription className="font-mono text-xs">The ID of the server where the bot resides.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                {clan.discordServerId && channels && channels.length > 0 && (
                  <FormField control={form.control} name="discordChannelId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase tracking-widest">Target Channel</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="font-mono rounded-none"><SelectValue placeholder="Select channel" /></SelectTrigger>
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
                      <FormLabel className="font-mono text-xs uppercase tracking-widest">Alert Role ID (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="font-mono rounded-none"><SelectValue placeholder="No specific role" /></SelectTrigger>
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

            <Button type="submit" disabled={updateClan.isPending} className="w-full">
              {updateClan.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              SAVE CONFIGURATION
            </Button>
          </form>
        </Form>

        {/* Join Requests */}
        {clan.isPrivate && joinRequests && joinRequests.length > 0 && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Pending Clearances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {joinRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-3 border border-border bg-background">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 rounded-none">
                      <AvatarImage src={req.avatar || undefined} alt={`${req.username}'s avatar`} />
                      <AvatarFallback className="rounded-none bg-accent">{req.username.substring(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-bold text-sm">{req.username}</div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase">{formatDistanceToNow(new Date(req.createdAt))} ago</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="outline" aria-label={`Approve ${req.username}'s join request`} className="h-8 w-8 text-primary border-primary/50 hover:bg-primary/10" onClick={() => handleResolveRequest(req.id, 'approve')}>
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button size="icon" variant="outline" aria-label={`Reject ${req.username}'s join request`} className="h-8 w-8 text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => handleResolveRequest(req.id, 'reject')}>
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
            <p className="font-mono text-sm mb-4">Decommissioning this unit will sever all sensor links and purge records. This action is irreversible.</p>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteClan.isPending}>
              DECOMMISSION DIVISION
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
