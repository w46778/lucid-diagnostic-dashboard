import { decodeDoipFrame, DOIP_DEFAULT_PORT, type DecodedDoipFrame } from './doip';
import type { CapturedNetworkFrame } from './transport';
import { extractPcapngPackets } from './pcapng';

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
  sourceFormat: 'pcap' | 'pcapng';
  packetCount: number;
  networkFrames: number;
  doipFrames: number;
  tcpStreams: number;
  parseErrors: string[];
  frames: DoipCaptureRecord[];
  ecuInventory: EcuEndpointSummary[];
};

type RawPacket = { timestampMicros?: number; data: Buffer };

function ip4(buffer: Buffer, offset: number): string {
  return `${buffer[offset]}.${buffer[offset + 1]}.${buffer[offset + 2]}.${buffer[offset + 3]}`;
}

function decodeEthernetPacket(packet: Buffer): CapturedNetworkFrame | undefined {
  if (packet.length < 14) return undefined;
  let etherType = packet.readUInt16BE(12);
  let offset = 14;

  if ((etherType === 0x8100 || etherType === 0x88a8) && packet.length >= 18) {
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
    const udpLength = packet.readUInt16BE(transportOffset + 4);
    const payloadEnd = Math.min(packet.length, transportOffset + Math.max(8, udpLength));
    return {
      transport: 'udp', sourceIp, destinationIp, sourcePort, destinationPort,
      payload: packet.subarray(transportOffset + 8, payloadEnd),
    };
  }

  if (protocol === 6) {
    if (packet.length < transportOffset + 20) return undefined;
    const sourcePort = packet.readUInt16BE(transportOffset);
    const destinationPort = packet.readUInt16BE(transportOffset + 2);
    const tcpSequence = packet.readUInt32BE(transportOffset + 4);
    const tcpHeaderLength = ((packet[transportOffset + 12] >> 4) & 0x0f) * 4;
    if (tcpHeaderLength < 20 || packet.length < transportOffset + tcpHeaderLength) return undefined;
    return {
      transport: 'tcp', sourceIp, destinationIp, sourcePort, destinationPort, tcpSequence,
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
    if (((protocolVersion ^ inverse) & 0xff) !== 0xff) {
      offset += 1;
      continue;
    }
    const payloadLength = payload.readUInt32BE(offset + 4);
    const frameLength = 8 + payloadLength;
    if (frameLength < 8 || frameLength > 16 * 1024 * 1024) {
      offset += 1;
      continue;
    }
    if (offset + frameLength > payload.length) break;
    frames.push(payload.subarray(offset, offset + frameLength));
    offset += frameLength;
  }
  return frames;
}

function buildInventory(records: DoipCaptureRecord[]): EcuEndpointSummary[] {
  const byAddress = new Map<string, EcuEndpointSummary>();
  const touch = (address: string, direction: 'sent' | 'received', record: DoipCaptureRecord) => {
    const current = byAddress.get(address) ?? {
      logicalAddress: address, messageCount: 0, sentCount: 0, receivedCount: 0, ips: [], transports: [],
    };
    current.messageCount += 1;
    if (direction === 'sent') current.sentCount += 1; else current.receivedCount += 1;
    for (const ip of [record.sourceIp, record.destinationIp]) if (ip && !current.ips.includes(ip)) current.ips.push(ip);
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

function streamKey(frame: CapturedNetworkFrame): string {
  return `${frame.sourceIp}:${frame.sourcePort}>${frame.destinationIp}:${frame.destinationPort}`;
}

function reassembleTcp(frames: Array<CapturedNetworkFrame & { timestampMicros?: number }>): Array<CapturedNetworkFrame & { timestampMicros?: number }> {
  const groups = new Map<string, Array<CapturedNetworkFrame & { timestampMicros?: number }>>();
  for (const frame of frames) {
    if (frame.transport !== 'tcp' || frame.tcpSequence === undefined || !frame.payload.length) continue;
    const key = streamKey(frame);
    const group = groups.get(key) ?? [];
    group.push(frame);
    groups.set(key, group);
  }

  const streams: Array<CapturedNetworkFrame & { timestampMicros?: number }> = [];
  for (const group of groups.values()) {
    group.sort((a, b) => (a.tcpSequence ?? 0) - (b.tcpSequence ?? 0));
    const chunks: Buffer[] = [];
    let nextSequence: number | undefined;
    for (const segment of group) {
      const seq = segment.tcpSequence!;
      if (nextSequence === undefined) {
        chunks.push(segment.payload);
        nextSequence = seq + segment.payload.length;
        continue;
      }
      if (seq > nextSequence) {
        chunks.push(segment.payload);
        nextSequence = seq + segment.payload.length;
      } else if (seq === nextSequence) {
        chunks.push(segment.payload);
        nextSequence += segment.payload.length;
      } else {
        const overlap = nextSequence - seq;
        if (overlap < segment.payload.length) {
          chunks.push(segment.payload.subarray(overlap));
          nextSequence += segment.payload.length - overlap;
        }
      }
    }
    const first = group[0];
    streams.push({ ...first, payload: Buffer.concat(chunks) });
  }
  return streams;
}

function analyzePackets(sourceFormat: 'pcap' | 'pcapng', packets: RawPacket[], initialWarnings: string[] = []): PcapAnalysis {
  const parseErrors = [...initialWarnings];
  const networkFrames: Array<CapturedNetworkFrame & { timestampMicros?: number }> = [];
  for (const packet of packets) {
    const frame = decodeEthernetPacket(packet.data);
    if (frame) networkFrames.push({ ...frame, timestampMicros: packet.timestampMicros });
  }

  const relevant = networkFrames.filter((frame) => frame.sourcePort === DOIP_DEFAULT_PORT || frame.destinationPort === DOIP_DEFAULT_PORT);
  const udp = relevant.filter((frame) => frame.transport === 'udp');
  const tcpStreams = reassembleTcp(relevant);
  const candidates = [...udp, ...tcpStreams];
  const records: DoipCaptureRecord[] = [];

  for (const network of candidates) {
    for (const buffer of splitDoipPayload(network.payload)) {
      try {
        records.push({
          transport: network.transport,
          sourceIp: network.sourceIp,
          destinationIp: network.destinationIp,
          sourcePort: network.sourcePort,
          destinationPort: network.destinationPort,
          timestampMicros: network.timestampMicros,
          decoded: decodeDoipFrame(buffer.toString('hex')),
        });
      } catch (error) {
        parseErrors.push(error instanceof Error ? error.message : 'Unknown DoIP parse error');
      }
    }
  }

  return {
    sourceFormat,
    packetCount: packets.length,
    networkFrames: networkFrames.length,
    doipFrames: records.length,
    tcpStreams: tcpStreams.length,
    parseErrors: parseErrors.slice(0, 100),
    frames: records,
    ecuInventory: buildInventory(records),
  };
}

function extractClassicPcap(input: Buffer): RawPacket[] {
  if (input.length < 24) throw new Error('PCAP file is shorter than the global header.');
  const magicLe = input.readUInt32LE(0);
  const magicBe = input.readUInt32BE(0);
  let littleEndian: boolean;
  let timestampIsNanoseconds = false;
  if (magicLe === 0xa1b2c3d4) littleEndian = true;
  else if (magicBe === 0xa1b2c3d4) littleEndian = false;
  else if (magicLe === 0xa1b23c4d) { littleEndian = true; timestampIsNanoseconds = true; }
  else if (magicBe === 0xa1b23c4d) { littleEndian = false; timestampIsNanoseconds = true; }
  else throw new Error('Input is not a supported classic PCAP capture.');

  const readU32 = (offset: number) => littleEndian ? input.readUInt32LE(offset) : input.readUInt32BE(offset);
  const linkType = readU32(20);
  if (linkType !== 1) throw new Error(`Unsupported PCAP link type ${linkType}. Ethernet (DLT_EN10MB=1) is required.`);

  const packets: RawPacket[] = [];
  let offset = 24;
  while (offset + 16 <= input.length) {
    const tsSec = readU32(offset);
    const tsFraction = readU32(offset + 4);
    const capturedLength = readU32(offset + 8);
    offset += 16;
    if (offset + capturedLength > input.length) break;
    packets.push({
      timestampMicros: tsSec * 1_000_000 + (timestampIsNanoseconds ? Math.floor(tsFraction / 1000) : tsFraction),
      data: Buffer.from(input.subarray(offset, offset + capturedLength)),
    });
    offset += capturedLength;
  }
  return packets;
}

export function analyzeCapture(input: Buffer): PcapAnalysis {
  if (input.length >= 4 && input.readUInt32BE(0) === 0x0a0d0d0a) {
    const extracted = extractPcapngPackets(input);
    return analyzePackets('pcapng', extracted.packets, extracted.warnings);
  }
  return analyzePackets('pcap', extractClassicPcap(input));
}

export const analyzeClassicPcap = analyzeCapture;
