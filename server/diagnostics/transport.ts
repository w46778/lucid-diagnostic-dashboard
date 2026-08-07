export type DiagnosticSourceKind = 'offline-pcap' | 'offline-pcapng' | 'offline-hex' | 'live-read-only';

export type CapturedNetworkFrame = {
  timestampMicros?: number;
  transport: 'udp' | 'tcp' | 'unknown';
  sourceIp?: string;
  destinationIp?: string;
  sourcePort?: number;
  destinationPort?: number;
  tcpSequence?: number;
  payload: Buffer;
};

export type DiagnosticCaptureSource = {
  kind: DiagnosticSourceKind;
  label: string;
  readOnly: true;
  description?: string;
};

export const captureSources: DiagnosticCaptureSource[] = [
  {
    kind: 'offline-hex',
    label: 'Offline DoIP hex frame',
    readOnly: true,
    description: 'Parses a complete DoIP frame supplied as hexadecimal text.',
  },
  {
    kind: 'offline-pcap',
    label: 'Classic PCAP capture',
    readOnly: true,
    description: 'Parses captured Ethernet traffic without opening a vehicle connection.',
  },
  {
    kind: 'offline-pcapng',
    label: 'PCAPNG capture',
    readOnly: true,
    description: 'Parses Wireshark PCAPNG capture blocks without transmitting traffic.',
  },
  {
    kind: 'live-read-only',
    label: 'Future live read-only adapter',
    readOnly: true,
    description: 'Reserved for an authorized future capture adapter that feeds the same normalized frame pipeline.',
  },
];
