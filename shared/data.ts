// Lucid diagnostic dashboard data
// Sources: python-lucidmotors GitHub repo, LucidOwners forum, NHTSA, lucidupdates.com

export interface TelemetryField {
  key: string;
  label: string;
  value: string;
  unit: string;
  category: 'battery' | 'location' | 'climate' | 'vehicle';
  status: 'normal' | 'warning' | 'critical' | 'info';
  source: string;
  isDemo: boolean;
}

export interface OtaUpdate {
  version: string;
  date: string;
  title: string;
  description: string;
  category: 'feature' | 'bugfix' | 'recall' | 'security' | 'performance';
  sourceUrl: string;
  sourceName: string;
}

export interface ApiAction {
  name: string;
  category: 'vehicle-control' | 'charging' | 'climate' | 'security' | 'software' | 'telemetry' | 'session';
  description: string;
  methodSignature: string;
  sourceFile: string;
  testedInActions: boolean;
}

export interface MonitoringSource {
  name: string;
  url: string;
  type: 'github' | 'forum' | 'nhtsa';
  query: string;
  lastChecked: string;
  status: 'active' | 'pending';
}

// Demo telemetry data — representative of what python-lucidmotors returns
// Based on Vehicle state properties from lucidmotors/__init__.py
export const demoTelemetry: TelemetryField[] = [
  // Battery
  { key: 'battery_level', label: 'Battery Level', value: '78', unit: '%', category: 'battery', status: 'normal', source: 'state.battery.percent', isDemo: true },
  { key: 'battery_range', label: 'Estimated Range', value: '348', unit: 'mi', category: 'battery', status: 'normal', source: 'state.battery.range', isDemo: true },
  { key: 'battery_health', label: 'Battery Health', value: '98.2', unit: '%', category: 'battery', status: 'normal', source: 'state.battery.health', isDemo: true },
  { key: 'battery_temp', label: 'Battery Temperature', value: '24.5', unit: '°C', category: 'battery', status: 'normal', source: 'state.battery.temperature', isDemo: true },
  { key: 'battery_precon', label: 'Battery Preconditioning', value: 'Off', unit: '', category: 'battery', status: 'info', source: 'state.battery.precon_status', isDemo: true },
  // Charging
  { key: 'charge_state', label: 'Charge State', value: 'Idle', unit: '', category: 'battery', status: 'info', source: 'state.charging.state', isDemo: true },
  { key: 'charge_port', label: 'Charge Port', value: 'Closed', unit: '', category: 'battery', status: 'normal', source: 'state.charging.charge_port_door', isDemo: true },
  { key: 'ac_current_limit', label: 'AC Current Limit', value: '48', unit: 'A', category: 'battery', status: 'normal', source: 'state.charging.active_session_ac_current_limit', isDemo: true },
  { key: 'charge_limit', label: 'Charge Limit', value: '80', unit: '%', category: 'battery', status: 'normal', source: 'state.charging.charge_limit', isDemo: true },
  // Location
  { key: 'gps_lat', label: 'Latitude', value: '43.0481', unit: '°N', category: 'location', status: 'info', source: 'state.gps.latitude', isDemo: true },
  { key: 'gps_lon', label: 'Longitude', value: '-87.9074', unit: '°W', category: 'location', status: 'info', source: 'state.gps.longitude', isDemo: true },
  { key: 'gps_heading', label: 'Heading', value: '180', unit: '°', category: 'location', status: 'info', source: 'state.gps.heading', isDemo: true },
  { key: 'location_name', label: 'Location', value: 'New Berlin, WI', unit: '', category: 'location', status: 'info', source: 'state.gps.reverse_geocode', isDemo: true },
  { key: 'odometer', label: 'Odometer', value: '14,532', unit: 'mi', category: 'location', status: 'info', source: 'state.odometer', isDemo: true },
  // Climate
  { key: 'cabin_temp', label: 'Cabin Temperature', value: '21.0', unit: '°C', category: 'climate', status: 'normal', source: 'state.hvac.cabin_temperature', isDemo: true },
  { key: 'hvac_power', label: 'HVAC Power', value: 'Off', unit: '', category: 'climate', status: 'info', source: 'state.hvac.power', isDemo: true },
  { key: 'hvac_precondition', label: 'Preconditioning', value: 'Off', unit: '', category: 'climate', status: 'info', source: 'state.hvac.precondition_status', isDemo: true },
  { key: 'defrost_status', label: 'Defrost', value: 'Off', unit: '', category: 'climate', status: 'info', source: 'state.hvac.defrost_state', isDemo: true },
  { key: 'max_ac', label: 'Max AC', value: 'Off', unit: '', category: 'climate', status: 'info', source: 'state.hvac.max_ac_state', isDemo: true },
  { key: 'seat_climate', label: 'Seat Climate Mode', value: 'Auto', unit: '', category: 'climate', status: 'normal', source: 'state.hvac.seat_climate_mode', isDemo: true },
  { key: 'steering_heater', label: 'Steering Wheel Heater', value: 'Off', unit: '', category: 'climate', status: 'info', source: 'state.hvac.steering_heater_status', isDemo: true },
  // Vehicle state
  { key: 'power_state', label: 'Power State', value: 'Sleep', unit: '', category: 'vehicle', status: 'info', source: 'state.power', isDemo: true },
  { key: 'drive_mode', label: 'Drive Mode', value: 'Smooth', unit: '', category: 'vehicle', status: 'normal', source: 'state.drive_mode', isDemo: true },
  { key: 'gear_position', label: 'Gear', value: 'Park', unit: '', category: 'vehicle', status: 'info', source: 'state.gear', isDemo: true },
  { key: 'door_lock', label: 'Door Lock State', value: 'Locked', unit: '', category: 'vehicle', status: 'normal', source: 'state.lock', isDemo: true },
  { key: 'door_state', label: 'Door State', value: 'Closed', unit: '', category: 'vehicle', status: 'normal', source: 'state.body.door_state', isDemo: true },
  { key: 'window_position', label: 'Windows', value: 'Closed', unit: '', category: 'vehicle', status: 'normal', source: 'state.body.window_position', isDemo: true },
  { key: 'alarm_status', label: 'Alarm Status', value: 'Disarmed', unit: '', category: 'vehicle', status: 'normal', source: 'state.alarm.status', isDemo: true },
  { key: 'sentry_mode', label: 'Sentry Mode', value: 'Disabled', unit: '', category: 'vehicle', status: 'info', source: 'state.sentry.mode_state', isDemo: true },
  { key: 'software_version', label: 'Software Version', value: '2.8.17', unit: '', category: 'vehicle', status: 'normal', source: 'state.software_update.version', isDemo: true },
  { key: 'software_download', label: 'Update Download Status', value: 'Idle', unit: '', category: 'vehicle', status: 'info', source: 'state.software_update.download_status', isDemo: true },
  { key: 'tcu_state', label: 'Telematics Unit', value: 'Online', unit: '', category: 'vehicle', status: 'normal', source: 'state.tcu.state', isDemo: true },
  { key: 'lte_type', label: 'Cellular Connection', value: '5G', unit: '', category: 'vehicle', status: 'normal', source: 'state.tcu.lte_type', isDemo: true },
  { key: 'internet_status', label: 'Internet Status', value: 'Connected', unit: '', category: 'vehicle', status: 'normal', source: 'state.tcu.internet_status', isDemo: true },
  { key: 'tire_pressure_fl', label: 'Tire Pressure FL', value: '2.8', unit: 'bar', category: 'vehicle', status: 'normal', source: 'state.chassis.tire_pressure_fl', isDemo: true },
  { key: 'tire_pressure_fr', label: 'Tire Pressure FR', value: '2.9', unit: 'bar', category: 'vehicle', status: 'normal', source: 'state.chassis.tire_pressure_fr', isDemo: true },
  { key: 'tire_pressure_rl', label: 'Tire Pressure RL', value: '2.8', unit: 'bar', category: 'vehicle', status: 'normal', source: 'state.chassis.tire_pressure_rl', isDemo: true },
  { key: 'tire_pressure_rr', label: 'Tire Pressure RR', value: '2.9', unit: 'bar', category: 'vehicle', status: 'normal', source: 'state.chassis.tire_pressure_rr', isDemo: true },
  { key: 'model', label: 'Model', value: 'Air', unit: '', category: 'vehicle', status: 'info', source: 'config.model', isDemo: true },
  { key: 'model_variant', label: 'Variant', value: 'Grand Touring', unit: '', category: 'vehicle', status: 'info', source: 'config.model_variant', isDemo: true },
  { key: 'vin', label: 'VIN', value: '5YJSA1E47PF••••••', unit: '', category: 'vehicle', status: 'info', source: 'config.vin', isDemo: true },
];

// OTA Update timeline from LucidOwners forum, lucidupdates.com, NHTSA, and Recharged
export const otaTimeline: OtaUpdate[] = [
  { version: '1.0.2', date: '2021-11-14', title: 'Initial Production Release', description: 'First OTA update for customer vehicles. Core systems calibration and stability.', category: 'feature', sourceUrl: 'https://lucidowners.com/threads/release-version-megathread.555/', sourceName: 'LucidOwners Forum' },
  { version: '1.0.4', date: '2021-12-09', title: 'Early Stability Fixes', description: 'Bug fixes and system stability improvements.', category: 'bugfix', sourceUrl: 'https://lucidowners.com/threads/release-version-megathread.555/', sourceName: 'LucidOwners Forum' },
  { version: '1.0.6', date: '2021-12-16', title: 'System Refinements', description: 'Minor improvements and diagnostics upgrades.', category: 'bugfix', sourceUrl: 'https://lucidowners.com/threads/release-version-megathread.555/', sourceName: 'LucidOwners Forum' },
  { version: '1.0.8', date: '2022-01-11', title: 'New Year Update', description: 'General bug fixes and refinements.', category: 'bugfix', sourceUrl: 'https://lucidowners.com/threads/release-version-megathread.555/', sourceName: 'LucidOwners Forum' },
  { version: '1.2.1', date: '2022-03-29', title: 'Feature Drop', description: 'New features and improvements across multiple systems.', category: 'feature', sourceUrl: 'https://lucidowners.com/threads/release-version-megathread.555/', sourceName: 'LucidOwners Forum' },
  { version: '1.2.6', date: '2022-06-08', title: 'Navigation & Languages', description: 'New languages, key fob improvements, traffic sign recognition, navigation with offline mode, interactive maps, improved range estimates.', category: 'feature', sourceUrl: 'https://www.lucidinsider.com/2022/08/12/lucid-motors-releases-lucid-air-ota-software-update-v1-2-10-for-energy-charging-system/', sourceName: 'Lucid Insider' },
  { version: '1.2.76', date: '2022-07-27', title: 'Battery Warning System', description: 'Warns drivers when a concern with battery operation is detected by the vehicle.', category: 'security', sourceUrl: 'https://www.lucidinsider.com/2022/08/12/lucid-motors-releases-lucid-air-ota-software-update-v1-2-10-for-energy-charging-system/', sourceName: 'Lucid Insider' },
  { version: '1.2.10', date: '2022-08-12', title: 'Energy & Charging System', description: 'More accurate remaining charging time at cold temperatures, improved battery health monitoring, better cell balancing for range and accuracy.', category: 'performance', sourceUrl: 'https://www.lucidinsider.com/2022/08/12/lucid-motors-releases-lucid-air-ota-software-update-v1-2-10-for-energy-charging-system/', sourceName: 'Lucid Insider' },
  { version: '2.0.15', date: '2022-10-27', title: 'Lucid UX 2.0', description: 'Major UX overhaul. Redesigned interface, improved system performance, new features across the cockpit.', category: 'feature', sourceUrl: 'https://ir.lucidmotors.com/news-releases/news-release-details/introducing-lucid-ux-20-newest-over-air-software-update-shows/', sourceName: 'Lucid Group IR' },
  { version: '2.0.18', date: '2022-10-28', title: 'DreamDrive Highway Assist', description: 'Launch of Highway Assist within DreamDrive. Better sensor calibration. Required car not be plugged in during install.', category: 'feature', sourceUrl: 'https://recharged.com/articles/lucid-air-software-update-history', sourceName: 'Recharged' },
  { version: '2.0.33', date: '2022-11-25', title: 'SiriusXM Integration', description: 'SiriusXM satellite radio support added.', category: 'feature', sourceUrl: 'https://lucidowners.com/threads/release-version-megathread.555/', sourceName: 'LucidOwners Forum' },
  { version: '2.0.58', date: '2023-03-23', title: 'Apple CarPlay', description: 'Apple CarPlay support launched. Major connectivity milestone for owners.', category: 'feature', sourceUrl: 'https://lucidowners.com/threads/release-version-megathread.555/', sourceName: 'LucidOwners Forum' },
  { version: '2.0.66', date: '2023-05-08', title: 'Inverter Power Module Safety Recall', description: 'Safety recall: ensures drivers receive a minimum 2-minute warning before power loss during inverter failure. Pushed after 7 vehicles experienced unwarned power loss. NHTSA Recall 23V523.', category: 'recall', sourceUrl: 'https://static.nhtsa.gov/odi/rcl/2023/RCLRPT-23V523-8606.PDF', sourceName: 'NHTSA' },
  { version: '2.1.42', date: '2023-11-14', title: 'ADAS & Dashboard Improvements', description: 'ADAS improvements, SiriusXM Beta, dashboard widget, navigation updates.', category: 'feature', sourceUrl: 'https://lucidowners.com/threads/release-version-megathread.555/', sourceName: 'LucidOwners Forum' },
  { version: '2.1.52', date: '2024-02-06', title: 'Sapphire Torque & Battery Preconditioning', description: 'Sapphire torque vectoring improvements, modified battery preconditioning for better power management, coolant heater recall detection (NHTSA 24V495).', category: 'feature', sourceUrl: 'https://www.youtube.com/watch?v=3N2VPCXfEG4', sourceName: 'YouTube - Bobby @ Lucid' },
  { version: '2.3.0', date: '2024-07-23', title: 'Major Summer Update', description: 'Large feature update with navigation, DreamDrive, infotainment, and charging improvements.', category: 'feature', sourceUrl: 'https://lucidowners.com/threads/software-update-2-3-0.9495/', sourceName: 'LucidOwners Forum' },
  { version: '2.6.x', date: '2024-06-24', title: 'HVIL Safety Recall', description: 'High-voltage interlock logic updated to prevent sudden loss of drive power. Safety recall for 2022-2023 cars. NHTSA Recall 24V497.', category: 'recall', sourceUrl: 'https://www.cars.com/research/lucid/recalls/', sourceName: 'Cars.com / NHTSA' },
  { version: 'UX 2.4', date: '2024-09-01', title: 'DreamDrive Pro Overhaul', description: 'Highway Assist overhaul, lane change assist, curve speed control, Lucid Assistant voice, upgraded maps, app improvements. Transforms day-to-day driving experience.', category: 'feature', sourceUrl: 'https://recharged.com/articles/lucid-air-software-update-history', sourceName: 'Recharged' },
  { version: '2.8.0', date: '2025-08-01', title: 'Security, ADAS & Bug Fixes', description: 'New features in Security, ADAS, and much more as well as bug fixes and performance improvements. Introduced rear camera issue on AD02-equipped vehicles.', category: 'feature', sourceUrl: 'https://lucidowners.com/threads/2-8-0-software-update.13025/', sourceName: 'LucidOwners Forum' },
  { version: '2.8.17', date: '2025-12-05', title: 'Rear Camera Recall Remedy', description: 'Fixes blank/laggy rearview camera on AD02-equipped vehicles (2.8.0-2.8.16). Adjusts ACU startup process for consistent video performance. NHTSA Recall 26V017.', category: 'recall', sourceUrl: 'https://static.nhtsa.gov/odi/rcl/2026/RCLRPT-26V017-5599.pdf', sourceName: 'NHTSA' },
  { version: '2.10.0', date: '2026-07-20', title: 'Latest Feature Release', description: 'Air software version 2.10.0 with new features and improvements. Details being discussed in community forums.', category: 'feature', sourceUrl: 'https://lucidowners.com/whats-new/', sourceName: 'LucidOwners Forum' },
];

// Known community-decoded API actions from test_all_actions.py and lucidmotors/__init__.py
// Source: https://github.com/nshp/python-lucidmotors
export const apiActions: ApiAction[] = [
  // Session & Authentication
  { name: 'login', category: 'session', description: 'Authenticates with the Lucid Motors API using username and password.', methodSignature: 'login(username: str, password: str) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  { name: 'authentication_refresh', category: 'session', description: 'Refreshes the authentication token.', methodSignature: 'authentication_refresh() -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'close', category: 'session', description: 'Closes the API session and cleans up resources.', methodSignature: 'close() -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'session_time_remaining', category: 'session', description: 'Returns remaining session time as timedelta.', methodSignature: 'session_time_remaining -> timedelta', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  // Vehicle Management
  { name: 'fetch_vehicles', category: 'telemetry', description: 'Fetches and refreshes vehicle information for all vehicles on the account.', methodSignature: 'fetch_vehicles() -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  { name: 'vehicle_is_awake', category: 'telemetry', description: 'Checks if the vehicle is awake by inspecting its power state.', methodSignature: 'vehicle_is_awake(vehicle: Vehicle) -> bool', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'wakeup_vehicle', category: 'vehicle-control', description: 'Wakes up the vehicle from sleep state.', methodSignature: 'wakeup_vehicle(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  { name: 'user', category: 'telemetry', description: 'Returns the authenticated user profile.', methodSignature: 'user -> Optional[UserProfile]', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'vehicles', category: 'telemetry', description: 'Returns the list of vehicles on the account with full state.', methodSignature: 'vehicles -> list[Vehicle]', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  // Lights
  { name: 'lights_flash', category: 'vehicle-control', description: 'Flashes the vehicle lights.', methodSignature: 'lights_flash(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  { name: 'lights_on', category: 'vehicle-control', description: 'Turns on the vehicle lights.', methodSignature: 'lights_on(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'lights_off', category: 'vehicle-control', description: 'Turns off the vehicle lights.', methodSignature: 'lights_off(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  // Charge Port
  { name: 'charge_port_open', category: 'charging', description: 'Opens the charge port door.', methodSignature: 'charge_port_open(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  { name: 'charge_port_close', category: 'charging', description: 'Closes the charge port door.', methodSignature: 'charge_port_close(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  // Charging Control
  { name: 'start_charging', category: 'charging', description: 'Starts a charging session.', methodSignature: 'start_charging(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'stop_charging', category: 'charging', description: 'Stops an active charging session.', methodSignature: 'stop_charging(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'set_charge_limit', category: 'charging', description: 'Sets the maximum charge limit percentage.', methodSignature: 'set_charge_limit(vehicle: Vehicle, limit: int) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'set_ac_current_limit', category: 'charging', description: 'Sets the AC current limit for charging sessions.', methodSignature: 'set_ac_current_limit(vehicle: Vehicle, limit: int) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'get_ac_current_settings', category: 'charging', description: 'Retrieves current AC charging settings.', methodSignature: 'get_ac_current_settings(vehicle: Vehicle) -> dict', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  // Doors & Locks
  { name: 'doors_unlock', category: 'vehicle-control', description: 'Unlocks all doors.', methodSignature: 'doors_unlock(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  { name: 'doors_lock', category: 'vehicle-control', description: 'Locks all doors.', methodSignature: 'doors_lock(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  // Frunk & Trunk
  { name: 'frunk_open', category: 'vehicle-control', description: 'Opens the frunk (front trunk).', methodSignature: 'frunk_open(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  { name: 'frunk_close', category: 'vehicle-control', description: 'Closes the frunk.', methodSignature: 'frunk_close(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  { name: 'trunk_open', category: 'vehicle-control', description: 'Opens the trunk.', methodSignature: 'trunk_open(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  { name: 'trunk_close', category: 'vehicle-control', description: 'Closes the trunk.', methodSignature: 'trunk_close(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  // Horn
  { name: 'honk_horn', category: 'vehicle-control', description: 'Honks the vehicle horn.', methodSignature: 'honk_horn(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  // Climate
  { name: 'set_cabin_temperature', category: 'climate', description: 'Sets the cabin temperature (15.0-30.0°C). Requires HVAC preconditioning.', methodSignature: 'set_cabin_temperature(vehicle: Vehicle, temp: float) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'defrost_on', category: 'climate', description: 'Turns on defrost.', methodSignature: 'defrost_on(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  { name: 'defrost_off', category: 'climate', description: 'Turns off defrost.', methodSignature: 'defrost_off(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: true },
  { name: 'max_ac_on', category: 'climate', description: 'Turns on maximum AC.', methodSignature: 'max_ac_on(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'max_ac_off', category: 'climate', description: 'Turns off maximum AC.', methodSignature: 'max_ac_off(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'seat_climate_control', category: 'climate', description: 'Controls seat climate (heating/ventilation).', methodSignature: 'seat_climate_control(vehicle: Vehicle, ...) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'steering_wheel_heater_control', category: 'climate', description: 'Controls the steering wheel heater.', methodSignature: 'steering_wheel_heater_control(vehicle: Vehicle, ...) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'creature_comfort_control', category: 'climate', description: 'Controls creature comfort settings.', methodSignature: 'creature_comfort_control(vehicle: Vehicle, ...) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  // Battery Preconditioning
  { name: 'battery_precon_on', category: 'charging', description: 'Turns on battery preconditioning.', methodSignature: 'battery_precon_on(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'battery_precon_off', category: 'charging', description: 'Turns off battery preconditioning.', methodSignature: 'battery_precon_off(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  // Windows
  { name: 'close_all_windows', category: 'vehicle-control', description: 'Closes all windows.', methodSignature: 'close_all_windows(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'open_all_windows', category: 'vehicle-control', description: 'Opens (vents) all windows.', methodSignature: 'open_all_windows(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  // Sentry / Security
  { name: 'sentry_mode_on', category: 'security', description: 'Enables sentry mode.', methodSignature: 'sentry_mode_on(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'sentry_mode_off', category: 'security', description: 'Disables sentry mode.', methodSignature: 'sentry_mode_off(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'enhanced_deterrence_on', category: 'security', description: 'Enables enhanced deterrence system.', methodSignature: 'enhanced_deterrence_on(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'enhanced_deterrence_off', category: 'security', description: 'Disables enhanced deterrence system.', methodSignature: 'enhanced_deterrence_off(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'get_sentry_events', category: 'security', description: 'Retrieves sentry mode event recordings.', methodSignature: 'get_sentry_events(vehicle: Vehicle, ...) -> list', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'get_sentry_event', category: 'security', description: 'Retrieves a specific sentry mode event.', methodSignature: 'get_sentry_event(vehicle: Vehicle, event_id: str) -> bytes', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'turn_off_sentry_alarm', category: 'security', description: 'Turns off the sentry alarm.', methodSignature: 'turn_off_sentry_alarm(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  // Software Updates
  { name: 'get_update_release_notes', category: 'software', description: 'Retrieves release notes for a software update.', methodSignature: 'get_update_release_notes(vehicle: Vehicle, ...) -> str', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'apply_update', category: 'software', description: 'Applies a pending software update to the vehicle.', methodSignature: 'apply_update(vehicle: Vehicle) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  // Profile
  { name: 'set_profile_photo', category: 'session', description: 'Sets the user profile photo.', methodSignature: 'set_profile_photo(image: bytes) -> None', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'get_referral_history', category: 'session', description: 'Retrieves referral history.', methodSignature: 'get_referral_history() -> list', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
  { name: 'get_owners_manual', category: 'session', description: 'Retrieves the owner manual document.', methodSignature: 'get_owners_manual(vehicle: Vehicle) -> bytes', sourceFile: 'lucidmotors/__init__.py', testedInActions: false },
];

// Monitoring sources for community breakthroughs
export const monitoringSources: MonitoringSource[] = [
  { name: 'python-lucidmotors (GitHub)', url: 'https://github.com/nshp/python-lucidmotors', type: 'github', query: 'new commits, issues, and PRs with decoded API actions', lastChecked: 'Never', status: 'pending' },
  { name: 'LucidOwners - Software & Firmware', url: 'https://lucidowners.com/forums/air-software-firmware.131/', type: 'forum', query: 'new threads about API reverse engineering, decoded endpoints, software issues', lastChecked: 'Never', status: 'pending' },
  { name: 'LucidOwners - Release Megathread', url: 'https://lucidowners.com/threads/release-version-megathread.555/', type: 'forum', query: 'new OTA version announcements and community analysis', lastChecked: 'Never', status: 'pending' },
  { name: 'NHTSA Recalls (Lucid)', url: 'https://www.nhtsa.gov/recalls', type: 'nhtsa', query: 'new safety recalls and software remedy campaigns', lastChecked: 'Never', status: 'pending' },
  { name: 'GitHub lucidmotors topic', url: 'https://github.com/topics/lucidmotors', type: 'github', query: 'new repos and projects related to Lucid API integration', lastChecked: 'Never', status: 'pending' },
  { name: 'Lucid Motors Forum (EU)', url: 'https://www.lucid-forum.com/', type: 'forum', query: 'European community API and software discussions', lastChecked: 'Never', status: 'pending' },
];

// Enum data for reference
export const enumData = {
  powerStates: ['Unknown', 'Sleep', 'Wink', 'Accessory', 'Drive', 'Live/Charge', 'Sleep/Charge', 'Live/Update', 'Cloud 2', 'Monitor'],
  driveModes: ['Unknown', 'Smooth', 'Swift', 'Winter', 'Valet', 'Sprint', 'Service', 'Launch', 'Factory', 'Transport', 'Tow', 'Test Drive'],
  gearPositions: ['Unknown', 'Park', 'Reverse', 'Neutral', 'Drive'],
  modelVariants: ['Unknown', 'Dream Edition', 'Grand Touring', 'Touring', 'Pure', 'Sapphire'],
  energyTypes: ['Unknown', 'AC', 'DC', 'V2V'],
  alarmModes: ['Unknown', 'On', 'Off', 'Silent'],
  chargingStates: ['Idle', 'Charging', 'Charging Complete', 'Fault', 'Disconnected'],
  tcuDownloadStatuses: ['Unknown', 'Idle', 'Downloading', 'Paused', 'Complete', 'Failed', 'Canceled'],
};

export const apiSourceUrl = 'https://github.com/nshp/python-lucidmotors';
export const apiSourceName = 'nshp/python-lucidmotors';
