import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Code2, Search, ExternalLink, CheckCircle2, Github } from 'lucide-react';
import { cn } from '@/lib/utils';

type ActionCategory = 'vehicle-control' | 'charging' | 'climate' | 'security' | 'software' | 'telemetry' | 'session';

const categoryLabels: Record<ActionCategory, string> = {
  'vehicle-control': 'Vehicle Control',
  'charging': 'Charging',
  'climate': 'Climate',
  'security': 'Security',
  'software': 'Software',
  'telemetry': 'Telemetry',
  'session': 'Session',
};

export default function ApiActions() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ActionCategory | 'all'>('all');
  const [showTestedOnly, setShowTestedOnly] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/actions'],
  });

  const actions = (data?.actions || []).filter((a: any) => {
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || a.category === activeCategory;
    const matchesTested = !showTestedOnly || a.testedInActions;
    return matchesSearch && matchesCategory && matchesTested;
  });

  const categories = Array.from(new Set((data?.actions || []).map((a: any) => a.category))) as ActionCategory[];

  return (
    <DashboardLayout title="Decoded API Actions" subtitle="Community-decoded Lucid Motors API methods from nshp/python-lucidmotors">
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Github className="h-8 w-8 text-muted-foreground" />
            <div>
              <a href={data?.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-primary" data-testid="link-repo">
                {data?.source}
              </a>
              <p className="text-xs text-muted-foreground">Unofficial Python bindings to the Lucid Motors API</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="rounded-md border border-border p-3 text-center" data-testid="stat-total-methods">
              <p className="font-mono text-xl font-bold tabular-nums">{data?.total ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Total Methods</p>
            </div>
            <div className="rounded-md border border-border p-3 text-center" data-testid="stat-tested">
              <p className="font-mono text-xl font-bold tabular-nums text-green-400">{data?.testedInScript ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Tested in Script</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search API actions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-actions" />
        </div>
        <button onClick={() => setShowTestedOnly(!showTestedOnly)} data-testid="button-tested-only" className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors', showTestedOnly ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-border hover:bg-accent')}>
          <CheckCircle2 className="h-4 w-4" /> Tested Only
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <CategoryButton label="All" active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} count={data?.total ?? 0} />
        {categories.map((cat) => {
          const count = (data?.actions || []).filter((a: any) => a.category === cat).length;
          return <CategoryButton key={cat} label={categoryLabels[cat] || cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)} count={count} />;
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />)}</div>
      ) : (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Code2 className="h-4 w-4 text-amber-400" /> API Method Repository <span className="text-xs text-muted-foreground">({actions.length} shown)</span></CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-actions">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="pb-2 pr-4 font-medium">Method</th><th className="pb-2 pr-4 font-medium">Category</th><th className="pb-2 pr-4 font-medium">Description</th><th className="pb-2 pr-4 font-medium">Signature</th><th className="pb-2 pr-4 font-medium">Tested</th></tr></thead>
                <tbody>{actions.map((action: any) => <tr key={action.name} className="border-b border-border/50 last:border-0 hover:bg-accent/30" data-testid={`action-${action.name}`}><td className="py-3 pr-4"><p className="font-mono text-sm font-semibold text-primary">{action.name}</p></td><td className="py-3 pr-4"><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{categoryLabels[action.category as ActionCategory] || action.category}</span></td><td className="py-3 pr-4 max-w-xs"><p className="text-xs text-muted-foreground">{action.description}</p></td><td className="py-3 pr-4"><code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{action.methodSignature}</code></td><td className="py-3 pr-4">{action.testedInActions ? <span className="flex items-center gap-1 text-xs text-green-400" data-testid={`tested-${action.name}`}><CheckCircle2 className="h-3.5 w-3.5" />Yes</span> : <span className="text-xs text-muted-foreground/50">—</span>}</td></tr>)}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Code2 className="h-4 w-4 text-amber-400" /> test_all_actions.py</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">The community stress-test script that runs through every decoded API action. Located at{' '}<a href={data?.testScriptUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid="link-test-script">examples/test_all_actions.py <ExternalLink className="inline h-3 w-3" /></a>. Tests {data?.testedInScript} actions including wake, charge port, defrost, doors, frunk, trunk, horn, lights, and vehicle refresh.</p></CardContent>
      </Card>
    </DashboardLayout>
  );
}

function CategoryButton({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count: number }) {
  return <button onClick={onClick} data-testid={`filter-action-${label.toLowerCase().replace(/\s+/g, '-')}`} className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent')}>{label} <span className="opacity-60">({count})</span></button>;
}
