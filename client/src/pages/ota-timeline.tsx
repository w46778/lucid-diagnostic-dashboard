import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GitBranch, AlertTriangle, Zap, Shield, Bug, Gauge, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

type UpdateCategory = 'feature' | 'bugfix' | 'recall' | 'security' | 'performance';

const categoryConfig: Record<UpdateCategory, { icon: any; color: string; bg: string; label: string }> = {
  feature: { icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Feature' },
  bugfix: { icon: Bug, color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Bug Fix' },
  recall: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Recall' },
  security: { icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Security' },
  performance: { icon: Gauge, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Performance' },
};

export default function OtaTimeline() {
  const [filter, setFilter] = useState<UpdateCategory | 'all'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['/api/ota-timeline'],
  });

  const updates = (data?.updates || []).filter((u: any) => filter === 'all' || u.category === filter).reverse();

  return (
    <DashboardLayout title="OTA Update Timeline" subtitle="Lucid Air software update history from LucidOwners forum, NHTSA, and community trackers">
      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total Updates" value={data?.total ?? '—'} icon={GitBranch} color="text-blue-400" />
        <StatCard label="Feature Drops" value={data?.features ?? '—'} icon={Zap} color="text-blue-400" />
        <StatCard label="Safety Recalls" value={data?.recalls ?? '—'} icon={AlertTriangle} color="text-red-400" />
        <StatCard label="Latest Version" value={data?.latestVersion ?? '—'} icon={GitBranch} color="text-green-400" />
        <StatCard label="Time Span" value="2021-2026" icon={Gauge} color="text-purple-400" />
      </div>

      {/* Filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterButton label="All Updates" active={filter === 'all'} onClick={() => setFilter('all')} />
        {(Object.keys(categoryConfig) as UpdateCategory[]).map((cat) => (
          <FilterButton
            key={cat}
            label={categoryConfig[cat].label}
            active={filter === cat}
            onClick={() => setFilter(cat)}
          />
        ))}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : (
        <div className="relative" data-testid="timeline">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {updates.map((update: any, index: number) => {
              const config = categoryConfig[update.category as UpdateCategory] || categoryConfig.bugfix;
              const Icon = config.icon;
              return (
                <div key={`${update.version}-${index}`} className="relative flex gap-4" data-testid={`timeline-item-${update.version}`}>
                  {/* Timeline dot */}
                  <div className={cn('relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-background', config.bg)} >
                    <Icon className={cn('h-4 w-4', config.color)} />
                  </div>

                  {/* Content card */}
                  <Card className="flex-1">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', config.bg, config.color)}>
                              {config.label}
                            </span>
                            <h3 className="font-mono text-sm font-bold">v{update.version}</h3>
                          </div>
                          <p className="mt-1 text-sm font-medium">{update.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{update.date}</p>
                          <p className="mt-2 text-sm text-muted-foreground">{update.description}</p>
                        </div>
                        <a
                          href={update.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                          data-testid={`link-source-${update.version}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                          {update.sourceName}
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Source attribution */}
      <Card className="mt-6">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            Sources: <a href="https://lucidowners.com/threads/release-version-megathread.555/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LucidOwners Forum Megathread</a>,
            {' '}<a href="https://recharged.com/articles/lucid-air-software-update-history" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Recharged</a>,
            {' '}<a href="https://www.lucidupdates.com/ota-updates/ota-updates-air.html" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">lucidupdates.com</a>,
            {' '}<a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">NHTSA Recalls</a>,
            {' '}<a href="https://www.cars.com/research/lucid/recalls/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Cars.com</a>
          </p>
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

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      data-testid={`filter-ota-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
      )}
    >
      {label}
    </button>
  );
}
