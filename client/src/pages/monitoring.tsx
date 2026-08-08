import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Github, MessageSquare, Shield, Mail, ExternalLink, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MonitoringAlertsResponse, MonitoringSourcesResponse, MonitoringStatusResponse } from '@/types/api';

type SourceType = 'github' | 'forum' | 'nhtsa';

const sourceTypeConfig: Record<SourceType, { icon: any; color: string; label: string }> = {
  github: { icon: Github, color: 'text-blue-400', label: 'GitHub' },
  forum: { icon: MessageSquare, color: 'text-green-400', label: 'Forum' },
  nhtsa: { icon: Shield, color: 'text-red-400', label: 'NHTSA' },
};

export default function Monitoring() {
  const { data: sourcesData } = useQuery<MonitoringSourcesResponse>({
    queryKey: ['/api/monitoring/sources'],
  });

  const { data: alertsData } = useQuery<MonitoringAlertsResponse>({
    queryKey: ['/api/monitoring/alerts'],
  });

  useQuery<MonitoringStatusResponse>({
    queryKey: ['/api/monitoring/status'],
  });

  return (
    <DashboardLayout title="Monitoring & Alerts" subtitle="Email alerts for new community API breakthroughs and software-issue reports">
      <Card className="mb-6 border-primary/20 bg-primary/5" data-testid="monitoring-banner">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Email Monitoring Active</p>
            <p className="text-sm text-muted-foreground">
              You'll receive email alerts at w46778@gmail.com when new community-led API reverse-engineering breakthroughs
              or significant software-issue reports are posted to GitHub or major Lucid engineering forums.
              Checks run every 6 hours.
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-md bg-success/10 px-3 py-1.5 md:flex" data-testid="monitoring-status">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-success">Active</span>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Monitored Sources" value={sourcesData?.sources.length ?? '—'} icon={Bell} color="text-blue-400" />
        <StatCard label="GitHub Sources" value={(sourcesData?.sources ?? []).filter((source) => source.type === 'github').length} icon={Github} color="text-blue-400" />
        <StatCard label="Forum Sources" value={(sourcesData?.sources ?? []).filter((source) => source.type === 'forum').length} icon={MessageSquare} color="text-green-400" />
        <StatCard label="Alerts Found" value={alertsData?.total ?? 0} icon={Mail} color="text-amber-400" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4 text-blue-400" />
            Monitored Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(sourcesData?.sources ?? []).map((source) => {
              const config = sourceTypeConfig[source.type] || sourceTypeConfig.forum;
              const Icon = config.icon;
              return (
                <div key={source.name} className="flex items-center gap-3 rounded-md border border-border p-3" data-testid={`source-${source.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted')}>
                    <Icon className={cn('h-4 w-4', config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{source.name}</p>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-xs', 'bg-muted text-muted-foreground')}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{source.query}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {source.lastChecked}
                    </span>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      data-testid={`link-source-${source.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-amber-400" />
            Alert Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <ConfigRow label="Alert Method" value="Email (w46778@gmail.com)" />
            <ConfigRow label="Check Frequency" value="Every 6 hours" />
            <ConfigRow label="GitHub Keywords" value="API, reverse-engineering, decoded endpoint, test_all_actions, lucid API" />
            <ConfigRow label="Forum Keywords" value="software issue, OTA bug, recall, API breakthrough, decoded" />
            <ConfigRow label="Severity Threshold" value="Warning and above" />
            <ConfigRow label="NHTSA Recalls" value="All new Lucid recalls" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4 text-purple-400" />
            Alert History
            <span className="text-xs text-muted-foreground">({alertsData?.total ?? 0} total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(alertsData?.alerts ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="no-alerts">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">No alerts yet</p>
              <p className="text-xs text-muted-foreground/60">You'll be notified when new breakthroughs are detected</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(alertsData?.alerts ?? []).map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 rounded-md border border-border p-3" data-testid={`alert-${alert.id}`}>
                  <span className={cn(
                    'mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium',
                    alert.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                    alert.severity === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-blue-500/10 text-blue-400'
                  )}>
                    {alert.severity}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.source} · {new Date(alert.createdAt).toLocaleString()}</p>
                    {alert.summary && <p className="mt-1 text-sm text-muted-foreground">{alert.summary}</p>}
                  </div>
                  <a href={alert.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <Card data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', color)} />
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-mono text-sm font-bold tabular-nums">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-3" data-testid={`config-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
