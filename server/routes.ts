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
import { analyzeCapture } from "./diagnostics/pcap";
import { getLiveEnvironmentInfo, listLiveNetworkInterfaces } from "./diagnostics/live";
import {
  getPassiveCaptureSnapshot,
  getTsharkReadiness,
  listTsharkInterfaces,
  startPassiveCapture,
  stopPassiveCapture,
} from "./diagnostics/tshark";
import { db } from "./storage";
import { monitoringAlerts, monitoringChecks, diagnosticSessions } from "../shared/schema";
import { desc } from "drizzle-orm";

export function registerRoutes(_server: Server, app: Express) {
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

  app.get("/api/diagnostics/live", async (_req, res) => {
    const readiness = await getTsharkReadiness();
    let captureInterfaces: unknown[] = [];
    if (readiness.installed) {
      try {
        captureInterfaces = await listTsharkInterfaces();
      } catch {
        captureInterfaces = [];
      }
    }
    res.json({
      environment: getLiveEnvironmentInfo(),
      interfaces: listLiveNetworkInterfaces(),
      capture: {
        readiness,
        interfaces: captureInterfaces,
        snapshot: getPassiveCaptureSnapshot(),
      },
    });
  });

  app.get("/api/diagnostics/live/status", (req, res) => {
    const after = Number.parseInt(String(req.query.after ?? "0"), 10);
    res.json(getPassiveCaptureSnapshot(Number.isFinite(after) ? Math.max(0, after) : 0));
  });

  app.post("/api/diagnostics/live/start", async (req, res) => {
    try {
      const interfaceId = typeof req.body?.interfaceId === "string" ? req.body.interfaceId.trim() : "";
      if (!interfaceId) return res.status(400).json({ message: "Select a TShark/Npcap capture interface first." });
      res.json(await startPassiveCapture(interfaceId));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Unable to start passive capture." });
    }
  });

  app.post("/api/diagnostics/live/stop", (_req, res) => {
    res.json(stopPassiveCapture());
  });

  app.get("/api/diagnostics/sessions", (_req, res) => {
    try {
      const sessions = db.select().from(diagnosticSessions).orderBy(desc(diagnosticSessions.createdAt)).limit(100).all();
      res.json({ sessions, total: sessions.length });
    } catch {
      res.json({ sessions: [], total: 0 });
    }
  });

  app.post("/api/diagnostics/sessions", (req, res) => {
    try {
      const name = typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim() : "Diagnostic session";
      const sourceType = typeof req.body?.sourceType === "string" ? req.body.sourceType : "manual";
      const createdAt = new Date().toISOString();
      const values = {
        name,
        sourceType,
        platform: typeof req.body?.platform === "string" ? req.body.platform : null,
        interfaceName: typeof req.body?.interfaceName === "string" ? req.body.interfaceName : null,
        interfaceAddress: typeof req.body?.interfaceAddress === "string" ? req.body.interfaceAddress : null,
        captureFormat: typeof req.body?.captureFormat === "string" ? req.body.captureFormat : null,
        capturePath: typeof req.body?.capturePath === "string" ? req.body.capturePath : null,
        packetCount: Number.isFinite(req.body?.packetCount) ? Math.max(0, Math.trunc(req.body.packetCount)) : 0,
        doipFrameCount: Number.isFinite(req.body?.doipFrameCount) ? Math.max(0, Math.trunc(req.body.doipFrameCount)) : 0,
        udsMessageCount: Number.isFinite(req.body?.udsMessageCount) ? Math.max(0, Math.trunc(req.body.udsMessageCount)) : 0,
        ecuCount: Number.isFinite(req.body?.ecuCount) ? Math.max(0, Math.trunc(req.body.ecuCount)) : 0,
        notes: typeof req.body?.notes === "string" ? req.body.notes : null,
        createdAt,
      };
      const inserted = db.insert(diagnosticSessions).values(values).returning().get();
      res.status(201).json({ session: inserted });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Unable to save diagnostic session." });
    }
  });

  app.post("/api/diagnostics/doip/decode", (req, res) => {
    try {
      const hex = typeof req.body?.hex === "string" ? req.body.hex : "";
      const frame = decodeDoipFrame(hex);
      res.json({ frame, decoder: doipDecoderInfo });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Unable to decode DoIP frame." });
    }
  });

  app.post("/api/diagnostics/pcap/analyze", (req, res) => {
    try {
      const base64 = typeof req.body?.base64 === "string" ? req.body.base64 : "";
      if (!base64) return res.status(400).json({ message: "Missing base64 capture payload." });
      const capture = Buffer.from(base64, "base64");
      if (!capture.length) return res.status(400).json({ message: "Capture payload is empty." });
      if (capture.length > 25 * 1024 * 1024) return res.status(413).json({ message: "Capture is larger than the 25 MB inline analysis limit." });
      res.json(analyzeCapture(capture));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Unable to analyze capture." });
    }
  });

  app.get("/api/ota-timeline", (_req, res) => {
    res.json({
      updates: otaTimeline,
      total: otaTimeline.length,
      recalls: otaTimeline.filter((u: OtaUpdate) => u.category === "recall").length,
      features: otaTimeline.filter((u: OtaUpdate) => u.category === "feature").length,
      latestVersion: otaTimeline[otaTimeline.length - 1]?.version,
    });
  });

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

  app.get("/api/monitoring/sources", (_req, res) => res.json({ sources: monitoringSources }));

  app.get("/api/monitoring/alerts", (_req, res) => {
    try {
      const alerts = db.select().from(monitoringAlerts).orderBy(desc(monitoringAlerts.createdAt)).limit(50).all();
      res.json({ alerts, total: alerts.length });
    } catch { res.json({ alerts: [], total: 0 }); }
  });

  app.get("/api/monitoring/status", (_req, res) => {
    try {
      const checks = db.select().from(monitoringChecks).all();
      res.json({ checks, total: checks.length });
    } catch { res.json({ checks: [], total: 0 }); }
  });

  app.get("/api/enums", (_req, res) => res.json(enumData));

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
