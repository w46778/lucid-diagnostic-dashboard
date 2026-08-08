# Windows Field Laptop Setup

This project treats Windows as the primary field-laptop platform for Lucid diagnostic research.

## Current live scope

The live adapter is intentionally passive:

- captures observed Ethernet traffic through Wireshark/TShark + Npcap
- applies capture filter `tcp port 13400 or udp port 13400`
- records the same filtered traffic to a local raw `.pcapng` file
- applies a configurable raw-capture size limit to protect laptop storage
- validates that the raw PCAPNG can be read after the writer closes
- decodes observed DoIP frames
- passively decodes observed UDS messages
- builds a cumulative logical ECU-address inventory
- keeps a rolling live-event buffer while preserving full-session counters
- does **not** send DoIP discovery requests
- does **not** activate diagnostic routing
- does **not** send UDS requests
- does **not** implement SecurityAccess bypass, writes, configuration changes, or flashing

## Recommended Windows laptop software

1. Git for Windows
2. Node.js LTS
3. Wireshark with Npcap enabled during installation
4. A current Ethernet driver for the laptop's physical Ethernet adapter or USB Ethernet adapter

TShark is installed with Wireshark and is used as the packet-capture backend.

## Install the dashboard

Open PowerShell:

```powershell
git clone https://github.com/w46778/lucid-diagnostic-dashboard.git
cd lucid-diagnostic-dashboard
git checkout agent/diagnostic-foundation
npm ci
npm run check
npm test
npm run build
npm run dev
```

Then open the local URL printed by the application, normally:

```text
http://127.0.0.1:5000
```

The dashboard binds to localhost by default. Only set `HOST=0.0.0.0` if you intentionally want to expose it to other devices on the local network.

When PR #1 is merged, the explicit branch checkout can be removed from these instructions.

## Verify TShark manually

In PowerShell:

```powershell
& "C:\Program Files\Wireshark\tshark.exe" -v
& "C:\Program Files\Wireshark\tshark.exe" -D
```

The first command should print the TShark version. The second should list Npcap capture interfaces.

If TShark is already on PATH, these shorter commands also work:

```powershell
tshark -v
tshark -D
```

## Raw capture storage

Each passive live capture creates a PCAPNG file under the local `captures` directory by default:

```text
captures/lucid-doip-YYYY-MM-DDTHH-MM-SS-sssZ.pcapng
```

You can override the directory with the `CAPTURE_DIR` environment variable. Raw captures are excluded from Git and should be treated as potentially sensitive vehicle diagnostic data.

Raw recording has a default maximum file size of **2048 MB**. Override it before startup if needed:

```powershell
$env:RAW_CAPTURE_MAX_MB = "4096"
npm run dev
```

When the configured limit is reached, the raw writer stops so it cannot continue growing the file, while the live decoder may continue observing traffic. The Live Connection page shows a warning when this happens.

After the raw writer closes, the backend asks TShark to read the saved file locally. Live Connection reports the result as `VALID` or `INVALID`. When stopping a capture normally, wait for that validation state before saving the session summary. A zero-DoIP capture can still be saved because absence of matching traffic is useful diagnostic evidence.

The diagnostic session history stores the local capture path together with packet, DoIP, UDS, and ECU counts so the original capture can be reprocessed with newer decoders later.

## Hardware path for the first passive test

```text
Lucid vehicle network
        |
100/1000BASE-T1 Automotive Ethernet
        |
RAD-Moon 2 / compatible media converter or approved tap
        |
standard Ethernet
        |
Windows laptop Ethernet interface
        |
Npcap / TShark
        |
Lucid Diagnostic Dashboard
```

Use the correct automotive Ethernet harness/connector for the target link. Do not connect unknown pins or guess connector pinouts.

## First Windows readiness test without a vehicle

1. Start the dashboard.
2. Open **Live Connection**.
3. Confirm `TShark / Npcap = Ready`.
4. Confirm `Raw recording = PCAPNG enabled` and review the configured size limit.
5. Confirm `Vehicle Transmit = DISABLED`.
6. Confirm the expected Windows Ethernet adapter appears.
7. Confirm TShark capture interfaces are listed.
8. Save a readiness session.

Do this before connecting the automotive Ethernet hardware.

## First passive vehicle capture

The initial vehicle test should be observation-only:

1. Connect the approved media-converter/tap path.
2. Confirm Ethernet link state on the hardware.
3. Open **Live Connection**.
4. Select the matching TShark/Npcap interface.
5. Start **Passive Capture**.
6. Confirm a raw PCAPNG path appears and its size begins increasing when matching traffic is present.
7. Observe packet count, DoIP frame count, ECU logical addresses, and any already-present UDS traffic.
8. Stop capture.
9. Confirm Raw Validation changes from `PENDING` to `VALID` or inspect any validation warning.
10. Save the capture summary and confirm the raw capture path appears in session history. Save the session even when no DoIP frames were observed if the test itself was valid.

No diagnostic request needs to be sent for this first test.

## Automated Windows validation

GitHub Actions validates the branch on `windows-latest` by running:

```text
npm ci
npm run check
npm test
npm run build
```

It then starts the production server on `127.0.0.1` and performs an HTTP smoke test against `/api/diagnostics`. This catches Windows startup failures that a build-only CI job would miss.

## What success looks like

Any of the following is useful evidence:

- DoIP vehicle announcement / identification response
- traffic on TCP or UDP port 13400
- one or more DoIP logical addresses
- source/target ECU relationships
- observed UDS request/response traffic generated by another legitimate vehicle component or service tool
- a reusable PCAPNG capture that can be analyzed again offline

A capture with zero DoIP traffic is also useful: it can mean the selected physical link/interface is not the diagnostic path, the vehicle/network is asleep, the topology is switched, or no DoIP traffic is naturally present at that moment.

## Next diagnostic stage

Only after passive capture is validated should the project evaluate authorized read-only diagnostic communication such as ECU identification or DTC reads. Those features should remain separate from protected write/programming operations.
