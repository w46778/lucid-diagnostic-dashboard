import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cable, Laptop, ShieldCheck, Save } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type LiveInterface = {
  name: string;
  address: string;
  family: string;
  mac: string;
  internal: boolean;
  cidr?: string | null;
  netmask: string;
  suggestedForAutomotiveEthernet: boolean;
};

type LiveResponse = {
  environment: {
    platform: string;
    release: string;
    architecture: string;
    hostname: string;
    nodeVersion: string;
    readOnlyTransportImplemented: boolean;
    packetCaptureImplemented: boolean;
    socketTransmitImplemented: boolean;
    notes: string[];
  };
  interfaces: LiveInterface[];
};

type Session = {
  id: number;
  name: string;
  sourceType: string;
  platform?: string | null;
  interfaceName?: string | null;
  interfaceAddress?: string | null;
  createdAt: string;
};

export default function LiveConnection() {
  const queryClient = useQueryClient();
  const { data } = useQuery<LiveResponse>({ queryKey: ['/api/diagnostics/live'] });
  const { data: sessionData } = useQuery<{ sessions: Session[] }>({ queryKey: ['/api/diagnostics/sessions'] });
  const suggested = useMemo(() => data?.interfaces.filter((item) => item.suggestedForAutomotiveEthernet) ?? [], [data]);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedInterface = data?.interfaces.find((item) => `${item.name}|${item.address}` === selected);

  async function saveSession() {
    if (!selectedInterface || !data) return;
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/diagnostics/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Live readiness · ${selectedInterface.name}`,
          sourceType: 'live-read-only-readiness',
          platform: data.environment.platform,
          interfaceName: selectedInterface.name,
          interfaceAddress: selectedInterface.address,
          notes: 'Interface selected for future authorized read-only automotive Ethernet testing. No capture or diagnostic transmission performed.',
        }),
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Unable to save session.');
      setMessage('Readiness session saved.');
      await queryClient.invalidateQueries({ queryKey: ['/api/diagnostics/sessions'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save session.');
    } finally { setSaving(false); }
  }

  return (
    <DashboardLayout title="Live Connection" subtitle="Windows-ready read-only diagnostic transport preparation">
      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard icon={Laptop} title="Host" value={data ? `${data.environment.platform} · ${data.environment.architecture}` : '—'} />
        <StatusCard icon={Cable} title="Suggested Ethernet" value={suggested.length.toString()} />
        <StatusCard icon={ShieldCheck} title="Transmit" value={data?.environment.socketTransmitImplemented ? 'Enabled' : 'Disabled'} />
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-sm">Network interfaces</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Select the physical Ethernet adapter that will later connect to the automotive Ethernet media converter. This page only enumerates local adapters; it does not open a packet-capture handle or transmit traffic.</p>
          <select className="w-full rounded-md border border-border bg-background p-2 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Select interface…</option>
            {(data?.interfaces ?? []).map((item) => <option key={`${item.name}|${item.address}`} value={`${item.name}|${item.address}`}>{item.suggestedForAutomotiveEthernet ? '★ ' : ''}{item.name} · {item.address} · {item.mac}</option>)}
          </select>
          <Button onClick={saveSession} disabled={!selectedInterface || saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : 'Save readiness session'}</Button>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-sm">Host readiness</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <Row label="Hostname" value={data?.environment.hostname ?? '—'} />
          <Row label="OS release" value={data?.environment.release ?? '—'} />
          <Row label="Node.js" value={data?.environment.nodeVersion ?? '—'} />
          <Row label="Packet capture" value={data?.environment.packetCaptureImplemented ? 'Implemented' : 'Next step'} />
          <Row label="Read-only transport" value={data?.environment.readOnlyTransportImplemented ? 'Implemented' : 'Next step'} />
          <Row label="Vehicle transmit" value={data?.environment.socketTransmitImplemented ? 'Enabled' : 'Disabled'} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-sm">Recent diagnostic sessions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(sessionData?.sessions ?? []).slice(0, 10).map((session) => <div key={session.id} className="rounded-md border border-border p-3 text-sm"><div className="font-medium">{session.name}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{session.interfaceName || '—'} · {session.interfaceAddress || '—'} · {new Date(session.createdAt).toLocaleString()}</div></div>)}
          {!sessionData?.sessions?.length && <p className="text-sm text-muted-foreground">No diagnostic sessions saved yet.</p>}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

function StatusCard({ icon: Icon, title, value }: { icon: typeof Laptop; title: string; value: string }) { return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 font-mono text-lg font-bold">{value}</p></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 rounded-md border border-border p-2"><span className="text-muted-foreground">{label}</span><span className="font-mono text-right">{value}</span></div>; }
