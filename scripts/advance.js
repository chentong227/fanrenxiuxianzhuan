// advance.js — 剧情推进辅助脚本（带崩溃恢复）
// 用法：node scripts/advance.js [maxSteps] [dir]
// 会自动推进剧情直到出现选项，或达到 maxSteps
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CMD_FILE = path.join(ROOT, 'promo', 'cmd.json');
const RESULT_FILE = path.join(ROOT, 'promo', 'result.json');

const maxSteps = parseInt(process.argv[2] || '15', 10);
const dir = process.argv[3] || 'raw';
const shotDir = path.join(ROOT, 'promo', dir);
fs.mkdirSync(shotDir, { recursive: true });

// 推进代码：每次 storyAdvance 前先 State.save()，崩溃后可恢复
const advanceCode = `
(async function() {
  var results = [];
  for (var i = 0; i < ${maxSteps}; i++) {
    // 先保存
    try { State.save(); } catch(e) {}
    
    // 检查是否已有选项
    var choices = document.querySelectorAll('.choice');
    var visible = [...choices].filter(c => c.offsetParent !== null && c.textContent.trim());
    if (visible.length > 0) {
      results.push({ step: i, type: 'choice', choices: visible.map(c => c.textContent.trim()) });
      break;
    }
    
    // 推进
    try {
      UI.storyAdvance();
    } catch(e) {
      results.push({ step: i, type: 'error', msg: e.message });
      break;
    }
    
    await new Promise(r => setTimeout(r, 800));
    
    // 读取当前文字
    var line = document.querySelector('.story-line');
    var text = line ? line.textContent.trim() : '';
    results.push({ step: i, type: 'text', text: text.substring(0, 200) });
  }
  return JSON.stringify(results);
})()
`;

fs.writeFileSync(CMD_FILE, JSON.stringify({ action: 'eval', code: advanceCode, screenshot: false }));

setTimeout(() => {
  try {
    const r = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
    if (r.value) {
      const results = JSON.parse(r.value);
      results.forEach(step => {
        if (step.type === 'choice') {
          console.log(`[step ${step.step}] CHOICE: ${step.choices.join(' | ')}`);
        } else if (step.type === 'text') {
          console.log(`[step ${step.step}] TEXT: ${step.text}`);
        } else {
          console.log(`[step ${step.step}] ${step.type}: ${step.msg}`);
        }
      });
    } else {
      console.log(JSON.stringify(r, null, 2));
    }
  } catch(e) {
    console.log('No result: ' + e.message);
  }
}, maxSteps * 1000 + 5000);
