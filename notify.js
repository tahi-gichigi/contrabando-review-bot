// notify.js — thin CJS wrapper around ui/lib/notify.js
// ui/lib/notify.js is the canonical source of truth for notification logic.
//
// Usage: const { sendWhatsApp, sendAlert } = require('./notify');

require('dotenv').config();

let _module = null;
async function _load() {
  if (!_module) _module = await import('./ui/lib/notify.js');
  return _module;
}

module.exports = {
  sendWhatsApp: async (...args) => (await _load()).sendWhatsApp(...args),
  sendAlert: async (...args) => (await _load()).sendAlert(...args)
};

// Quick test when run directly
if (require.main === module) {
  (async () => {
    const { sendWhatsApp } = await _load();
    const ok = await sendWhatsApp(1, 'Test User', 'Test negative review notification.');
    console.log('Notification result:', ok);
  })().catch(console.error);
}
