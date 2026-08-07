import { Link, useLocation } from 'wouter';
import { Battery, Radio, GitBranch, Activity, Bell, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Overview', icon: Activity },
  { path: '/telemetry', label: 'Telemetry', icon: Radio },
  { path: '/ota-timeline', label: 'OTA Timeline', icon: GitBranch },
  { path: '/api-actions', label: 'API Actions', icon: Battery },
  { path: '/monitoring', label: 'Monitoring', icon: Bell },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="flex h-full w-16 flex-col items-center border-r border-border bg-sidebar py-4 lg:w-56">
      <div className="mb-8 flex items-center gap-2 px-2" data-testid="logo">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="shrink-0">
          <rect width="32" height="32" rx="6" fill="hsl(225 33% 8%)" />
          <path d="M16 6L6 26h4l6-12 6 12h4L16 6z" fill="hsl(210 100% 52%)" />
        </svg>
        <span className="hidden font-mono text-sm font-bold tracking-tight lg:block">LUCID</span>
      </div>

      <nav className="flex w-full flex-1 flex-col gap-1 px-2" data-testid="nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden lg:block">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2 px-2">
        <div className="hidden items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1.5 lg:flex" data-testid="api-status">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-medium text-success">API Connected</span>
        </div>
        <div className="hidden text-center lg:block" data-testid="api-source">
          <p className="text-xs text-muted-foreground">python-lucidmotors</p>
          <p className="text-xs text-muted-foreground/60">Unofficial</p>
        </div>
        <Shield className="h-4 w-4 text-muted-foreground/40 lg:hidden" />
      </div>
    </aside>
  );
}
