import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Cpu, Database, ShieldCheck, Network, Search, Upload } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

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
  doip?: {
    mode: string;
    defaultPort: number;
    supportedDecoders: string[];
    doesTransmitToVehicle: boolean;
  };
};

type DecodedFrame = {
  protocolVersion: string;
  inverseVersionValid: boolean;
  payloadType: string;
  payloadTypeName: string;
  payloadLength: number;
  payloadHex: string;
  vehicleAnnouncement?: {
    vin: string;
    logicalAddress: string;
    eid: string;
    gid: string;
    furtherActionCode: string;
    vinGidSyncStatus?: string;
  };
  diagnosticMessage?: {
    sourceAddress: string;
    targetAddress: string;
    userDataHex: string;
  };
};

type PcapAnalysis = {
  packetCount: number;
  networkFrames: number;
  doipFrames: number;
  parseErrors: string[];
  ecuInventory: Array<{
    logicalAddress: string;
    messageCount: number;
    sentCount: number;
    receivedCount: number;
    ips: string[];
    transports: string[];
    vin?: string;
    eid?: string;
    gid?: string;
  }>;
  frames: Array<{
    transport: string;
    sourceIp?: string;
    destinationIp?: string;
    sourcePort?: number;
    destinationPort?: number;
    decoded: DecodedFrame;
  }>;
};

export default function Diagnostics() {
  const { data } = useQuery<DiagnosticsResponse>({ queryKey: ['/api/diagnostics'] });
  const capabilities = data?.capabilities ?? [];
  const [hex, setHex] = useState('');
  const [decoded, setDecoded] = useState<DecodedFrame | null>(null);
  const [decodeError, setDecodeError] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [pcap, setPcap] = useState<PcapAnalysis | null>(null);
  const [pcapError, setPcapError] = useState('');
  const [pcapLoading, setPcapLoading] = useState(false);

  async function decodeCapture() {
    setDecoding(true);
    setDecodeError('');
    setDecoded(null);
    try {
      const response = await fetch('/api/diagnostics/doip/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hex }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to decode frame.');
      setDecoded(body.frame);
    } catch (error) {
      setDecodeError(error instanceof Error ? error.message : 'Unable to decode frame.');
    } finally {
      setDecoding(false);
    }
  }

  async function analyzePcap(file: File) {
    setPcapLoading(true);
    setPcapError('');
    setPcap(null);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('PCAP exceeds the 25 MB inline analysis limit.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const response = await fetch('/api/diagnostics/pcap/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: btoa(binary) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to analyze PCAP.');
      setPcap(body);
    } catch (error) {
      setPcapError(error instanceof Error ? error.message : 'Unable to analyze PCAP.');
    } finally {
      setPcapLoading(false);
    }
  }

  const discoveredCount = pcap?.ecuInventory.length ?? data?.ecus.length ?? 0;

  return (
    <DashboardLayout title="Diagnostics" subtitle="DoIP / UDS research foundation">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Capabilities" value={capabilities.length} icon={Activity} />
        <Metric label="Discovered ECUs" value={discoveredCount} icon={Cpu} />
        <Metric label="DTCs" value={data?.dtcs.length ?? 0} icon={ShieldCheck} />
        <Metric label="DIDs" value={data?.dids.length ?? 0} icon={Database} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Upload className="h-4 w-4 text-primary" /> PCAP DoIP Analyzer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Load an offline classic PCAP capture. The analyzer extracts Ethernet/IPv4 TCP or UDP traffic on DoIP port 13400, decodes complete DoIP frames, and builds an ECU logical-address inventory. No network connection to a vehicle is opened.
          </p>
          <input
            type="file"
            accept=".pcap,application/vnd.tcpdump.pcap"
            disabled={pcapLoading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void analyzePcap(file);
            }}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
          />
          {pcapLoading && <p className="text-sm text-muted-foreground">Analyzing capture…</p>}
          {pcapError && <p className="text-sm text-red-400">{pcapError}</p>}
          {pcap && <PcapResults analysis={pcap} />}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Network className="h-4 w-4 text-primary" /> Offline DoIP Frame Decoder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste a complete DoIP frame as hexadecimal bytes. The decoder works offline on supplied capture data only and does not connect to or transmit anything to a vehicle.
          </p>
          <Textarea
            value={hex}
            onChange={(event) => setHex(event.target.value)}
            placeholder="02 FD 00 04 00 00 00 20 ..."
            className="min-h-28 font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <Button onClick={decodeCapture} disabled={!hex.trim() || decoding}>
              <Search className="mr-2 h-4 w-4" /> {decoding ? 'Decoding…' : 'Decode frame'}
            </Button>
            <span className="text-xs text-muted-foreground">DoIP default port: {data?.doip?.defaultPort ?? 13400}</span>
          </div>
          {decodeError && <p className="text-sm text-red-400">{decodeError}</p>}
          {decoded && <DecodedFrameCard frame={decoded} />}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-sm">Diagnostic capability map</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {capabilities.map((capability) => (
            <div key={capability.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{capability.name}</p>
                <Badge>{capability.protocol}</Badge><Badge>{capability.evidence}</Badge><Badge>{capability.access}</Badge><Badge>{capability.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{capability.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

function PcapResults({ analysis }: { analysis: PcapAnalysis }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <SmallMetric label="Packets" value={analysis.packetCount} />
        <SmallMetric label="IPv4 TCP/UDP" value={analysis.networkFrames} />
        <SmallMetric label="DoIP frames" value={analysis.doipFrames} />
        <SmallMetric label="ECU addresses" value={analysis.ecuInventory.length} />
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr><th className="p-2">Logical address</th><th className="p-2">Messages</th><th className="p-2">Sent / Received</th><th className="p-2">IPs</th><th className="p-2">Transport</th><th className="p-2">VIN</th></tr>
          </thead>
          <tbody>
            {analysis.ecuInventory.map((ecu) => (
              <tr key={ecu.logicalAddress} className="border-t border-border">
                <td className="p-2 font-mono">{ecu.logicalAddress}</td>
                <td className="p-2 font-mono">{ecu.messageCount}</td>
                <td className="p-2 font-mono">{ecu.sentCount} / {ecu.receivedCount}</td>
                <td className="p-2 font-mono">{ecu.ips.join(', ') || '—'}</td>
                <td className="p-2">{ecu.transports.join(', ')}</td>
                <td className="p-2 font-mono">{ecu.vin || '—'}</td>
              </tr>
            ))}
            {!analysis.ecuInventory.length && <tr><td className="p-3 text-muted-foreground" colSpan={6}>No ECU logical addresses were discovered in complete DoIP frames.</td></tr>}
          </tbody>
        </table>
      </div>
      {analysis.parseErrors.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
          {analysis.parseErrors.length} parse warning(s). First: {analysis.parseErrors[0]}
        </div>
      )}
    </div>
  );
}

function DecodedFrameCard({ frame }: { frame: DecodedFrame }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-4 text-sm">
      <div className="grid gap-2 md:grid-cols-2">
        <Result label="Protocol version" value={frame.protocolVersion} />
        <Result label="Header inverse valid" value={frame.inverseVersionValid ? 'Yes' : 'No'} />
        <Result label="Payload type" value={`${frame.payloadType} · ${frame.payloadTypeName}`} />
        <Result label="Payload length" value={`${frame.payloadLength} bytes`} />
      </div>
      {frame.vehicleAnnouncement && <div className="mt-4 border-t border-border pt-4"><p className="mb-2 font-medium">Vehicle announcement / identification response</p><div className="grid gap-2 md:grid-cols-2"><Result label="VIN" value={frame.vehicleAnnouncement.vin || '—'} /><Result label="Logical address" value={frame.vehicleAnnouncement.logicalAddress} /><Result label="EID" value={frame.vehicleAnnouncement.eid} /><Result label="GID" value={frame.vehicleAnnouncement.gid} /></div></div>}
      {frame.diagnosticMessage && <div className="mt-4 border-t border-border pt-4"><p className="mb-2 font-medium">Diagnostic envelope</p><div className="grid gap-2 md:grid-cols-2"><Result label="Source address" value={frame.diagnosticMessage.sourceAddress} /><Result label="Target address" value={frame.diagnosticMessage.targetAddress} /></div><p className="mt-3 break-all font-mono text-xs text-muted-foreground">{frame.diagnosticMessage.userDataHex}</p></div>}
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) { return <div><span className="text-muted-foreground">{label}: </span><span className="font-mono">{value}</span></div>; }
function SmallMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-md border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-mono text-lg font-bold">{value}</p></div>; }
function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Activity }) { return <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-mono text-2xl font-bold">{value}</p></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>; }
function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{children}</span>; }
