import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cable, Laptop, ShieldCheck, Save, Play, Square, Radio, Cpu } from 'lucide-react';
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

type CaptureInterface = { id: string; label: string; raw: string };

type UdsMessage = {
  serviceId: string;
  serviceName: string;
  direction: string;
  dids?: string[];
  routineId?: string;
  negativeResponseCode?: string;
  negativeResponseName?: string;
};

type LiveEvent = {
  id: number;
  timestamp: string;
  transport: 'tcp' | 'udp';
  sourceIp?: string;
  destinationIp?: string;
  decoded: {
    payloadType: string;
    payloadTypeName: string;
    vehicleAnnouncement?: { vin: string; logicalAddress: string; eid: string; gid: string };
    diagnosticMessage?: { sourceAddress: string; targetAddress: string; userDataHex: string; uds?: UdsMessage };
  };
};

type CaptureSnapshot = {
  running: boolean;
  interfaceId?: string | null;
  startedAt?: string | null;
  stoppedAt?: string | null;
  error?: string | null;
  stderrTail: string[];
  captureFilter: string;
  packetLines: number;
  doipFrames: number;
  totalBufferedEvents: number;
  latestEventId: number;
  events: LiveEvent[];
  ecuInventory: Array<{
    logicalAddress: string;
    messageCount: number;
    sentCount: number;
    receivedCount: number;
    ips: string[];
    vin?: string;
    eid?: string;
    gid?: string;
  }>;
  transmitEnabled: boolean;
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
  capture: {
    readiness: {
      installed: boolean;
      executable?: string | null;
      version?: string | null;
      captureFilter: string;
      activeTransmit: boolean;
      error?: string;
    };
    interfaces: CaptureInterface[];
    snapshot: CaptureSnapshot;
  };
};

type Session = {
  id: number;
  name: string;
  sourceType: string;
  platform?: string | null;
  interfaceName?: string | null;
  interfaceAddress?: string | null;
  packetCount?: number | null;
  doipFrameCount?: number | null;
  udsMessageCount?: number | null;
  ecuCount?: number | null;
  createdAt: string;
};

export default function LiveConnection() {
  const queryClient = useQueryClient();
  const { data, refetch: refetchLive } = useQuery<LiveResponse>({ queryKey: ['/api/diagnostics/live'] });
  const { data: capture, refetch: refetchCapture } = useQuery<CaptureSnapshot>({
    queryKey: ['/api/diagnostics/live/status'],
    refetchInterval: (query) => query.state.data?.running ? 1000 : 3000,
  });
  const { data: sessionData } = useQuery<{ sessions: Session[] }>({ queryKey: ['/api/diagnostics/sessions'] });
  const suggested = useMemo(() => data?.interfaces.filter((item) => item.suggestedForAutomotiveEthernet) ?? [], [data]);
  const [selected, setSelected] = useState('');
  const [captureInterfaceId, setCaptureInterfaceId] = useState('');
  const [saving, setSaving] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [message, setMessage] = useState('');

  const selectedInterface = data?.interfaces.find((item) => `${item.name}|${item.address}` === selected);
  const tsharkInterfaces = data?.capture.interfaces ?? [];
  const udsCount = capture?.events.filter((event) => event.decoded.diagnosticMessage?.uds).length ?? 0;

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
          notes: 'Interface selected for authorized read-only automotive Ethernet testing. No diagnostic transmission performed.',
        }),
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Unable to save session.');
      setMessage('Readiness session saved.');
      await queryClient.invalidateQueries({ queryKey: ['/api/diagnostics/sessions'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save session.');
    } finally { setSaving(false); }
  }

  async function startCapture() {
    if (!captureInterfaceId) return;
    setCaptureBusy(true); setMessage('');
    try {
      const response = await fetch('/api/diagnostics/live/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interfaceId: captureInterfaceId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to start passive capture.');
      setMessage('Passive DoIP capture started. Vehicle transmit remains disabled.');
      await refetchCapture();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start passive capture.');
    } finally { setCaptureBusy(false); }
  }

  async function stopCapture() {
    setCaptureBusy(true); setMessage('');
    try {
      const response = await fetch('/api/diagnostics/live/stop', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to stop passive capture.');
      setMessage('Passive capture stopped.');
      await refetchCapture();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to stop passive capture.');
    } finally { setCaptureBusy(false); }
  }

  async function saveCaptureSession() {
    if (!capture || !data) return;
    setSaving(true); setMessage('');
    try {
      const selectedCapture = tsharkInterfaces.find((item) => item.id === capture.interfaceId);
      const response = await fetch('/api/diagnostics/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Passive DoIP capture · ${new Date().toLocaleString()}`,
          sourceType: 'live-read-only-tshark',
          platform: data.environment.platform,
          interfaceName: selectedCapture?.label ?? capture.interfaceId ?? null,
          captureFormat: 'live-tshark',
          packetCount: capture.packetLines,
          doipFrameCount: capture.doipFrames,
          udsMessageCount: udsCount,
          ecuCount: capture.ecuInventory.length,
          notes: `Capture filter: ${capture.captureFilter}. Transmit enabled: ${capture.transmitEnabled}.`,
        }),
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Unable to save capture session.');
      setMessage('Capture summary saved to diagnostic session history.');
      await queryClient.invalidateQueries({ queryKey: ['/api/diagnostics/sessions'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save capture session.');
    } finally { setSaving(false); }
  }

  return (
    <DashboardLayout title="Live Connection" subtitle="Windows passive DoIP capture · transmit disabled">
      <div className="grid gap-4 md:grid-cols-4">
        <StatusCard icon={Laptop} title="Host" value={data ? `${data.environment.platform} · ${data.environment.architecture}` : '—'} />
        <StatusCard icon={Cable} title="Suggested Ethernet" value={suggested.length.toString()} />
        <StatusCard icon={Radio} title="TShark / Npcap" value={data?.capture.readiness.installed ? 'Ready' : 'Not ready'} />
        <StatusCard icon={ShieldCheck} title="Vehicle Transmit" value="DISABLED" />
      </div>

      <Card className="mt-6 border-green-500/20">
        <CardHeader><CardTitle className="text-sm">Passive live capture</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3 text-sm">
            <span className="font-medium text-green-400">READ ONLY:</span> this capture adapter listens through TShark/Npcap using filter <span className="font-mono">{data?.capture.readiness.captureFilter ?? 'tcp port 13400 or udp port 13400'}</span>. It does not send DoIP discovery, routing activation, UDS requests, or other traffic to the vehicle.
          </div>

          {!data?.capture.readiness.installed ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-300">
              {data?.capture.readiness.error ?? 'Install Wireshark with Npcap on the Windows laptop, then restart the dashboard.'}
              <Button variant="outline" className="ml-3" onClick={() => void refetchLive()}>Recheck</Button>
            </div>
          ) : (
            <>
              <select className="w-full rounded-md border border-border bg-background p-2 text-sm" value={captureInterfaceId} disabled={capture?.running} onChange={(e) => setCaptureInterfaceId(e.target.value)}>
                <option value="">Select TShark / Npcap interface…</option>
                {tsharkInterfaces.map((item) => <option key={item.id} value={item.id}>{item.id}. {item.label}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                {!capture?.running ? <Button onClick={startCapture} disabled={!captureInterfaceId || captureBusy}><Play className="mr-2 h-4 w-4" />Start passive capture</Button> : <Button variant="destructive" onClick={stopCapture} disabled={captureBusy}><Square className="mr-2 h-4 w-4" />Stop capture</Button>}
                <Button variant="outline" onClick={saveCaptureSession} disabled={!capture?.doipFrames || saving}><Save className="mr-2 h-4 w-4" />Save capture summary</Button>
              </div>
            </>
          )}

          <div className="grid gap-3 md:grid-cols-5">
            <Mini label="State" value={capture?.running ? 'CAPTURING' : 'Stopped'} />
            <Mini label="Packet rows" value={capture?.packetLines ?? 0} />
            <Mini label="DoIP frames" value={capture?.doipFrames ?? 0} />
            <Mini label="UDS decoded" value={udsCount} />
            <Mini label="ECU addresses" value={capture?.ecuInventory.length ?? 0} />
          </div>
          {capture?.error && <p className="text-sm text-red-400">{capture.error}</p>}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Cpu className="h-4 w-4" />Live ECU inventory</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground"><tr><th className="p-2">Logical address</th><th className="p-2">Messages</th><th className="p-2">Sent / Received</th><th className="p-2">IPs</th><th className="p-2">VIN</th></tr></thead>
              <tbody>
                {(capture?.ecuInventory ?? []).map((ecu) => <tr key={ecu.logicalAddress} className="border-t border-border"><td className="p-2 font-mono">{ecu.logicalAddress}</td><td className="p-2 font-mono">{ecu.messageCount}</td><td className="p-2 font-mono">{ecu.sentCount} / {ecu.receivedCount}</td><td className="p-2 font-mono">{ecu.ips.join(', ') || '—'}</td><td className="p-2 font-mono">{ecu.vin || '—'}</td></tr>)}
                {!capture?.ecuInventory.length && <tr><td colSpan={5} className="p-3 text-muted-foreground">No DoIP logical addresses observed yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-sm">Recent DoIP / UDS events</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground"><tr><th className="p-2">Time</th><th className="p-2">Network</th><th className="p-2">DoIP</th><th className="p-2">ECU</th><th className="p-2">UDS</th></tr></thead>
              <tbody>
                {(capture?.events ?? []).slice(-100).reverse().map((event) => {
                  const diagnostic = event.decoded.diagnosticMessage;
                  const uds = diagnostic?.uds;
                  return <tr key={event.id} className="border-t border-border"><td className="p-2 font-mono">{new Date(event.timestamp).toLocaleTimeString()}</td><td className="p-2 font-mono">{event.transport.toUpperCase()} {event.sourceIp || '?'} → {event.destinationIp || '?'}</td><td className="p-2 font-mono">{event.decoded.payloadType}</td><td className="p-2 font-mono">{diagnostic ? `${diagnostic.sourceAddress} → ${diagnostic.targetAddress}` : event.decoded.vehicleAnnouncement?.logicalAddress ?? '—'}</td><td className="p-2">{uds ? `${uds.serviceId} · ${uds.serviceName} · ${uds.direction}` : '—'}</td></tr>;
                })}
                {!capture?.events.length && <tr><td colSpan={5} className="p-3 text-muted-foreground">No captured DoIP events yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-sm">Windows network readiness</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">The OS interface list helps identify which Windows Ethernet adapter corresponds to the RAD-Moon/media-converter connection. TShark/Npcap uses its own capture interface identifiers above.</p>
          <select className="w-full rounded-md border border-border bg-background p-2 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Select OS interface…</option>
            {(data?.interfaces ?? []).map((item) => <option key={`${item.name}|${item.address}`} value={`${item.name}|${item.address}`}>{item.suggestedForAutomotiveEthernet ? '★ ' : ''}{item.name} · {item.address} · {item.mac}</option>)}
          </select>
          <Button variant="outline" onClick={saveSession} disabled={!selectedInterface || saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : 'Save readiness session'}</Button>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <Row label="Hostname" value={data?.environment.hostname ?? '—'} />
            <Row label="OS release" value={data?.environment.release ?? '—'} />
            <Row label="Node.js" value={data?.environment.nodeVersion ?? '—'} />
            <Row label="TShark" value={data?.capture.readiness.version ?? 'Not detected'} />
            <Row label="Capture backend" value={data?.capture.readiness.installed ? 'TShark + Npcap' : 'Unavailable'} />
            <Row label="Vehicle transmit" value="Disabled by design" />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-sm">Recent diagnostic sessions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(sessionData?.sessions ?? []).slice(0, 10).map((session) => <div key={session.id} className="rounded-md border border-border p-3 text-sm"><div className="font-medium">{session.name}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{session.interfaceName || '—'} · {session.interfaceAddress || '—'} · DoIP {session.doipFrameCount ?? 0} · ECU {session.ecuCount ?? 0} · {new Date(session.createdAt).toLocaleString()}</div></div>)}
          {!sessionData?.sessions?.length && <p className="text-sm text-muted-foreground">No diagnostic sessions saved yet.</p>}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

function StatusCard({ icon: Icon, title, value }: { icon: typeof Laptop; title: string; value: string }) { return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 font-mono text-lg font-bold">{value}</p></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 rounded-md border border-border p-2"><span className="text-muted-foreground">{label}</span><span className="font-mono text-right">{value}</span></div>; }
function Mini({ label, value }: { label: string; value: string | number }) { return <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-mono text-lg font-bold">{value}</p></div>; }
