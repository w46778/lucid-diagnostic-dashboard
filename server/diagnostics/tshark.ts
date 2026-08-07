import { spawn, execFile, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import { promisify } from 'node:util';
import fs from 'node:fs';
import { decodeDoipFrame, type DecodedDoipFrame } from './doip';

const execFileAsync = promisify(execFile);
const CAPTURE_FILTER = 'tcp port 13400 or udp port 13400';
const MAX_EVENTS = 2000;
const MAX_STREAM_BUFFER = 4 * 1024 * 1024;

type TsharkProcess = ChildProcessByStdio<null, Readable, Readable>;

export type TsharkInterface = { id: string; label: string; raw: string };
export type LiveDoipEvent = {
  id: number;
  timestamp: string;
  transport: 'tcp' | 'udp';
  sourceIp?: string;
  destinationIp?: string;
  sourcePort?: number;
  destinationPort?: number;
  decoded: DecodedDoipFrame;
};
export type LiveEcuSummary = {
  logicalAddress: string;
  messageCount: number;
  sentCount: number;
  receivedCount: number;
  ips: string[];
  vin?: string;
  eid?: string;
  gid?: string;
};

type StreamState = { nextSequence?: number; buffer: Buffer };
type CaptureState = {
  running: boolean;
  interfaceId?: string;
  startedAt?: string;
  stoppedAt?: string;
  error?: string;
  stderrTail: string[];
  packetLines: number;
  doipFrames: number;
  process?: TsharkProcess;
  events: LiveDoipEvent[];
  streams: Map<string, StreamState>;
  nextEventId: number;
};

const state: CaptureState = {
  running: false,
  stderrTail: [],
  packetLines: 0,
  doipFrames: 0,
  events: [],
  streams: new Map(),
  nextEventId: 1,
};

function possibleTsharkPaths(): string[] {
  const candidates = ['tshark'];
  if (process.platform === 'win32') {
    candidates.unshift('C:\\Program Files\\Wireshark\\tshark.exe', 'C:\\Program Files (x86)\\Wireshark\\tshark.exe');
  }
  return candidates;
}

async function resolveTshark(): Promise<string> {
  for (const candidate of possibleTsharkPaths()) {
    try {
      if (candidate !== 'tshark' && !fs.existsSync(candidate)) continue;
      await execFileAsync(candidate, ['-v'], { windowsHide: true, timeout: 5000 });
      return candidate;
    } catch {
      // continue
    }
  }
  throw new Error('TShark was not found. Install Wireshark with Npcap and ensure tshark.exe is available.');
}

export async function getTsharkReadiness() {
  try {
    const executable = await resolveTshark();
    const { stdout } = await execFileAsync(executable, ['-v'], { windowsHide: true, timeout: 5000 });
    return {
      installed: true,
      executable,
      version: stdout.split(/\r?\n/).find(Boolean) ?? 'TShark detected',
      captureFilter: CAPTURE_FILTER,
      activeTransmit: false,
      notes: [
        'TShark is invoked in capture mode only.',
        'Capture is restricted to TCP/UDP port 13400 (DoIP).',
        'This module does not generate DoIP discovery, routing activation, UDS requests, or other vehicle traffic.',
      ],
    };
  } catch (error) {
    return {
      installed: false,
      executable: null,
      version: null,
      captureFilter: CAPTURE_FILTER,
      activeTransmit: false,
      error: error instanceof Error ? error.message : 'Unable to detect TShark.',
    };
  }
}

export async function listTsharkInterfaces(): Promise<TsharkInterface[]> {
  const executable = await resolveTshark();
  const { stdout } = await execFileAsync(executable, ['-D'], { windowsHide: true, timeout: 8000 });
  return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((raw) => {
    const match = raw.match(/^(\d+)\.\s+(.+)$/);
    return { id: match?.[1] ?? raw, label: match?.[2] ?? raw, raw };
  });
}

function parseHexBytes(value: string): Buffer {
  const normalized = value.replace(/:/g, '').replace(/\s+/g, '');
  if (!normalized || normalized.length % 2 || !/^[0-9a-f]+$/i.test(normalized)) return Buffer.alloc(0);
  return Buffer.from(normalized, 'hex');
}

function splitCompleteDoipFrames(buffer: Buffer): { frames: Buffer[]; remainder: Buffer } {
  const frames: Buffer[] = [];
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const version = buffer[offset];
    const inverse = buffer[offset + 1];
    if (((version ^ inverse) & 0xff) !== 0xff) { offset += 1; continue; }
    const payloadLength = buffer.readUInt32BE(offset + 4);
    const frameLength = 8 + payloadLength;
    if (frameLength < 8 || frameLength > 16 * 1024 * 1024) { offset += 1; continue; }
    if (offset + frameLength > buffer.length) break;
    frames.push(buffer.subarray(offset, offset + frameLength));
    offset += frameLength;
  }
  return { frames, remainder: buffer.subarray(offset) };
}

function pushDecoded(
  transport: 'tcp' | 'udp', timestamp: string,
  sourceIp: string | undefined, destinationIp: string | undefined,
  sourcePort: number | undefined, destinationPort: number | undefined,
  frame: Buffer,
) {
  try {
    state.events.push({
      id: state.nextEventId++, timestamp, transport, sourceIp, destinationIp, sourcePort, destinationPort,
      decoded: decodeDoipFrame(frame.toString('hex')),
    });
    state.doipFrames += 1;
    if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
  } catch {
    // Ignore malformed bytes while keeping capture alive.
  }
}

function handleUdp(timestamp: string, src: string | undefined, dst: string | undefined, sport: number | undefined, dport: number | undefined, payload: Buffer) {
  const { frames } = splitCompleteDoipFrames(payload);
  for (const frame of frames) pushDecoded('udp', timestamp, src, dst, sport, dport, frame);
}

function handleTcp(
  timestamp: string, src: string | undefined, dst: string | undefined,
  sport: number | undefined, dport: number | undefined,
  sequence: number | undefined, payload: Buffer,
) {
  if (!payload.length) return;
  const key = `${src ?? '?'}:${sport ?? 0}>${dst ?? '?'}:${dport ?? 0}`;
  const stream = state.streams.get(key) ?? { buffer: Buffer.alloc(0) };
  let chunk = payload;

  if (sequence !== undefined && stream.nextSequence !== undefined) {
    if (sequence < stream.nextSequence) {
      const overlap = stream.nextSequence - sequence;
      if (overlap >= chunk.length) return;
      chunk = chunk.subarray(overlap);
    } else if (sequence > stream.nextSequence) {
      stream.buffer = Buffer.alloc(0);
    }
  }

  stream.buffer = Buffer.concat([stream.buffer, chunk]);
  if (sequence !== undefined) stream.nextSequence = sequence + payload.length;
  const parsed = splitCompleteDoipFrames(stream.buffer);
  stream.buffer = parsed.remainder.length > MAX_STREAM_BUFFER
    ? parsed.remainder.subarray(parsed.remainder.length - MAX_STREAM_BUFFER)
    : parsed.remainder;
  state.streams.set(key, stream);
  for (const frame of parsed.frames) pushDecoded('tcp', timestamp, src, dst, sport, dport, frame);
}

function numberOrUndefined(value: string): number | undefined {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : undefined;
}

function handleLine(line: string) {
  if (!line.trim()) return;
  state.packetLines += 1;
  const fields = line.replace(/\r$/, '').split('\t');
  while (fields.length < 10) fields.push('');
  const [epoch, src, dst, tcpSport, tcpDport, tcpSeq, tcpPayload, udpSport, udpDport, udpPayload] = fields;
  const timestamp = Number.isFinite(Number(epoch)) ? new Date(Number(epoch) * 1000).toISOString() : new Date().toISOString();

  const tcp = parseHexBytes(tcpPayload);
  if (tcp.length) handleTcp(timestamp, src || undefined, dst || undefined, numberOrUndefined(tcpSport), numberOrUndefined(tcpDport), numberOrUndefined(tcpSeq), tcp);
  const udp = parseHexBytes(udpPayload);
  if (udp.length) handleUdp(timestamp, src || undefined, dst || undefined, numberOrUndefined(udpSport), numberOrUndefined(udpDport), udp);
}

function appendStderr(text: string) {
  state.stderrTail.push(...text.split(/\r?\n/).filter(Boolean));
  if (state.stderrTail.length > 30) state.stderrTail.splice(0, state.stderrTail.length - 30);
}

export async function startPassiveCapture(interfaceId: string) {
  if (state.running) throw new Error('A passive capture is already running.');
  if (!interfaceId.trim()) throw new Error('A TShark capture interface must be selected.');

  const executable = await resolveTshark();
  Object.assign(state, {
    running: true,
    interfaceId: interfaceId.trim(),
    startedAt: new Date().toISOString(),
    stoppedAt: undefined,
    error: undefined,
    stderrTail: [],
    packetLines: 0,
    doipFrames: 0,
    events: [],
    streams: new Map<string, StreamState>(),
    nextEventId: 1,
  });

  const args = [
    '-l', '-n', '-i', interfaceId.trim(), '-f', CAPTURE_FILTER,
    '-T', 'fields', '-E', 'separator=\t', '-E', 'quote=n', '-E', 'occurrence=f',
    '-e', 'frame.time_epoch', '-e', 'ip.src', '-e', 'ip.dst',
    '-e', 'tcp.srcport', '-e', 'tcp.dstport', '-e', 'tcp.seq', '-e', 'tcp.payload',
    '-e', 'udp.srcport', '-e', 'udp.dstport', '-e', 'udp.payload',
  ];

  const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  state.process = child;
  let stdout = '';
  child.stdout.on('data', (chunk: Buffer | string) => {
    stdout += chunk.toString();
    const lines = stdout.split(/\r?\n/);
    stdout = lines.pop() ?? '';
    for (const line of lines) handleLine(line);
  });
  child.stderr.on('data', (chunk: Buffer | string) => appendStderr(chunk.toString()));
  child.on('error', (error) => { state.error = error.message; state.running = false; state.stoppedAt = new Date().toISOString(); state.process = undefined; });
  child.on('exit', (code, signal) => {
    if (stdout.trim()) handleLine(stdout);
    state.running = false;
    state.stoppedAt = new Date().toISOString();
    state.process = undefined;
    if (code && !state.error) state.error = `TShark exited with code ${code}${signal ? ` (${signal})` : ''}.`;
  });
  return getPassiveCaptureSnapshot();
}

export function stopPassiveCapture() {
  if (state.running) state.process?.kill('SIGTERM');
  state.running = false;
  state.stoppedAt = new Date().toISOString();
  return getPassiveCaptureSnapshot();
}

function buildInventory(): LiveEcuSummary[] {
  const map = new Map<string, LiveEcuSummary>();
  const touch = (address: string, direction: 'sent' | 'received', event: LiveDoipEvent) => {
    const current = map.get(address) ?? { logicalAddress: address, messageCount: 0, sentCount: 0, receivedCount: 0, ips: [] };
    current.messageCount += 1;
    direction === 'sent' ? current.sentCount += 1 : current.receivedCount += 1;
    for (const ip of [event.sourceIp, event.destinationIp]) if (ip && !current.ips.includes(ip)) current.ips.push(ip);
    map.set(address, current);
    return current;
  };
  for (const event of state.events) {
    const announcement = event.decoded.vehicleAnnouncement;
    if (announcement) {
      const ecu = touch(announcement.logicalAddress, 'sent', event);
      ecu.vin = announcement.vin || ecu.vin; ecu.eid = announcement.eid; ecu.gid = announcement.gid;
    }
    const diagnostic = event.decoded.diagnosticMessage;
    if (diagnostic) { touch(diagnostic.sourceAddress, 'sent', event); touch(diagnostic.targetAddress, 'received', event); }
  }
  return Array.from(map.values()).sort((a, b) => a.logicalAddress.localeCompare(b.logicalAddress));
}

export function getPassiveCaptureSnapshot(afterEventId = 0) {
  return {
    running: state.running,
    interfaceId: state.interfaceId ?? null,
    startedAt: state.startedAt ?? null,
    stoppedAt: state.stoppedAt ?? null,
    error: state.error ?? null,
    stderrTail: state.stderrTail,
    captureFilter: CAPTURE_FILTER,
    packetLines: state.packetLines,
    doipFrames: state.doipFrames,
    totalBufferedEvents: state.events.length,
    latestEventId: state.events.at(-1)?.id ?? 0,
    events: state.events.filter((event) => event.id > afterEventId),
    ecuInventory: buildInventory(),
    transmitEnabled: false,
  };
}
