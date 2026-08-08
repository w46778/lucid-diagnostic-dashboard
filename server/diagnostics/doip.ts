import { decodeUdsPayload, type UdsMessage } from './uds';

export const DOIP_DEFAULT_PORT = 13400;

const payloadTypeNames: Record<number, string> = {
  0x0000: 'Generic header negative acknowledge',
  0x0001: 'Vehicle identification request',
  0x0002: 'Vehicle identification request by EID',
  0x0003: 'Vehicle identification request by VIN',
  0x0004: 'Vehicle announcement / identification response',
  0x0005: 'Routing activation request',
  0x0006: 'Routing activation response',
  0x0007: 'Alive check request',
  0x0008: 'Alive check response',
  0x8001: 'Diagnostic message',
  0x8002: 'Diagnostic message positive acknowledge',
  0x8003: 'Diagnostic message negative acknowledge',
};

export type DoipVehicleAnnouncement = {
  vin: string;
  logicalAddress: string;
  eid: string;
  gid: string;
  furtherActionCode: string;
  vinGidSyncStatus?: string;
};

export type DoipDiagnosticMessage = {
  sourceAddress: string;
  targetAddress: string;
  userDataHex: string;
  uds?: UdsMessage;
};

export type DecodedDoipFrame = {
  byteLength: number;
  protocolVersion: string;
  inverseProtocolVersion: string;
  inverseVersionValid: boolean;
  payloadType: string;
  payloadTypeName: string;
  payloadLength: number;
  trailingBytes: number;
  payloadHex: string;
  vehicleAnnouncement?: DoipVehicleAnnouncement;
  diagnosticMessage?: DoipDiagnosticMessage;
};

function toHex(value: number, width = 2): string {
  return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`;
}

function bytesToHex(value: Buffer): string {
  return Array.from(value)
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

function normalizeHex(input: string): string {
  const normalized = input
    .replace(/0x/gi, '')
    .replace(/[^0-9a-f]/gi, '')
    .toLowerCase();

  if (!normalized.length) throw new Error('No hexadecimal bytes were provided.');
  if (normalized.length % 2 !== 0) throw new Error('Hex input must contain complete bytes.');
  if (normalized.length > 2_000_000) throw new Error('Capture is too large for the inline decoder.');

  return normalized;
}

export function decodeDoipFrame(hexInput: string): DecodedDoipFrame {
  const raw = Buffer.from(normalizeHex(hexInput), 'hex');
  if (raw.length < 8) throw new Error('DoIP frame is shorter than the 8-byte generic header.');

  const protocolVersion = raw[0];
  const inverseProtocolVersion = raw[1];
  const payloadType = raw.readUInt16BE(2);
  const payloadLength = raw.readUInt32BE(4);
  const expectedLength = 8 + payloadLength;

  if (raw.length < expectedLength) {
    throw new Error(`Incomplete DoIP frame: header declares ${payloadLength} payload bytes, but only ${raw.length - 8} are present.`);
  }

  const payload = raw.subarray(8, expectedLength);
  const result: DecodedDoipFrame = {
    byteLength: raw.length,
    protocolVersion: toHex(protocolVersion),
    inverseProtocolVersion: toHex(inverseProtocolVersion),
    inverseVersionValid: ((protocolVersion ^ inverseProtocolVersion) & 0xff) === 0xff,
    payloadType: toHex(payloadType, 4),
    payloadTypeName: payloadTypeNames[payloadType] ?? 'Unknown / vendor-specific payload type',
    payloadLength,
    trailingBytes: raw.length - expectedLength,
    payloadHex: bytesToHex(payload),
  };

  if (payloadType === 0x0004) {
    if (payload.length < 32) {
      throw new Error('Vehicle announcement payload is shorter than the required 32 bytes.');
    }

    result.vehicleAnnouncement = {
      vin: payload.subarray(0, 17).toString('ascii').replace(/\0/g, '').trim(),
      logicalAddress: toHex(payload.readUInt16BE(17), 4),
      eid: bytesToHex(payload.subarray(19, 25)),
      gid: bytesToHex(payload.subarray(25, 31)),
      furtherActionCode: toHex(payload[31]),
      ...(payload.length >= 33 ? { vinGidSyncStatus: toHex(payload[32]) } : {}),
    };
  }

  if (payloadType === 0x8001 && payload.length >= 4) {
    const userData = payload.subarray(4);
    result.diagnosticMessage = {
      sourceAddress: toHex(payload.readUInt16BE(0), 4),
      targetAddress: toHex(payload.readUInt16BE(2), 4),
      userDataHex: bytesToHex(userData),
      uds: decodeUdsPayload(userData),
    };
  }

  return result;
}

export const doipDecoderInfo = {
  mode: 'offline-read-only' as const,
  defaultPort: DOIP_DEFAULT_PORT,
  genericHeaderBytes: 8,
  supportedDecoders: [
    'generic-header',
    'vehicle-announcement-0x0004',
    'diagnostic-envelope-0x8001',
    'passive-uds-service-decoder',
  ],
  doesTransmitToVehicle: false,
  notes: [
    'The decoder only parses bytes supplied by the user or an offline capture pipeline.',
    'It does not broadcast vehicle-identification requests, activate diagnostic routing, or send UDS commands.',
    'Lucid-specific ECU names and proprietary identifiers are intentionally not inferred from logical addresses.',
    'Protected, write, routine, and programming UDS services are identified only when already present in captured traffic.',
  ],
};
