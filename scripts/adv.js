// adv.js — 自动推进 story-dialog 直到出现选项或结束
// 用法: node scripts/adv.js [maxClicks]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CMD_FILE = path.join(ROOT, 'promo', 'pcmd.json');
const RESULT_FILE = path.join(ROOT, 'promo', 'presult.json');

function sendCmd(cmd) {
  fs.writeFileSync(CMD_FILE, JSON.stringify({ ...cmd, t: Date.now() }));
}

function waitResult(timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fs.existsSync(RESULT_FILE)) {
      const stat = fs.statSync(RESULT_FILE);
      if (stat.mtimeMs > start - 100) {
        const r = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
        if (r.cmdId !== undefined) return r;
      }
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  return null;
}

const maxClicks = parseInt(process.argv[2] || '30');
let clicks = 0;
let found = false;

function step() {
  if (clicks >= maxClicks) {
    console.log('Reached max clicks: ' + maxClicks);
    return;
  }
  // Check for choices first
  sendCmd({ action: 'eval', code: "(function(){var choices=[...document.querySelectorAll('.choice')].filter(function(e){return e.offsetParent!==null}); if(choices.length>0){return 'CHOICES:'+choices.length} var sd=document.getElementById('story-dialog'); if(!sd||sd.hidden){return 'NODIALOG'} sd.click(); return 'CLICKED'})()", screenshot: false });
  const r = waitResult(15000);
  if (!r || !r.ok) { console.log('Error:', JSON.stringify(r)); return; }
  const val = r.value;
  if (val && val.indexOf('CHOICES:') === 0) {
    console.log('Found ' + val);
    found = true;
    // Take screenshot
    sendCmd({ action: 'screenshot', name: 'frame_adv_choices' });
    waitResult(10000);
    return;
  }
  if (val === 'NODIALOG') {
    console.log('No dialog after ' + clicks + ' clicks');
    // Take screenshot
    sendCmd({ action: 'screenshot', name: 'frame_adv_nodialog' });
    waitResult(10000);
    return;
  }
  clicks++;
  console.log('Clicked (' + clicks + '/' + maxClicks + ')');
  setTimeout(step, 800);
}

step();
