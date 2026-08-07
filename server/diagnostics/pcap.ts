import { decodeDoipFrame, DOIP_DEFAULT_PORT, type DecodedDoipFrame } from './doip';
import type { CapturedNetworkFrame } from './transport';

export type DoipCaptureRecord = {
  timestampMicros?: number;
  transport: 'udp' | 'tcp' | 'unknown';
  sourceIp?: string;
  destinationIp?: string;
  sourcePort?: number;
  destinationPort?: number;
  decoded: DecodedDoipFrame;
};

export type EcuEndpointSummary = {
  logicalAddress: string;
  messageCount: number;
  sentCount: number;
  receivedCount: number;
  ips: string[];
  transports: string[];
  vin?: string;
  eid?: string;
  gid?: string;
};

export type PcapAnalysis = {
  sourceFormat: 'pcap';
  packetCount: number;
  networkFrames: number;
  doipFrames: number;
  parseErrors: string[];
  frames: DoipCaptureRecord[];
  ecuInventory: EcuEndpointSummary[];
};

function ip4(buffer: Buffer, offset: number): string {
  return `${buffer[offset]}.${buffer[offset + 1]}.${buffer[offset + 2]}.${buffer[offset + 3]}`;
}

function decodeEthernetPacket(packet: Buffer): CapturedNetworkFrame | undefined {
  if (packet.length < 14) return undefined;
  let etherType = packet.readUInt16BE(12);
  let offset = 14;

  if (etherType === 0x8100 && packet.length >= 18) {
    etherType = packet.readUInt16BE(16);
    offset = 18;
  }

  if (etherType !== 0x0800 || packet.length < offset + 20) return undefined;
  const versionIhl = packet[offset];
  if ((versionIhl >> 4) !== 4) return undefined;
  const ihl = (versionIhl & 0x0f) * 4;
  if (ihl < 20 || packet.length < offset + ihl) return undefined;

  const protocol = packet[offset + 9];
  const sourceIp = ip4(packet, offset + 12);
  const destinationIp = ip4(packet, offset + 16);
  const transportOffset = offset + ihl;

  if (protocol === 17) {
    if (packet.length < transportOffset + 8) return undefined;
    const sourcePort = packet.readUInt16BE(transportOffset);
    const destinationPort = packet.readUInt16BE(transportOffset + 2);
    return {
      transport: 'udp',
      sourceIp,
      destinationIp,
      sourcePort,
      destinationPort,
      payload: packet.subarray(transportOffset + 8),
    };
  }

  if (protocol === 6) {
    if (packet.length < transportOffset + 20) return undefined;
    const sourcePort = packet.readUInt16BE(transportOffset);
    const destinationPort = packet.readUInt16BE(transportOffset + 2);
    const tcpHeaderLength = ((packet[transportOffset + 12] >> 4) & 0x0f) * 4;
    if (tcpHeaderLength < 20 || packet.length < transportOffset + tcpHeaderLength) return undefined;
    return {
      transport: 'tcp',
      sourceIp,
      destinationIp,
      sourcePort,
      destinationPort,
      payload: packet.subarray(transportOffset + tcpHeaderLength),
    };
  }

  return undefined;
}

function splitDoipPayload(payload: Buffer): Buffer[] {
  const frames: Buffer[] = [];
  let offset = 0;
  while (offset + 8 <= payload.length) {
    const protocolVersion = payload[offset];
    const inverse = payload[offset + 1];
    if (((protocolVersion ^ inverse) & 0xff) !== 0xff) break;
    const payloadLength = payload.readUInt32BE(offset + 4);
    const frameLength = 8 + payloadLength;
    if (frameLength < 8 || offset + frameLength > payload.length) break;
    frames.push(payload.subarray(offset, offset + frameLength));
    offset += frameLength;
  }
  return frames;
}

function buildInventory(records: DoipCaptureRecord[]): EcuEndpointSummary[] {
  const byAddress = new Map<string, EcuEndpointSummary>();

  const touch = (address: string, direction: 'sent' | 'received', record: DoipCaptureRecord) => {
    const current = byAddress.get(address) ?? {
      logicalAddress: address,
      messageCount: 0,
      sentCount: 0,
      receivedCount: 0,
      ips: [],
      transports: [],
    };
    current.messageCount += 1;
    if (direction === 'sent') current.sentCount += 1;
    else current.receivedCount += 1;
    for (const ip of [record.sourceIp, record.destinationIp]) {
      if (ip && !current.ips.includes(ip)) current.ips.push(ip);
    }
    if (!current.transports.includes(record.transport)) current.transports.push(record.transport);
    byAddress.set(address, current);
    return current;
  };

  for (const record of records) {
    const announcement = record.decoded.vehicleAnnouncement;
    if (announcement) {
      const current = touch(announcement.logicalAddress, 'sent', record);
      current.vin = announcement.vin || current.vin;
      current.eid = announcement.eid;
      current.gid = announcement.gid;
    }

    const diagnostic = record.decoded.diagnosticMessage;
    if (diagnostic) {
      touch(diagnostic.sourceAddress, 'sent', record);
      touch(diagnostic.targetAddress, 'received', record);
    }
  }

  return [...byAddress.values()].sort((a, b) => a.logicalAddress.localeCompare(b.logicalAddress));
}

export function analyzeClassicPcap(input: Buffer): PcapAnalysis {
  if (input.length < 24) throw new Error('PCAP file is shorter than the global header.');

  const magicLe = input.readUInt32LE(0);
  const magicBe = input.readUInt32BE(0);
  let littleEndian: boolean;
  let timestampIsNanoseconds = false;

  if (magicLe === 0xa1b2c3d4) littleEndian = true;
  else if (magicBe === 0xa1b2c3d4) littleEndian = false;
  else if (magicLe === 0xa1b23c4d) {
    littleEndian = true;
    timestampIsNanoseconds = true;
  } else if (magicBe === 0xa1b23c4d) {
    littleEndian = false;
    timestampIsNanoseconds = true;
  } else {
    throw new Error('Unsupported capture format. This analyzer currently accepts classic PCAP, not PCAPNG.');
  }

  const readU32 = (offset: number) => littleEndian ? input.readUInt32LE(offset) : input.readUInt32BE(offset);
  const linkType = readU32(20);
  if (linkType !== 1) throw new Error(`Unsupported PCAP link type ${linkType}. Ethernet (DLT_EN10MB=1) is required.`);

  const records: DoipCaptureRecord[] = [];
  const parseErrors: string[] = [];
  let packetCount = 0;
  let networkFrames = 0;
  let offset = 24;

  while (offset + 16 <= input.length) {
    const tsSec = readU32(offset);
    const tsFraction = readU32(offset + 4);
    const capturedLength = readU32(offset + 8);
    offset += 16;
    if (offset + capturedLength > input.length) {
      parseErrors.push(`Packet ${packetCount + 1}: capture ended before declared packet length.`);
      break;
    }

    packetCount += 1;
    const packet = input.subarray(offset, offset + capturedLength);
    offset += capturedLength;
    const network = decodeEthernetPacket(packet);
    if (!network) continue;
    networkFrames += 1;

    if (network.sourcePort !== DOIP_DEFAULT_PORT && network.destinationPort !== DOIP_DEFAULT_PORT) continue;
    const doipBuffers = splitDoipPayload(network.payload);
    for (const buffer of doipBuffers) {
      try {
        records.push({
          ...network,
          timestampMicros: tsSec * 1_000_000 + (timestampIsNanoseconds ? Math.floor(tsFraction / 1000) : tsFraction),
          decoded: decodeDoipFrame(buffer.toString('hex')),
        });
      } catch (error) {
        parseErrors.push(`Packet ${packetCount}: ${error instanceof Error ? error.message : 'unknown DoIP parse error'}`);
      }
    }
  }

  return {
    sourceFormat: 'pcap',
    packetCount,
    networkFrames,
    doipFrames: records.length,
    parseErrors: parseErrors.slice(0, 100),
    frames: records,
    ecuInventory: buildInventory(records),
  };
}
