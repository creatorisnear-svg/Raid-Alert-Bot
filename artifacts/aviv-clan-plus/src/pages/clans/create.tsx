import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateClan } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from '@/components/ui/image-upload';
import { Plus, Loader2 } from 'lucide-react';

const createClanSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(40, "Name is too long"),
  imageUrl: z.string().optional().or(z.literal('')),
  isPrivate: z.boolean().default(false),
});

type FormValues = z.infer<typeof createClanSchema>;

export default function ClanCreate() {
  const [, setLocation] = useLocation();
  const createClan = useCreateClan();

  const form = useForm<FormValues>({
    resolver: zodResolver(createClanSchema),
    defaultValues: {
      name: '',
      imageUrl: '',
      isPrivate: false,
    }
  });

  const onSubmit = (data: FormValues) => {
    createClan.mutate({
      data: {
        name: data.name,
        imageUrl: data.imageUrl || undefined,
        isPrivate: data.isPrivate
      }
    }, {
      onSuccess: (newClan) => {
        setLocation(`/clans/${newClan.id}/settings`);
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto mt-4 md:mt-8 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold tracking-widest uppercase mb-2">Create Clan</h1>
        <p className="text-muted-foreground font-mono">Set up your clan on the AVIV network.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Clan Details
          </CardTitle>
          <CardDescription>
            Fill in your clan's information below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clan Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. TCK, Night Raiders, Void" {...field} />
                    </FormControl>
                    <FormDescription>
                      This is how your clan appears on the network.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clan Image (Optional)</FormLabel>
                    <FormControl>
                      <ImageUpload
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPrivate"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-none border p-4 bg-background">
                    <div className="space-y-0.5">
                      <FormLabel>Private Clan</FormLabel>
                      <FormDescription>
                        Hidden from search. Members can only join via invite.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" size="lg" disabled={createClan.isPending}>
                {createClan.isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Creating...</>
                ) : (
                  "Create Clan"
                )}
              </Button>

            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
