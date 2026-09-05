const config = require('./config');

const startSimulatorFoundation = () => {
  console.log('====================================================');
  console.log('  SecureWatch IoT — Device Fleet Simulator Engine  ');
  console.log('====================================================');
  console.log(`[Phase 1 Baseline] Simulator initialized.`);
  console.log(`Target API URL:   ${config.apiUrl}`);
  console.log(`Target MQTT URL:  ${config.mqttUrl}`);
  console.log(`Target Org Slug:  ${config.orgSlug}`);
  console.log(`Device Profiles:  ${config.deviceProfiles.join(', ')}`);
  console.log('----------------------------------------------------');
  console.log('Status: Engine foundation ready. Awaiting Phase 5 (Normal Telemetry Generation).');
  console.log('====================================================');
};

if (require.main === module) {
  startSimulatorFoundation();
}

module.exports = { startSimulatorFoundation };
