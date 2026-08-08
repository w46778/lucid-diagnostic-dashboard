import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { monitoringAlerts, monitoringChecks, diagnosticSessions } from "@shared/schema";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

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

  CREATE TABLE IF NOT EXISTS diagnostic_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    platform TEXT,
    interface_name TEXT,
    interface_address TEXT,
    capture_format TEXT,
    capture_path TEXT,
    packet_count INTEGER NOT NULL DEFAULT 0,
    doip_frame_count INTEGER NOT NULL DEFAULT 0,
    uds_message_count INTEGER NOT NULL DEFAULT 0,
    ecu_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL
  );
`);

// Lightweight startup migration for databases created before raw capture files
// were linked to diagnostic sessions.
const diagnosticSessionColumns = sqlite.prepare("PRAGMA table_info(diagnostic_sessions)").all() as Array<{ name: string }>;
if (!diagnosticSessionColumns.some((column) => column.name === "capture_path")) {
  sqlite.exec("ALTER TABLE diagnostic_sessions ADD COLUMN capture_path TEXT");
}

export { monitoringAlerts, monitoringChecks, diagnosticSessions };
