import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useEffect } from 'react';
import { useGetMe } from '@workspace/api-client-react';

import { Layout } from './components/layout';
import Login from './pages/login';
import Register from './pages/register';
import Onboard from './pages/onboard';
import Today from './pages/today';
import Dashboard from './pages/dashboard';
import Chores from './pages/chores';
import Expenses from './pages/expenses';
import Settle from './pages/settle';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } }
});

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, error } = useGetMe();
  const [loc, setLoc] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (error || !user) {
        if (loc !== '/login' && loc !== '/register') {
          setLoc('/login');
        }
      } else if (user.householdId === null && loc !== '/onboard') {
        setLoc('/onboard');
      }
    }
  }, [isLoading, error, user, loc, setLoc]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <span className="font-serif text-muted-foreground italic">Waking up...</span>
        </div>
      </div>
    );
  }

  if (error || !user) return null;
  if (user.householdId === null && loc !== '/onboard') return null;

  return <Layout>{children}</Layout>;
}

const withAuth = (Component: React.ComponentType) => () => (
  <AuthWrapper>
    <Component />
  </AuthWrapper>
);

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/onboard" component={withAuth(Onboard)} />
      <Route path="/" component={withAuth(Today)} />
      <Route path="/dashboard" component={withAuth(Dashboard)} />
      <Route path="/chores" component={withAuth(Chores)} />
      <Route path="/expenses" component={withAuth(Expenses)} />
      <Route path="/settle" component={withAuth(Settle)} />
      <Route component={withAuth(NotFound)} />
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
