import type { ApiAction, MonitoringSource, OtaUpdate, TelemetryField } from '@shared/data';
import type { MonitoringAlert, MonitoringCheck } from '@shared/schema';

export type TelemetryResponse = {
  vehicle: string;
  vin: string;
  softwareVersion: string;
  lastUpdated: string;
  isDemoMode: boolean;
  fields: TelemetryField[];
  grouped: Record<string, TelemetryField[]>;
};

export type OtaTimelineResponse = {
  updates: OtaUpdate[];
  total: number;
  recalls: number;
  features: number;
  latestVersion?: string;
};

export type ApiActionsResponse = {
  actions: ApiAction[];
  total: number;
  testedInScript: number;
  source: string;
  sourceUrl: string;
  testScriptUrl: string;
};

export type MonitoringSourcesResponse = {
  sources: MonitoringSource[];
};

export type MonitoringAlertsResponse = {
  alerts: MonitoringAlert[];
  total: number;
};

export type MonitoringStatusResponse = {
  checks: MonitoringCheck[];
  total: number;
};
