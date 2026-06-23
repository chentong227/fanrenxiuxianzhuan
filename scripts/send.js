// send.js — 向 play6.js 持久化浏览器发送命令
// 用法：node scripts/send.js <action> [args]
//   node scripts/send.js status
//   node scripts/send.js eval "code"
//   node scripts/send.js advance 15
//   node scripts/send.js choose 0
//   node scripts/send.js shot frame_xxx
//   node scripts/send.js text
//   node scripts/send.js save
//   node scripts/send.js stop
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CMD_FILE = path.join(ROOT, 'promo', 'pcmd.json');
const RESULT_FILE = path.join(ROOT, 'promo', 'presult.json');

const action = process.argv[2] || 'status';
const cmd = { action };

if (action === 'eval') cmd.code = process.argv[3];
if (action === 'advance') cmd.maxSteps = process.argv[3] || '15';
if (action === 'choose') cmd.index = process.argv[3] || '0';
if (action === 'shot' || action === 'screenshot') {
  cmd.action = 'screenshot';
  cmd.name = process.argv[3];
}
if (action === 'clickText') cmd.text = process.argv[3];
if (action === 'clickSel') { cmd.action = 'click'; cmd.selector = process.argv[3]; }
// 真实点击命令
if (action === 'tap') { cmd.action = 'tap'; cmd.wait = process.argv[3]; }
if (action === 'tapAction') { cmd.action = 'tapAction'; cmd.act = process.argv[3]; cmd.wait = process.argv[4]; }
if (action === 'tapChoice') { cmd.action = 'tapChoice'; cmd.index = process.argv[3] || '0'; cmd.wait = process.argv[4]; }
if (action === 'tapSkip') { cmd.action = 'tapSkip'; }
if (action === 'tapTab') { cmd.action = 'tapTab'; cmd.text = process.argv[3]; }
if (action === 'tapModal') { cmd.action = 'tapModal'; cmd.text = process.argv[3]; cmd.wait = process.argv[4]; }
if (action === 'tapSpell') { cmd.action = 'tapSpell'; cmd.text = process.argv[3]; }
if (action === 'tapEndRound') { cmd.action = 'tapEndRound'; }
if (action === 'closeModal') { cmd.action = 'closeModal'; }
const lastArg = process.argv[process.argv.length - 1];
if (lastArg && lastArg.startsWith('name=')) {
  cmd.name = lastArg.substring(5);
}

fs.writeFileSync(CMD_FILE, JSON.stringify(cmd));

const waitMs = action === 'advance' ? (parseInt(cmd.maxSteps || '15') * 1000 + 5000) : 10000;
setTimeout(() => {
  try {
    const r = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
    if (r.value !== undefined) {
      try {
        const parsed = JSON.parse(r.value);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            if (item.type === 'choice') console.log(`[step ${item.step}] CHOICE: ${item.choices.join(' | ')}`);
            else if (item.type === 'text') console.log(`[step ${item.step}] ${item.text}`);
            else if (item.msg) console.log(`[R${item.r}] ${item.msg}`);
            else console.log(`[step ${item.step}] ${JSON.stringify(item)}`);
          });
        } else {
          console.log(JSON.stringify(parsed, null, 2));
        }
      } catch(e2) { console.log(r.value); }
    } else {
      console.log(JSON.stringify(r, null, 2));
    }
  } catch(e) { console.log('No result: ' + e.message); }
}, waitMs);
