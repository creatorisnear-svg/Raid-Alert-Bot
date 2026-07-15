import { useState } from 'react';
import { useSearchClans, useRequestToJoin } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search as SearchIcon, Users, ShieldAlert, Loader2, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

export default function SearchClans() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  // Custom simple debounce
  useState(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: clans, isLoading } = useSearchClans(
    { q: debouncedQuery || undefined }, 
    { query: { keepPreviousData: true } }
  );

  const requestJoin = useRequestToJoin();
  const { toast } = useToast();

  const handleJoin = (clanId: number, name: string) => {
    requestJoin.mutate({ clanId }, {
      onSuccess: () => {
        toast({
          title: "Request Transmitted",
          description: `Clearance requested for ${name}.`,
        });
      },
      onError: (err) => {
        toast({
          title: "Transmission Failed",
          description: err.error || "Could not request join.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto mt-4">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-widest uppercase mb-2">Network Search</h1>
        <p className="text-muted-foreground font-mono">Locate and request access to active divisions.</p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input 
          className="pl-10 h-12 text-lg font-mono rounded-none border-primary/50 focus-visible:ring-primary/50" 
          placeholder="ENTER DESIGNATION..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {isLoading && !clans ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : clans && clans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clans.map(clan => (
              <Card key={clan.id} className="bg-card hover:border-primary/50 transition-colors overflow-hidden group">
                <CardContent className="p-0">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 rounded-none border border-border">
                        <AvatarImage src={clan.imageUrl || undefined} />
                        <AvatarFallback className="bg-accent font-display rounded-none text-accent-foreground">
                          {clan.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Link href={`/clans/${clan.id}`}>
                          <h3 className="font-display font-bold uppercase tracking-widest hover:text-primary transition-colors cursor-pointer">
                            {clan.name}
                          </h3>
                        </Link>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> {clan.memberCount}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" /> {clan.alertCount} signals
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleJoin(clan.id, clan.name)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      REQUEST ACCESS
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center border border-dashed border-border bg-card/30">
            <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="font-mono text-muted-foreground uppercase tracking-widest">No divisions match criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
