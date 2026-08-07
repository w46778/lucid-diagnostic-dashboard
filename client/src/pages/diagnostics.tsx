import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Cpu, Database, ShieldCheck, Network, Search } from 'lucide-react';
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

export default function Diagnostics() {
  const { data } = useQuery<DiagnosticsResponse>({ queryKey: ['/api/diagnostics'] });
  const capabilities = data?.capabilities ?? [];
  const [hex, setHex] = useState('');
  const [decoded, setDecoded] = useState<DecodedFrame | null>(null);
  const [decodeError, setDecodeError] = useState('');
  const [decoding, setDecoding] = useState(false);

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
          <CardTitle className="flex items-center gap-2 text-sm">
            <Network className="h-4 w-4 text-primary" /> Offline DoIP Capture Decoder
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

function DecodedFrameCard({ frame }: { frame: DecodedFrame }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-4 text-sm">
      <div className="grid gap-2 md:grid-cols-2">
        <Result label="Protocol version" value={frame.protocolVersion} />
        <Result label="Header inverse valid" value={frame.inverseVersionValid ? 'Yes' : 'No'} />
        <Result label="Payload type" value={`${frame.payloadType} · ${frame.payloadTypeName}`} />
        <Result label="Payload length" value={`${frame.payloadLength} bytes`} />
      </div>
      {frame.vehicleAnnouncement && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 font-medium">Vehicle announcement / identification response</p>
          <div className="grid gap-2 md:grid-cols-2">
            <Result label="VIN" value={frame.vehicleAnnouncement.vin || '—'} />
            <Result label="Logical address" value={frame.vehicleAnnouncement.logicalAddress} />
            <Result label="EID" value={frame.vehicleAnnouncement.eid} />
            <Result label="GID" value={frame.vehicleAnnouncement.gid} />
            <Result label="Further action" value={frame.vehicleAnnouncement.furtherActionCode} />
            {frame.vehicleAnnouncement.vinGidSyncStatus && <Result label="VIN/GID sync" value={frame.vehicleAnnouncement.vinGidSyncStatus} />}
          </div>
        </div>
      )}
      {frame.diagnosticMessage && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 font-medium">Diagnostic envelope</p>
          <div className="grid gap-2 md:grid-cols-2">
            <Result label="Source address" value={frame.diagnosticMessage.sourceAddress} />
            <Result label="Target address" value={frame.diagnosticMessage.targetAddress} />
          </div>
          <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{frame.diagnosticMessage.userDataHex}</p>
        </div>
      )}
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return <div><span className="text-muted-foreground">{label}: </span><span className="font-mono">{value}</span></div>;
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
