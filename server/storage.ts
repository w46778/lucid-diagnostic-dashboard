import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { monitoringAlerts, monitoringChecks } from "@shared/schema";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Create tables on startup
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS monitoring_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    summary TEXT,
    severity TEXT NOT NULL DEFAULT 'info',
    created_at TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS monitoring_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_type TEXT NOT NULL,
    last_checked_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    new_items_found INTEGER DEFAULT 0
  );
`);

export { monitoringAlerts, monitoringChecks };
