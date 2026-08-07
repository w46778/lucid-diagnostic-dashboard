export type DiagnosticSourceKind = 'offline-pcap' | 'offline-hex' | 'live-read-only';

export type CapturedNetworkFrame = {
  timestampMicros?: number;
  transport: 'udp' | 'tcp' | 'unknown';
  sourceIp?: string;
  destinationIp?: string;
  sourcePort?: number;
  destinationPort?: number;
  payload: Buffer;
};

export type DiagnosticCaptureSource = {
  kind: DiagnosticSourceKind;
  label: string;
  readOnly: true