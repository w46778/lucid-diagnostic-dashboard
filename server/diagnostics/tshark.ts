import { spawn, execFile, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { decodeDoipFrame, type DecodedDoipFrame } from './doip';

const execFileAsync = promisify(execFile);
const CAPTURE_FILTER = 'tcp port 13400 or udp port 13400';
const MAX_EVENTS = 2000;
const MAX_STREAM_BUFFER = 4 * 1024 * 1024;
const DEFAULT_RAW_CAPTURE_MAX_MB = 2048;

type TsharkProcess = ChildProcessByStdio<null, Readable, Readable>;
type TsharkRawProcess = ChildProcessByStdio<null, null, Readable>;

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
  rawCapturePath?: string;
  rawCaptureError?: string;
  rawCaptureMaxMb: number;
  rawCaptureLimitReached: boolean;
  rawCaptureValidation: 'pending' | 'valid' | 'invalid';
  rawCaptureValidationError?: string;
  rawStopRequested: boolean;
  stderrTail: string[];
  packetLines: number;
  doipFrames: number;
  udsMessages: number;
  process?: TsharkProcess;
  rawProcess?: TsharkRawProcess;
  events: LiveDoipEvent[];
  streams: Map<string, StreamState>;
  inventory: Map<string, LiveEcuSummary>;
  nextEventId: number;
};

const state: CaptureState = {
  running: false,
  rawCaptureMaxMb: DEFAULT_RAW_CAPTURE_MAX_MB,
  rawCaptureLimitReached: false,
  rawCaptureValidation: 'pending',
  rawStopRequested: false,
  stderrTail: [],
  packetLines: 0,
  doipFrames: 0,
  udsMessages: 0,
  events: [],
  streams: new Map(),
  inventory: new Map(),
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

function getRawCaptureMaxMb(): number {
  const configured = Number.parseInt(process.env.RAW_CAPTURE_MAX_MB?.trim() || '', 10);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_RAW_CAPTURE_MAX_MB;
  return Math.min(configured, 102400);
}

function createRawCapturePath(): string {
  const captureDir = path.resolve(process.env.CAPTURE_DIR?.trim() || 'captures');
  fs.mkdirSync(captureDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(captureDir, `lucid-doip-${timestamp}.pcapng`);
}

async function validateRawCapture(executable: string, capturePath: string, maxMb: number) {
  if (state.rawCapturePath !== capturePath) return;

  try {
    const stat = fs.statSync(capturePath);
    if (!stat.isFile() || stat.size === 0) throw new Error('Raw capture file is empty.');

    if (state.running && !state.rawStopRequested) {
      const configuredBytes = maxMb * 1024 * 1024;
      if (stat.size >= configuredBytes * 0.98) {
        state.rawCaptureLimitReached = true;
      } else if (!state.rawCaptureError) {
        state.rawCaptureError = 'Raw PCAPNG writer stopped before the live capture ended.';
      }
    }

    await execFileAsync(executable, ['-r', capturePath, '-c', '1', '-Q'], {
      windowsHide: true,
      timeout: 10000,
    });

    if (state.rawCapturePath === capturePath) {
      state.rawCaptureValidation = 'valid';
      state.rawCaptureValidationError = undefined;
    }
  } catch (error) {
    if (state.rawCapturePath === capturePath) {
      state.rawCaptureValidation = 'invalid';
      state.rawCaptureValidationError = error instanceof Error ? error.message : 'Unable to validate raw PCAPNG capture.';
    }
  }
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
      rawCaptureEnabled: true,
      rawCaptureMaxMb: getRawCaptureMaxMb(),
      notes: [
        'TShark is invoked in capture mode only.',
        'Capture is restricted to TCP/UDP port 13400 (DoIP).',
        'A second passive TShark process records the filtered packets to a local PCAPNG file for later re-analysis.',
        'Raw recording has a configurable file-size safety limit and is checked for readability after the writer closes.',
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
      rawCaptureEnabled: false,
      rawCaptureMaxMb: getRawCaptureMaxMb(),
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

function updateInventory(event: LiveDoipEvent) {
  const touch = (address: string, direction: 'sent' | 'received') => {
    const current = state.inventory.get(address) ?? {
      logicalAddress: address,
      messageCount: 0,
      sentCount: 0,
      receivedCount: 0,
      ips: [],
    };
    current.messageCount += 1;
    if (direction === 'sent') current.sentCount += 1;
    else current.receivedCount += 1;
    for (const ip of [event.sourceIp, event.destinationIp]) {
      if (ip && !current.ips.includes(ip)) current.ips.push(ip);
    }
    state.inventory.set(address, current);
    return current;
  };

  const announcement = event.decoded.vehicleAnnouncement;
  if (announcement) {
    const ecu = touch(announcement.logicalAddress, 'sent');
    ecu.vin = announcement.vin || ecu.vin;
    ecu.eid = announcement.eid;
    ecu.gid = announcement.gid;
  }

  const diagnostic = event.decoded.diagnosticMessage;
  if (diagnostic) {
    touch(diagnostic.sourceAddress, 'sent');
    touch(diagnostic.targetAddress, 'received');
  }
}

function pushDecoded(
  transport: 'tcp' | 'udp', timestamp: string,
  sourceIp: string | undefined, destinationIp: string | undefined,
  sourcePort: number | undefined, destinationPort: number | undefined,
  frame: Buffer,
) {
  try {
    const decoded = decodeDoipFrame(frame.toString('hex'));
    const event: LiveDoipEvent = {
      id: state.nextEventId++, timestamp, transport, sourceIp, destinationIp, sourcePort, destinationPort, decoded,
    };
    state.events.push(event);
    state.doipFrames += 1;
    if (decoded.diagnosticMessage?.uds) state.udsMessages += 1;
    updateInventory(event);
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
  const rawCapturePath = createRawCapturePath();
  const rawCaptureMaxMb = getRawCaptureMaxMb();

  Object.assign(state, {
    running: true,
    interfaceId: interfaceId.trim(),
    startedAt: new Date().toISOString(),
    stoppedAt: undefined,
    error: undefined,
    rawCapturePath,
    rawCaptureError: undefined,
    rawCaptureMaxMb,
    rawCaptureLimitReached: false,
    rawCaptureValidation: 'pending' as const,
    rawCaptureValidationError: undefined,
    rawStopRequested: false,
    stderrTail: [],
    packetLines: 0,
    doipFrames: 0,
    udsMessages: 0,
    events: [],
    streams: new Map<string, StreamState>(),
    inventory: new Map<string, LiveEcuSummary>(),
    nextEventId: 1,
  });

  const rawArgs = [
    '-n', '-i', interfaceId.trim(), '-f', CAPTURE_FILTER,
    '-a', `filesize:${rawCaptureMaxMb * 1024}`,
    '-F', 'pcapng', '-w', rawCapturePath,
  ];
  const rawChild = spawn(executable, rawArgs, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  state.rawProcess = rawChild;
  rawChild.stderr.on('data', (chunk: Buffer | string) => appendStderr(`[raw] ${chunk.toString()}`));
  rawChild.on('error', (error) => {
    state.rawCaptureError = error.message;
    state.rawProcess = undefined;
  });
  rawChild.on('exit', (code, signal) => {
    state.rawProcess = undefined;
    if (code && !state.rawCaptureError) {
      state.rawCaptureError = `Raw PCAPNG writer exited with code ${code}${signal ? ` (${signal})` : ''}.`;
    }
  });
  rawChild.on('close', () => {
    void validateRawCapture(executable, rawCapturePath, rawCaptureMaxMb);
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
  child.on('error', (error) => {
    state.error = error.message;
    state.running = false;
    state.stoppedAt = new Date().toISOString();
    state.process = undefined;
    state.rawStopRequested = true;
    state.rawProcess?.kill('SIGTERM');
  });
  child.on('exit', (code, signal) => {
    if (stdout.trim()) handleLine(stdout);
    state.running = false;
    state.stoppedAt = new Date().toISOString();
    state.process = undefined;
    state.rawStopRequested = true;
    state.rawProcess?.kill('SIGTERM');
    if (code && !state.error) state.error = `TShark exited with code ${code}${signal ? ` (${signal})` : ''}.`;
  });
  return getPassiveCaptureSnapshot();
}

export function stopPassiveCapture() {
  if (state.running) {
    state.rawStopRequested = true;
    state.process?.kill('SIGTERM');
    state.rawProcess?.kill('SIGTERM');
  }
  state.running = false;
  state.stoppedAt = new Date().toISOString();
  return getPassiveCaptureSnapshot();
}

export function getPassiveCaptureSnapshot(afterEventId = 0) {
  let rawCaptureBytes: number | null = null;
  if (state.rawCapturePath) {
    try {
      rawCaptureBytes = fs.statSync(state.rawCapturePath).size;
    } catch {
      rawCaptureBytes = null;
    }
  }

  return {
    running: state.running,
    interfaceId: state.interfaceId ?? null,
    startedAt: state.startedAt ?? null,
    stoppedAt: state.stoppedAt ?? null,
    error: state.error ?? null,
    rawCapturePath: state.rawCapturePath ?? null,
    rawCaptureBytes,
    rawCaptureError: state.rawCaptureError ?? null,
    rawCaptureMaxMb: state.rawCaptureMaxMb,
    rawCaptureLimitReached: state.rawCaptureLimitReached,
    rawCaptureValidation: state.rawCaptureValidation,
    rawCaptureValidationError: state.rawCaptureValidationError ?? null,
    stderrTail: state.stderrTail,
    captureFilter: CAPTURE_FILTER,
    packetLines: state.packetLines,
    doipFrames: state.doipFrames,
    udsMessages: state.udsMessages,
    totalBufferedEvents: state.events.length,
    latestEventId: state.events.at(-1)?.id ?? 0,
    events: state.events.filter((event) => event.id > afterEventId),
    ecuInventory: Array.from(state.inventory.values()).sort((a, b) => a.logicalAddress.localeCompare(b.logicalAddress)),
    transmitEnabled: false,
  };
}
