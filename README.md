# Lucid Diagnostic Dashboard

Community diagnostic dashboard for Lucid Air vehicles — telemetry, OTA timeline, decoded API actions from `python-lucidmotors`, and email monitoring alerts.

## Features

- **Overview Dashboard** — KPI cards, vehicle status, battery/charging, location/climate summaries
- **Real-Time Telemetry** — 41 fields (battery, location, climate, vehicle state) from the python-lucidmotors data model, auto-refreshing every 30s
- **OTA Update Timeline** — 21 software updates (2021–2026) from LucidOwners forum, NHTSA, Recharged, and lucidupdates.com
- **Decoded API Actions** — 50 methods from `nshp/python-lucidmotors`, including 15 tested in `test_all_actions.py`
- **Email Monitoring** — Recurring task (every 6 hours) that alerts on new community API breakthroughs and software-issue reports

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Express + SQLite (Drizzle ORM)
- **Data Sources:** [python-lucidmotors](https://github.com/nshp/python-lucidmotors), [LucidOwners Forum](https://lucidowners.com), [NHTSA](https://www.nhtsa.gov/recalls)

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (port 5000)
npm run dev

# Build for production
npm run build

# Start production server
NODE_ENV=production node dist/index.cjs
```

## Upgrade Workflow

When you push changes to the `main` branch of this repository, the connected monitoring task will detect them and prompt you to redeploy:

1. **Make changes** — edit files, add features, update data in `shared/data.ts`
2. **Push to GitHub** — `git push origin main`
3. **Monitoring detects changes** — you'll get an in-app notification within a few hours
4. **Redeploy** — ask Computer to "pull and redeploy the Lucid dashboard" in any conversation

### Manual Redeploy

If you want to redeploy immediately without waiting for the monitoring check:

> "Pull the latest code from my lucid-diagnostic-dashboard GitHub repo and redeploy the dashboard"

Computer will:
1. Pull the latest code from `w46778/lucid-diagnostic-dashboard`
2. Run `npm install` and `npm run build`
3. Restart the production server
4. Redeploy the updated dashboard

## Project Structure

```
client/           # React frontend
  src/
    components/    # UI components (sidebar, topbar, layout)
    pages/         # Dashboard pages (overview, telemetry, ota-timeline, api-actions, monitoring)
    lib/           # Query client, utilities
shared/           # Shared types and data
  data.ts          # Telemetry, OTA timeline, API actions data
  schema.ts        # Database schema
server/            # Express backend
  routes.ts         # API routes
  storage.ts        # SQLite database setup
```

## Data Sources

| Source | Type | URL |
|--------|------|-----|
| python-lucidmotors | GitHub repo | https://github.com/nshp/python-lucidmotors |
| LucidOwners Forum | Community forum | https://lucidowners.com |
| NHTSA Recalls | Government | https://www.nhtsa.gov/recalls |
| Recharged | Blog | https://recharged.com |
| lucidupdates.com | OTA tracker | https://www.lucidupdates.com |

## Demo Mode

The dashboard runs in demo mode with representative Lucid Air Grand Touring data. To enable live vehicle telemetry, configure Lucid account credentials through a backend environment variable — never commit credentials to the repository.

## License

Unofficial community project. Not affiliated with Lucid Motors.
