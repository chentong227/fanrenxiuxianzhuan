// Helper: send command to play2.js and wait for result
// Usage: node scripts/cmd.js '{"action":"screenshot"}'
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CMD_FILE = path.join(ROOT, 'promo', 'cmd.json');
const RESULT_FILE = path.join(ROOT, 'promo', 'result.json');

const cmd = process.argv[2] || '{"action":"screenshot"}';
const waitMs = parseInt(process.argv[3] || '3000', 10);

// Clear old result
try { fs.unlinkSync(RESULT_FILE); } catch(e) {}
// Write command
fs.writeFileSync(CMD_FILE, cmd);

// Wait for result
setTimeout(() => {
  try {
    const r = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
    console.log(JSON.stringify(r, null, 2));
  } catch(e) {
    console.log('No result yet');
  }
}, waitMs);
