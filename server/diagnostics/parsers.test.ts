import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeUdsPayload } from './uds';
import { decodeDoipFrame } from './doip';
import { extractPcapngPackets } from './pcapng';

function hex(buffer: Buffer) {
  return buffer.toString('hex').toUpperCase();
}

function buildDoipDiagnostic(userData: Buffer, source = 0x0e00, target = 0x1001): Buffer {
  const payload = Buffer.alloc(4 + userData.length);
  payload.writeUInt16BE(source, 0);
  payload.writeUInt16BE(target, 2);
  userData.copy(payload, 4);

  const frame = Buffer.alloc(8 + payload.length);
  frame[0] = 0x02;
  frame[1] = 0xfd;
  frame.writeUInt16BE(0x8001, 2);
  frame.writeUInt32BE(payload.length, 4);
  payload.copy(frame, 8);
  return frame;
}

function sectionHeaderBlock(): Buffer {
  const block = Buffer.alloc(28);
  block.writeUInt32LE(0x0a0d0d0a, 0);
  block.writeUInt32LE(28, 4);
  block.writeUInt32LE(0x1a2b3c4d, 8);
  block.writeUInt16LE(1, 12);
  block.writeUInt16LE(0, 14);
  block.writeBigUInt64LE(0xffffffffffffffffn, 16);
  block.writeUInt32LE(28, 24);
  return block;
}

function interfaceDescriptionBlock(linkType: number): Buffer {
  const block = Buffer.alloc(20);
  block.writeUInt32LE(0x00000001, 0);
  block.writeUInt32LE(20, 4);
  block.writeUInt16LE(linkType, 8);
  block.writeUInt16LE(0, 10);
  block.writeUInt32LE(65535, 12);
  block.writeUInt32LE(20, 16);
  return block;
}

function enhancedPacketBlock(interfaceId: number, data: Buffer, timestamp = 1_000_000): Buffer {
  const paddedLength = (data.length + 3) & ~3;
  const blockLength = 32 + paddedLength;
  const block = Buffer.alloc(blockLength);
  block.writeUInt32LE(0x00000006, 0);
  block.writeUInt32LE(blockLength, 4);
  block.writeUInt32LE(interfaceId, 8);
  block.writeUInt32LE(0, 12);
  block.writeUInt32LE(timestamp, 16);
  block.writeUInt32LE(data.length, 20);
  block.writeUInt32LE(data.length, 24);
  data.copy(block, 28);
  block.writeUInt32LE(blockLength, blockLength - 4);
  return block;
}

test('UDS recognizes positive response for high service IDs', () => {
  const decoded = decodeUdsPayload(Buffer.from([0xc5, 0x01]));
  assert.ok(decoded);
  assert.equal(decoded.direction, 'positive-response');
  assert.equal(decoded.requestServiceId, '0x85');
  assert.equal(decoded.serviceName, 'Control DTC Setting');
  assert.equal(decoded.subFunction, '0x01');
});

test('UDS WriteDataByIdentifier exposes only the first DID', () => {
  const decoded = decodeUdsPayload(Buffer.from([0x2e, 0xf1, 0x90, 0x01, 0x02, 0x03, 0x04]));
  assert.ok(decoded);
  assert.deepEqual(decoded.dids, ['0xF190']);
});

test('UDS ReadDataByIdentifier positive response does not parse data bytes as DIDs', () => {
  const decoded = decodeUdsPayload(Buffer.from([0x62, 0xf1, 0x90, 0x12, 0x34, 0x56, 0x78]));
  assert.ok(decoded);
  assert.equal(decoded.direction, 'positive-response');
  assert.deepEqual(decoded.dids, ['0xF190']);
});

test('DoIP diagnostic envelope feeds passive UDS decoder', () => {
  const frame = buildDoipDiagnostic(Buffer.from([0x22, 0xf1, 0x90]));
  const decoded = decodeDoipFrame(frame.toString('hex'));
  assert.equal(decoded.payloadType, '0x8001');
  assert.equal(decoded.inverseVersionValid, true);
  assert.equal(decoded.diagnosticMessage?.sourceAddress, '0x0E00');
  assert.equal(decoded.diagnosticMessage?.targetAddress, '0x1001');
  assert.equal(decoded.diagnosticMessage?.uds?.serviceId, '0x22');
  assert.deepEqual(decoded.diagnosticMessage?.uds?.dids, ['0xF190']);
});

test('PCAPNG keeps only Ethernet packets across multiple sections', () => {
  const ethernetA = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]);
  const nonEthernetA = Buffer.from([0x11, 0x22, 0x33, 0x44]);
  const nonEthernetB = Buffer.from([0x55, 0x66, 0x77, 0x88]);
  const ethernetB = Buffer.from([0xde, 0xad, 0xbe, 0xef]);

  const capture = Buffer.concat([
    sectionHeaderBlock(),
    interfaceDescriptionBlock(1),
    interfaceDescriptionBlock(127),
    enhancedPacketBlock(0, ethernetA),
    enhancedPacketBlock(1, nonEthernetA),
    sectionHeaderBlock(),
    interfaceDescriptionBlock(127),
    interfaceDescriptionBlock(1),
    enhancedPacketBlock(0, nonEthernetB),
    enhancedPacketBlock(1, ethernetB),
  ]);

  const extracted = extractPcapngPackets(capture);
  assert.equal(extracted.packets.length, 2);
  assert.equal(hex(extracted.packets[0].data), hex(ethernetA));
  assert.equal(hex(extracted.packets[1].data), hex(ethernetB));
  assert.ok(extracted.warnings.some((warning) => warning.includes('Skipped 2 packet(s)')));
});
