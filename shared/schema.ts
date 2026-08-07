import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Monitoring alert log — tracks alerts sent by the monitoring system
export const monitoringAlerts = sqliteTable("monitoring_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  summary: text("summary"),
  severity: text("severity").notNull().default("info"), // info, warning, critical
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// Monitoring check history — tracks when each source was last checked
export const monitoringChecks = sqliteTable("monitoring_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceType: text("source_type").notNull(),
  lastCheckedAt: text("last_checked_at"),
  status: text("status").notNull().default("pending"),
  newItemsFound: integer("new_items_found").default(0),
});

// Insert schemas
export const insertMonitoringAlertSchema = {
  source: "string",
  title: "string",
  url: "string",
  summary: "string",
  severity: "info",
};

export const insertMonitoringCheckSchema = {
  sourceName: "string",
  sourceUrl: "string",
  sourceType: "string",
  lastCheckedAt: null,
  status: "pending",
  newItemsFound: 0,
};

export type InsertMonitoringAlert = typeof insertMonitoringAlertSchema;
export type MonitoringAlert = typeof monitoringAlerts.$inferSelect;
export type MonitoringCheck = typeof monitoringChecks.$inferSelect;
