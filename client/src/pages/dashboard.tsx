import { useQuery } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Battery, GitBranch, Code2, Bell, MapPin, Car } from 'lucide-react';
import { Link } from 'wouter';
import type { ApiActionsResponse, OtaTimelineResponse } from '@/types/api';

interface Stats {
  telemetryFields: number; otaUpdates: number; apiActions: number; monitoredSources: number;
  apiSource: string; latestSoftware: string; vehicleModel: string; isDemoMode: boolean;
}

export default function Dashboard() {
  const { data: stats } = useQuery<Stats>({ queryKey: ['/api/stats'] });
  const { data: otaData } = useQuery<OtaTimelineResponse>({ queryKey: ['/api/ota-timeline'] });
  const { data: actionsData } = useQuery<ApiActionsResponse>({ queryKey: ['/api/actions'] });

  const kpiCards = [
    { label: 'Telemetry Fields', value: stats?.telemetryFields ?? '—', icon: Radio, color: 'text-blue-400', href: '/telemetry' },
    { label: 'OTA Updates Tracked', value: stats?.otaUpdates ?? '—', icon: GitBranch, color: 'text-green-400', href: '/ota-timeline' },
    { label: 'Decoded API Actions', value: stats?.apiActions ?? '—', icon: Code2, color: 'text-amber-400', href: '/api-actions' },
    { label: 'Monitored Sources', value: stats?.monitoredSources ?? '—', icon: Bell, color: 'text-purple-400', href: '/monitoring' },
  ];

  return (
    <DashboardLayout title="Overview" subtitle="Lucid Air Grand Touring · Software 2.8.17">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpiCards.map((kpi) => { const Icon = kpi.icon; return <Link key={kpi.label} href={kpi.href}><Card className="cursor-pointer transition-colors hover:border-primary/30"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{kpi.label}</p><p className="mt-1 font-mono text-2xl font-bold tabular-nums">{kpi.value}</p></div><Icon className={`h-5 w-5 ${kpi.color}`} /></div></CardContent></Card></Link>; })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Car className="h-4 w-4 text-blue-400" /> Vehicle Status</CardTitle></CardHeader><CardContent className="space-y-2"><StatusRow label="Model" value={stats?.vehicleModel ?? '—'} /><StatusRow label="Software" value={stats?.latestSoftware ?? '—'} /><StatusRow label="Power State" value="Sleep" /><StatusRow label="Drive Mode" value="Smooth" /><StatusRow label="Data Mode" value={stats?.isDemoMode ? 'Demo' : 'Live'} badge={stats?.isDemoMode ? 'amber' : 'green'} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Battery className="h-4 w-4 text-green-400" /> Battery & Charging</CardTitle></CardHeader><CardContent className="space-y-2"><StatusRow label="Battery Level" value="78%" /><StatusRow label="Est. Range" value="348 mi" /><StatusRow label="Charge State" value="Idle" /><StatusRow label="Charge Limit" value="80%" /><StatusRow label="AC Current Limit" value="48A" /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-blue-400" /> Location & Climate</CardTitle></CardHeader><CardContent className="space-y-2"><StatusRow label="Location" value="New Berlin, WI" /><StatusRow label="GPS" value="43.05°N, 87.91°W" /><StatusRow label="Odometer" value="14,532 mi" /><StatusRow label="Cabin Temp" value="21.0°C" /><StatusRow label="HVAC" value="Off" /></CardContent></Card>
      </div>

      <Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><GitBranch className="h-4 w-4 text-green-400" /> Recent OTA Updates</CardTitle></CardHeader><CardContent><div className="space-y-2">{otaData?.updates?.slice(-5).reverse().map((update) => <div key={update.version} className="flex items-center gap-3 rounded-md border border-border p-2"><CategoryBadge category={update.category} /><div className="flex-1"><p className="text-sm font-medium">{update.version} — {update.title}</p><p className="text-xs text-muted-foreground">{update.date}</p></div></div>)}</div></CardContent></Card>

      <Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Code2 className="h-4 w-4 text-amber-400" /> Decoded API Actions Summary</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><ActionStat label="Total Methods" value={actionsData?.total ?? '—'} /><ActionStat label="Tested in Script" value={actionsData?.testedInScript ?? '—'} /><ActionStat label="Source" value="nshp/python-lucidmotors" /><ActionStat label="Script" value="test_all_actions.py" /></div></CardContent></Card>
    </DashboardLayout>
  );
}

function StatusRow({ label, value, badge }: { label: string; value: string; badge?: 'green' | 'amber' }) { return <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{label}</span>{badge ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge === 'green' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>{value}</span> : <span className="font-mono tabular-nums">{value}</span>}</div>; }
function CategoryBadge({ category }: { category: string }) { const colors: Record<string, string> = { feature: 'bg-blue-500/10 text-blue-400', bugfix: 'bg-gray-500/10 text-gray-400', recall: 'bg-red-500/10 text-red-400', security: 'bg-amber-500/10 text-amber-400', performance: 'bg-green-500/10 text-green-400' }; return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors[category] || colors.bugfix}`}>{category}</span>; }
function ActionStat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-mono text-sm font-medium truncate">{value}</p></div>; }
