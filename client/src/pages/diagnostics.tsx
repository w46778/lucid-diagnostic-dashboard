import { useQuery } from '@tanstack/react-query';
import { Activity, Cpu, Database, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Capability = {
  id: string;
  name: string;
  protocol: string;
  evidence: 'confirmed' | 'documented' | 'community' | 'hypothesis';
  access: 'read-only' | 'service' | 'protected';
  status: 'available-now' | 'foundation' | 'research';
  description: string;
};

type DiagnosticsResponse = {
  capabilities: Capability[];
  ecus: unknown[];
  dtcs: unknown[];
  dids: unknown[];
  mode: 'research' | 'live';
};

export default function Diagnostics() {
  const { data } = useQuery<DiagnosticsResponse>({ queryKey: ['/api/diagnostics'] });
  const capabilities = data?.capabilities ?? [];

  return (
    <DashboardLayout title="Diagnostics" subtitle="DoIP / UDS research foundation">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Capabilities" value={capabilities.length} icon={Activity} />
        <Metric label="Discovered ECUs" value={data?.ecus.length ?? 0} icon={Cpu} />
        <Metric label="DTCs" value={data?.dtcs.length ?? 0} icon={ShieldCheck} />
        <Metric label="DIDs" value={data?.dids.length ?? 0} icon={Database} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Diagnostic capability map</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {capabilities.map((capability) => (
            <div key={capability.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{capability.name}</p>
                <Badge>{capability.protocol}</Badge>
                <Badge>{capability.evidence}</Badge>
                <Badge>{capability.access}</Badge>
                <Badge>{capability.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{capability.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Live diagnostic inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No Lucid ECU addresses, DTC mappings, or proprietary DIDs are pre-filled. This page will only display values captured from a connected vehicle or independently confirmed research data.
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Activity }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 font-mono text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </CardContent>
    </Card>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{children}</span>;
}
