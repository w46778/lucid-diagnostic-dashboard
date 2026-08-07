export type PcapngPacket = {
  timestampMicros?: number;
  data: Buffer;
};

export type PcapngExtraction = {
  sourceFormat: 'pcapng';
  linkType: number;
  packets: PcapngPacket[];
  warnings: string[];
};

const SECTION_HEADER_BLOCK = 0x0a0d0d0a;
const INTERFACE_DESCRIPTION_BLOCK = 0x00000001;
const ENHANCED_PACKET_BLOCK = 0x00000006;

function align4(value: number): number {
  return (value + 3) & ~3;
}

export function extractPcapngPackets(input: Buffer): PcapngExtraction {
  if (input.length < 28 || input.readUInt32BE(0) !== SECTION_HEADER_BLOCK) {
    throw new Error('Input is not a PCAPNG capture.');
  }

  let offset = 0;
  let littleEndian = true;
  const interfaces: Array<{ linkType: number; tsResolution: number }> = [];
  const packets: PcapngPacket[] = [];
  const warnings: string[] = [];

  const readU16 = (buffer: Buffer, at: number) => littleEndian ? buffer.readUInt16LE(at) : buffer.readUInt16BE(at);
  const readU32 = (buffer: Buffer, at: number) => littleEndian ? buffer.readUInt32LE(at) : buffer.readUInt32BE(at);

  while (offset + 12 <= input.length) {
    const blockTypeBe = input.readUInt32BE(offset);
    if (blockTypeBe === SECTION_HEADER_BLOCK) {
      if (offset + 12 > input.length) break;
      const bomBe = input.readUInt32BE(offset + 8);
      const bomLe = input.readUInt32LE(offset + 8);
      if (bomBe === 0x1a2b3c4d) littleEndian = false;
      else if (bomLe === 0x1a2b3c4d) littleEndian = true;
      else throw new Error('Unsupported PCAPNG byte-order magic.');
    }

    const blockType = blockTypeBe === SECTION_HEADER_BLOCK ? SECTION_HEADER_BLOCK : readU32(input, offset);
    const blockLength = readU32(input, offset + 4);
    if (blockLength < 12 || offset + blockLength > input.length) {
      warnings.push(`Invalid PCAPNG block length ${blockLength} at offset ${offset}.`);
      break;
    }

    const trailingLength = readU32(input, offset + blockLength - 4);
    if (trailingLength !== blockLength) {
      warnings.push(`PCAPNG block length mismatch at offset ${offset}.`);
    }

    if (blockType === INTERFACE_DESCRIPTION_BLOCK && blockLength >= 20) {
      const linkType = readU16(input, offset + 8);
      let tsResolution = 1_000_000;
      let optionOffset = offset + 16;
      const optionEnd = offset + blockLength - 4;
      while (optionOffset + 4 <= optionEnd) {
        const code = readU16(input, optionOffset);
        const length = readU16(input, optionOffset + 2);
        optionOffset += 4;
        if (code === 0) break;
        if (optionOffset + length > optionEnd) break;
        if (code === 9 && length >= 1) {
          const raw = input[optionOffset];
          if ((raw & 0x80) === 0) tsResolution = Math.pow(10, raw);
          else tsResolution = Math.pow(2, raw & 0x7f);
        }
        optionOffset += align4(length);
      }
      interfaces.push({ linkType, tsResolution });
    }

    if (blockType === ENHANCED_PACKET_BLOCK && blockLength >= 32) {
      const interfaceId = readU32(input, offset + 8);
      const tsHigh = readU32(input, offset + 12);
      const tsLow = readU32(input, offset + 16);
      const capturedLength = readU32(input, offset + 20);
      const packetStart = offset + 28;
      if (packetStart + capturedLength <= offset + blockLength - 4) {
        const iface = interfaces[interfaceId];
        if (!iface) {
          warnings.push(`Packet references unknown interface ${interfaceId}.`);
        } else {
          const ticks = tsHigh * 0x1_0000_0000 + tsLow;
          packets.push({
            timestampMicros: Math.floor((ticks / iface.tsResolution) * 1_000_000),
            data: Buffer.from(input.subarray(packetStart, packetStart + capturedLength)),
          });
        }
      }
    }

    offset += blockLength;
  }

  if (!interfaces.length) throw new Error('PCAPNG capture contains no interface description blocks.');
  const ethernetInterfaces = interfaces.filter((iface) => iface.linkType === 1);
  if (!ethernetInterfaces.length) throw new Error('PCAPNG capture has no Ethernet (DLT_EN10MB=1) interface.');

  return {
    sourceFormat: 'pcapng',
    linkType: 1,
    packets,
    warnings: warnings.slice(0, 100),
  };
}
