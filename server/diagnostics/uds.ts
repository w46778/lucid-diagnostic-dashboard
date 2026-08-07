export type UdsMessage = {
  rawHex: string;
  serviceId: string;
  serviceName: string;
  direction: 'request' | 'positive-response' | 'negative-response' | 'unknown';
  requestServiceId?: string;
  requestServiceName?: string;
  subFunction?: string;
  dids?: string[];
  routineId?: string;
  negativeResponseCode?: string;
  negativeResponseName?: string;
  notes: string[];
};

const serviceNames: Record<number, string> = {
  0x10: 'Diagnostic Session Control',
  0x11: 'ECU Reset',
  0x14: 'Clear Diagnostic Information',
  0x19: 'Read DTC Information',
  0x22: 'Read Data By Identifier',
  0x27: 'Security Access',
  0x2e: 'Write Data By Identifier',
  0x31: 'Routine Control',
  0x34: 'Request Download',
  0x36: 'Transfer Data',
  0x37: 'Request Transfer Exit',
  0x3e: 'Tester Present',
  0x85: 'Control DTC Setting',
};

const nrcNames: Record<number, string> = {
  0x10: 'General Reject',
  0x11: 'Service Not Supported',
  0x12: 'Sub-function Not Supported',
  0x13: 'Incorrect Message Length / Invalid Format',
  0x22: 'Conditions Not Correct',
  0x24: 'Request Sequence Error',
  0x31: 'Request Out Of Range',
  0x33: 'Security Access Denied',
  0x35: 'Invalid Key',
  0x36: 'Exceeded Number Of Attempts',
  0x37: 'Required Time Delay Not Expired',
  0x70: 'Upload/Download Not Accepted',
  0x71: 'Transfer Data Suspended',
  0x72: 'General Programming Failure',
  0x73: 'Wrong Block Sequence Counter',
  0x78: 'Response Pending',
};

function toHex(value: number, width = 2): string {
  return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`;
}

function bytesToHex(bytes: Buffer): string {
  return Array.from(bytes).map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

export function decodeUdsPayload(userData: Buffer): UdsMessage | undefined {
  if (!userData.length) return undefined;

  const sid = userData[0];
  const notes: string[] = [];

  if (sid === 0x7f) {
    if (userData.length < 3) {
      return {
        rawHex: bytesToHex(userData),
        serviceId: '0x7F',
        serviceName: 'Negative Response',
        direction: 'negative-response',
        notes: ['Negative response payload is shorter than expected.'],
      };
    }
    const requestSid = userData[1];
    const nrc = userData[2];
    return {
      rawHex: bytesToHex(userData),
      serviceId: '0x7F',
      serviceName: 'Negative Response',
      direction: 'negative-response',
      requestServiceId: toHex(requestSid),
      requestServiceName: serviceNames[requestSid] ?? 'Unknown / vendor-specific service',
      negativeResponseCode: toHex(nrc),
      negativeResponseName: nrcNames[nrc] ?? 'Unknown / vendor-specific NRC',
      notes,
    };
  }

  let direction: UdsMessage['direction'] = 'request';
  let requestSid = sid;
  if (sid >= 0x40 && sid <= 0x7e) {
    requestSid = sid - 0x40;
    direction = 'positive-response';
  }

  const serviceName = serviceNames[requestSid] ?? 'Unknown / vendor-specific service';
  const result: UdsMessage = {
    rawHex: bytesToHex(userData),
    serviceId: toHex(sid),
    serviceName,
    direction,
    ...(direction === 'positive-response' ? {
      requestServiceId: toHex(requestSid),
      requestServiceName: serviceName,
    } : {}),
    notes,
  };

  if ([0x10, 0x11, 0x19, 0x27, 0x31, 0x3e, 0x85].includes(requestSid) && userData.length >= 2) {
    result.subFunction = toHex(userData[1]);
  }

  if (requestSid === 0x22 || requestSid === 0x2e) {
    const start = direction === 'positive-response' ? 1 : 1;
    const dids: string[] = [];
    for (let i = start; i + 1 < userData.length; i += 2) {
      dids.push(toHex(userData.readUInt16BE(i), 4));
      if (direction === 'positive-response') break;
    }
    if (dids.length) result.dids = dids;
  }

  if (requestSid === 0x31 && userData.length >= 4) {
    result.routineId = toHex(userData.readUInt16BE(2), 4);
    notes.push('Routine identifier is shown as raw data only; no Lucid-specific meaning is inferred.');
  }

  if ([0x27, 0x2e, 0x31, 0x34, 0x36, 0x37].includes(requestSid)) {
    notes.push('This decoder is passive: it reports observed protected/write/programming traffic but does not generate or transmit it.');
  }

  return result;
}
