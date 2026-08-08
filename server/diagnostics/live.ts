import os from 'node:os';

export type LiveNetworkInterface = {
  name: string;
  address: string;
  family: string;
  mac: string;
  internal: boolean;
  cidr?: string | null;
  netmask: string;
  scopeid?: number;
  suggestedForAutomotiveEthernet: boolean;
};

function looksLikePhysicalEthernet(name: string): boolean {
  const normalized = name.toLowerCase();
  if (normalized.includes('loopback')) return false;
  if (normalized.includes('bluetooth')) return false;
  if (normalized.includes('wi-fi') || normalized.includes('wifi') || normalized.includes('wireless')) return false;
  if (normalized.includes('virtual') || normalized.includes('vmware') || normalized.includes('hyper-v')) return false;
  if (normalized.includes('docker') || normalized.includes('wsl')) return false;
  return normalized.includes('ethernet') || normalized.includes('local area connection') || normalized.startsWith('en');
}

export function listLiveNetworkInterfaces(): LiveNetworkInterface[] {
  const result: LiveNetworkInterface[] = [];
  const interfaces = os.networkInterfaces();

  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      result.push({
        name,
        address: entry.address,
        family: String(entry.family),
        mac: entry.mac,
        internal: entry.internal,
        cidr: entry.cidr,
        netmask: entry.netmask,
        ...('scopeid' in entry && typeof entry.scopeid === 'number' ? { scopeid: entry.scopeid } : {}),
        suggestedForAutomotiveEthernet: !entry.internal && String(entry.family) === 'IPv4' && looksLikePhysicalEthernet(name),
      });
    }
  }

  return result.sort((a, b) => {
    if (a.suggestedForAutomotiveEthernet !== b.suggestedForAutomotiveEthernet) {
      return a.suggestedForAutomotiveEthernet ? -1 : 1;
    }
    return a.name.localeCompare(b.name) || a.address.localeCompare(b.address);
  });
}

export function getLiveEnvironmentInfo() {
  return {
    platform: process.platform,
    release: os.release(),
    architecture: process.arch,
    hostname: os.hostname(),
    nodeVersion: process.version,
    readOnlyTransportImplemented: true,
    packetCaptureImplemented: true,
    socketTransmitImplemented: false,
    notes: [
      'Local network interfaces are enumerated through Node.js.',
      'Passive DoIP capture is implemented through TShark/Npcap when installed.',
      'The capture backend filters TCP/UDP port 13400 and feeds observed payloads into the existing DoIP/UDS decoders.',
      'No DoIP discovery, routing activation, UDS request, or other vehicle transmission is implemented by the live adapter.',
    ],
  };
}
