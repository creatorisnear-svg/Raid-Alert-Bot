import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { AppLayout } from '@/components/app-layout';

import Home from '@/pages/home';
import Dashboard from '@/pages/dashboard';
import ClanCreate from '@/pages/clans/create';
import SearchClans from '@/pages/search';
import ClanDetail from '@/pages/clans/detail';
import ClanSettings from '@/pages/clans/settings';
import InviteJoin from '@/pages/invite';
import Terms from '@/pages/legal/terms';
import Privacy from '@/pages/legal/privacy';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/invite/:token" component={InviteJoin} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/dashboard">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      <Route path="/search">
        <AppLayout><SearchClans /></AppLayout>
      </Route>
      <Route path="/clans/create">
        <AppLayout><ClanCreate /></AppLayout>
      </Route>
      <Route path="/clans/:id/settings">
        {params => <AppLayout><ClanSettings id={Number(params.id)} /></AppLayout>}
      </Route>
      <Route path="/clans/:id">
        {params => <AppLayout><ClanDetail id={Number(params.id)} /></AppLayout>}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
