import { Switch, Route, Router } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Toaster } from './components/ui/toaster';
import { ThemeProvider } from './components/theme-provider';
import Dashboard from './pages/dashboard';
import Telemetry from './pages/telemetry';
import OtaTimeline from './pages/ota-timeline';
import ApiActions from './pages/api-actions';
import Monitoring from './pages/monitoring';
import NotFound from './pages/not-found';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router hook={useHashLocation}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/telemetry" component={Telemetry} />
            <Route path="/ota-timeline" component={OtaTimeline} />
            <Route path="/api-actions" component={ApiActions} />
            <Route path="/monitoring" component={Monitoring} />
            <Route component={NotFound} />
          </Switch>
        </Router>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
