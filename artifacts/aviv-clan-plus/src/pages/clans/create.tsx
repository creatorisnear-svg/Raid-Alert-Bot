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
import { ShieldPlus, Loader2 } from 'lucide-react';

const createClanSchema = z.object({
  name: z.string().min(3, "Designation must be at least 3 characters").max(40, "Designation too long"),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal('')),
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
    <div className="max-w-2xl mx-auto mt-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold tracking-widest uppercase mb-2">Establish Division</h1>
        <p className="text-muted-foreground font-mono">Register a new clan within the AVIV network.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldPlus className="h-5 w-5 text-primary" /> Parameters
          </CardTitle>
          <CardDescription className="font-mono">
            Define the operational identity of your unit.
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
                    <FormLabel className="font-mono text-xs uppercase tracking-widest">Unit Designation</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. OMEGA SQUAD" className="font-mono" {...field} />
                    </FormControl>
                    <FormDescription className="font-mono text-xs">
                      The official name recognized on the network.
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
                    <FormLabel className="font-mono text-xs uppercase tracking-widest">Insignia URL (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/logo.png" className="font-mono" {...field} />
                    </FormControl>
                    <FormDescription className="font-mono text-xs">
                      Direct link to an image file.
                    </FormDescription>
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
                      <FormLabel className="font-mono text-xs uppercase tracking-widest">Covert Status</FormLabel>
                      <FormDescription className="font-mono text-xs">
                        If active, unit will not appear in public searches. Invites only.
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

              <Button type="submit" className="w-full" disabled={createClan.isPending}>
                {createClan.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Initialize Division"
                )}
              </Button>

            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
