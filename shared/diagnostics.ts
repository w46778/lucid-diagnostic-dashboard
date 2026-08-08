export type EvidenceLevel = 'confirmed' | 'documented' | 'community' | 'hypothesis';

export type DiagnosticCapability = {
  id: string;
  name: string;
  protocol: 'DoIP' | 'UDS' | 'CAN' | 'CAN-FD' | 'Cloud API';
  evidence: EvidenceLevel;
  access: 'read-only' | 'service' | 'protected';
  status: 'available-now' | 'foundation' | 'research';
  description: string;
};

export type EcuRecord = {
  logicalAddress: string;
  name: string;
  source: EvidenceLevel;
  online: boolean;
  hardwarePartNumber?: string;
  softwareVersion?: string;
  serialNumber?: string;
  notes?: string;
};

export type DtcRecord = {
  ecu: string;
  code: string;
  status: 'active' | 'stored' | 'pending' | 'unknown';
  evidence: EvidenceLevel;
  description: string;
  raw?: string;
};

export type DidRecord = {
  ecu: string;
  did: string;
  name: string;
  value: string;
  evidence: EvidenceLevel;
  raw?: string;
};

export const diagnosticCapabilities: DiagnosticCapability[] = [
  {
    id: 'doip-discovery',
    name: 'DoIP ECU Discovery',
    protocol: 'DoIP',
    evidence: 'documented',
    access: 'read-only',
    status: 'foundation',
    description: 'Foundation for discovering diagnostic endpoints and logical ECU addresses over ISO 13400.',
  },
  {
    id: 'uds-identification',
    name: 'UDS ECU Identification',
    protocol: 'UDS',
    evidence: 'documented',
    access: 'read-only',
    status: 'foundation',
    description: 'Read ECU identification data via diagnostic identifiers once Lucid-specific DID mappings are confirmed.',
  },
  {
    id: 'uds-dtc-read',
    name: 'Read Diagnostic Trouble Codes',
    protocol: 'UDS',
    evidence: 'documented',
    access: 'read-only',
    status: 'foundation',
    description: 'Read DTC status and raw diagnostic records from responding ECUs.',
  },
  {
    id: 'uds-did-read',
    name: 'DID Explorer',
    protocol: 'UDS',
    evidence: 'documented',
    access: 'read-only',
    status: 'foundation',
    description: 'Catalog confirmed and unknown Lucid data identifiers without guessing proprietary meanings.',
  },
  {
    id: 'routine-control',
    name: 'Routine Control',
    protocol: 'UDS',
    evidence: 'documented',
    access: 'service',
    status: 'research',
    description: 'Reserved for confirmed service routines such as calibrations or self-tests after routine IDs are independently validated.',
  },
  {
    id: 'security-access',
    name: 'Protected Diagnostic Access',
    protocol: 'UDS',
    evidence: 'documented',
    access: 'protected',
    status: 'research',
    description: 'Tracks whether an operation requires authorized diagnostic credentials. No bypass logic is implemented.',
  },
];

export const demoEcus: EcuRecord[] = [];
export const demoDtcs: DtcRecord[] = [];
export const demoDids: DidRecord[] = [];
