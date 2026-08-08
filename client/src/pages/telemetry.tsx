import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Battery, MapPin, Thermometer, Car, Search, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TelemetryResponse } from '@/types/api';
import type { TelemetryField } from '@shared/data';

type TelemetryCategory = 'battery' | 'location' | 'climate' | 'vehicle';

const categoryConfig: Record<TelemetryCategory, { label: string; icon: any; color: string }> = {
  battery: { label: 'Battery & Charging', icon: Battery, color: 'text-green-400' },
  location: { label: 'Location', icon: MapPin, color: 'text-blue-400' },
  climate: { label: 'Climate & HVAC', icon: Thermometer, color: 'text-amber-400' },
  vehicle: { label: 'Vehicle State', icon: Car, color: 'text-purple-400' },
};

export default function Telemetry() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<TelemetryCategory | 'all'>('all');

  const { data, isLoading, refetch, isFetching } = useQuery<TelemetryResponse>({
    queryKey: ['/api/telemetry'],
    refetchInterval: 30000,
    staleTime: 25000,
  });

  const fields = (data?.fields ?? []).filter((field) => {
    const matchesSearch = !search || field.label.toLowerCase().includes(search.toLowerCase()) || field.key.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || field.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const grouped: Record<string, TelemetryField[]> = {};
  for (const field of fields) {
    if (!grouped[field.category]) grouped[field.category] = [];
    grouped[field.category].push(field);
  }

  return (
    <DashboardLayout title="Real-Time Telemetry" subtitle="Vehicle data from python-lucidmotors API · Updates every 30s">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search telemetry fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-telemetry"
          />
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-accent disabled:opacity-50"
          data-testid="button-refresh"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <CategoryButton label="All" active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} count={data?.fields.length ?? 0} />
        {(Object.keys(categoryConfig) as TelemetryCategory[]).map((cat) => {
          const count = (data?.fields ?? []).filter((field) => field.category === cat).length;
          return (
            <CategoryButton
              key={cat}
              label={categoryConfig[cat].label}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              count={count}
            />
          );
        })}
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground" data-testid="last-updated">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
        Last updated: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : '—'}
        {data?.isDemoMode && <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-500">Demo Data</span>}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(grouped) as TelemetryCategory[]).map((cat) => {
            const config = categoryConfig[cat];
            const Icon = config.icon;
            return (
              <Card key={cat} data-testid={`card-${cat}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    {config.label}
                    <span className="text-xs text-muted-foreground">({grouped[cat].length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid={`table-${cat}`}>
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Field</th>
                          <th className="pb-2 pr-4 font-medium">Value</th>
                          <th className="pb-2 pr-4 font-medium">Unit</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 font-medium font-mono">API Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grouped[cat].map((field) => (
                          <tr key={field.key} className="border-b border-border/50 last:border-0" data-testid={`row-${field.key}`}>
                            <td className="py-2.5 pr-4">
                              <p className="font-medium">{field.label}</p>
                              <p className="font-mono text-xs text-muted-foreground/60">{field.key}</p>
                            </td>
                            <td className="py-2.5 pr-4 font-mono font-semibold tabular-nums">{field.value}</td>
                            <td className="py-2.5 pr-4 text-muted-foreground">{field.unit || '—'}</td>
                            <td className="py-2.5 pr-4">
                              <StatusIndicator status={field.status} />
                            </td>
                            <td className="py-2.5 font-mono text-xs text-muted-foreground/70">{field.source}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}

function CategoryButton({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      data-testid={`filter-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
      )}
    >
      {label} <span className="opacity-60">({count})</span>
    </button>
  );
}

function StatusIndicator({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    normal: { color: 'bg-green-500', label: 'Normal' },
    warning: { color: 'bg-amber-500', label: 'Warning' },
    critical: { color: 'bg-red-500', label: 'Critical' },
    info: { color: 'bg-blue-500', label: 'Info' },
  };
  const c = config[status] || config.info;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${c.color}`} />
      <span className="text-xs text-muted-foreground">{c.label}</span>
    </div>
  );
}
