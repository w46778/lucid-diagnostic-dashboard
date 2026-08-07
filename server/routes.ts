import type { Express } from "express";
import type { Server } from "node:http";
import {
  demoTelemetry,
  otaTimeline,
  apiActions,
  monitoringSources,
  enumData,
  apiSourceUrl,
  apiSourceName,
  type TelemetryField,
  type OtaUpdate,
  type ApiAction,
} from "../shared/data";
import {
  diagnosticCapabilities,
  demoEcus,
  demoDtcs,
  demoDids,
} from "../shared/diagnostics";
import { decodeDoipFrame, doipDecoderInfo } from "./diagnostics/doip";
import { db } from "./storage";
import { monitoringAlerts, monitoringChecks } from "../shared/schema";
import { desc } from "drizzle-orm";

export function registerRoutes(_server: Server, app: Express) {
  // Telemetry endpoint — returns demo vehicle telemetry data
  app.get("/api/telemetry", (_req, res) => {
    const grouped: Record<string, TelemetryField[]> = {};
    for (const field of demoTelemetry) {
      if (!grouped[field.category]) grouped[field.category] = [];
      grouped[field.category].push(field);
    }
    res.json({
      vehicle: "Lucid Air Grand Touring",
      vin: "5YJSA1E47PF••••••",
      softwareVersion: "2.8.17",
      lastUpdated: new Date().toISOString(),
      isDemoMode: true,
      fields: demoTelemetry,
      grouped,
    });
  });

  // Diagnostics research endpoint. Intentionally read-only: no flashing,
  // configuration writes, security bypasses, or guessed proprietary IDs.
  app.get("/api/diagnostics", (_req, res) => {
    res.json({
      mode: "research",
      capabilities: diagnosticCapabilities,
      ecus: demoEcus,
      dtcs: demoDtcs,
      dids: demoDids,
      doip: doipDecoderInfo,
      safeguards: {
        writeOperationsEnabled: false,
        securityBypassImplemented: false,
        proprietaryMappingsPreFilled: false,
      },
    });
  });

  // Offline DoIP capture decoder. This endpoint parses user-supplied bytes only;
  // it never opens a socket to a vehicle or transmits diagnostic traffic.
  app.post("/api/diagnostics/doip/decode", (req, res) => {
    try {
      const hex = typeof req.body?.hex === "string" ? req.body.hex : "";
      const frame = decodeDoipFrame(hex);
      res.json({ frame, decoder: doipDecoderInfo });
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Unable to decode DoIP frame.",
      });
    }
  });

  // OTA Timeline endpoint
  app.get("/api/ota-timeline", (_req, res) => {
    res.json({
      updates: otaTimeline,
      total: otaTimeline.length,
      recalls: otaTimeline.filter((u: OtaUpdate) => u.category === "recall").length,
      features: otaTimeline.filter((u: OtaUpdate) => u.category === "feature").length,
      latestVersion: otaTimeline[otaTimeline.length - 1]?.version,
    });
  });

  // API Actions endpoint
  app.get("/api/actions", (_req, res) => {
    const testedActions = apiActions.filter((a: ApiAction) => a.testedInActions);
    res.json({
      actions: apiActions,
      total: apiActions.length,
      testedInScript: testedActions.length,
      source: apiSourceName,
      sourceUrl: apiSourceUrl,
      testScriptUrl: `${apiSourceUrl}/blob/main/examples/test_all_actions.py`,
    });
  });

  // Monitoring sources endpoint
  app.get("/api/monitoring/sources", (_req, res) => {
    res.json({ sources: monitoringSources });
  });

  // Monitoring alerts from DB
  app.get("/api/monitoring/alerts", (_req, res) => {
    try {
      const alerts = db.select().from(monitoringAlerts).orderBy(desc(monitoringAlerts.createdAt)).limit(50).all();
      res.json({ alerts, total: alerts.length });
    } catch {
      res.json({ alerts: [], total: 0 });
    }
  });

  // Monitoring checks from DB
  app.get("/api/monitoring/status", (_req, res) => {
    try {
      const checks = db.select().from(monitoringChecks).all();
      res.json({ checks, total: checks.length });
    } catch {
      res.json({ checks: [], total: 0 });
    }
  });

  // Enum reference data
  app.get("/api/enums", (_req, res) => {
    res.json(enumData);
  });

  // Dashboard stats
  app.get("/api/stats", (_req, res) => {
    res.json({
      telemetryFields: demoTelemetry.length,
      otaUpdates: otaTimeline.length,
      apiActions: apiActions.length,
      monitoredSources: monitoringSources.length,
      diagnosticCapabilities: diagnosticCapabilities.length,
      apiSource: apiSourceName,
      latestSoftware: "2.8.17",
      vehicleModel: "Lucid Air Grand Touring",
      isDemoMode: true,
    });
  });
}
