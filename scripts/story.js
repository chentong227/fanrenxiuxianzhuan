// story.js — 剧情推进+选择一体化脚本
// 用法：node scripts/story.js advance [maxSteps]  — 推进剧情到选项
//       node scripts/story.js choose [index]      — 选择选项
//       node scripts/story.js status              — 查看当前状态
//       node scripts/story.js text                — 读取画面文字
//       node scripts/story.js shot [name]         — 截图并保存到 raw/
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CMD_FILE = path.join(ROOT, 'promo', 'cmd.json');
const RESULT_FILE = path.join(ROOT, 'promo', 'result.json');

const cmd = process.argv[2] || 'status';
const arg1 = process.argv[3];
const arg2 = process.argv[4];

const STUBS = `window.Fx = { ensure(){}, warm(){}, at(){return {x:0,y:0}}, launch(){}, strike(){}, burst(){}, fadeOut(){}, shake(){}, haptic(){}, glow(){}, ring(){}, beam(){}, flash(){}, ripple(){}, particle(){}, sparks(){}, trail(){}, slash(){}, stab(){}, crush(){}, smash(){}, sweep(){}, ambient(){}, motes(){}, clear(){}, detach(){} }; window.Cutscene = { clear(){}, resetCam(){}, hasStaging(){return false;}, play(){}, stop(){} };`;

let evalCode = '';
let waitMs = 5000;

switch (cmd) {
  case 'status':
    evalCode = `JSON.stringify({stage:State.data.storyStage, pending:State.data.pendingEvent, loc:State.data.location, name:State.data.name, realm:State.realm().name, year:State.data.year, month:State.data.month, storyIdx:UI._story?UI._story.idx:null, beatsLen:UI._story?UI._story.beats.length:null, overlayHidden:UI.el('story-overlay').hidden})`;
    break;

  case 'text':
    evalCode = `[...document.querySelectorAll('.story-line,.narr,.choice,button,.scene-line,.story-speaker,.tc-title')].filter(e=>e.offsetParent!==null&&e.textContent.trim()).map(e=>(e.className||e.tagName)+': '+e.textContent.trim().substring(0,300)).join('\\n')`;
    break;

  case 'advance': {
    const maxSteps = parseInt(arg1 || '15', 10);
    waitMs = maxSteps * 1000 + 5000;
    evalCode = `(async function(){
      ${STUBS}
      var results = [];
      for (var i = 0; i < ${maxSteps}; i++) {
        try { State.save(); } catch(e) {}
        var choices = [...document.querySelectorAll('.choice')].filter(c => c.offsetParent !== null && c.textContent.trim());
        if (choices.length > 0) {
          results.push({ step: i, type: 'choice', choices: choices.map(c => c.textContent.trim().substring(0, 100)) });
          break;
        }
        try { UI.storyAdvance(); } catch(e) { results.push({ step: i, type: 'error', msg: e.message }); break; }
        await new Promise(r => setTimeout(r, 700));
        var line = document.querySelector('.story-line');
        var speaker = document.querySelector('.story-speaker');
        var text = (speaker ? speaker.textContent.trim() + ': ' : '') + (line ? line.textContent.trim() : '');
        results.push({ step: i, type: 'text', text: text.substring(0, 200) });
      }
      return JSON.stringify(results);
    })()`;
    break;
  }

  case 'choose': {
    const idx = parseInt(arg1 || '0', 10);
    evalCode = `(function(){
      ${STUBS}
      // 手动推进：清除当前剧情，增加 storyStage，触发下一段
      var stage = STORY[State.data.storyStage];
      if (!stage || !stage.choices || ${idx} >= stage.choices.length) return 'invalid choice';
      var choice = stage.choices[${idx}];
      // 执行 effect
      if (choice.effect) { try { var r = choice.effect(State.data) || {}; if (r.text) Engine.log(r.text, r.kind || 'event'); } catch(e) {} }
      // 推进
      State.data.pendingEvent = null;
      State.data.storyStage += 1;
      if (choice.next === 'end') { Engine.endArc(); return 'end arc'; }
      try { UI.clearStory(); } catch(e) {}
      State.save();
      try { UI.renderAll(); } catch(e) {}
      try { Engine.checkStory(); } catch(e) { return 'checkStory err: ' + e.message; }
      return 'ok: stage=' + State.data.storyStage + ' pending=' + State.data.pendingEvent;
    })()`;
    break;
  }

  case 'shot': {
    // Just take a screenshot
    fs.writeFileSync(CMD_FILE, JSON.stringify({ action: 'screenshot' }));
    setTimeout(() => {
      try {
        const r = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
        if (r.ok && arg1) {
          fs.copyFileSync(path.join(ROOT, 'promo', 'shot.png'), path.join(ROOT, 'promo', 'raw', arg1 + '.png'));
          console.log('Screenshot saved to promo/raw/' + arg1 + '.png');
        } else {
          console.log(JSON.stringify(r));
        }
      } catch(e) { console.log('Error: ' + e.message); }
    }, 3000);
    return;
  }

  default:
    console.log('Unknown command: ' + cmd);
    return;
}

fs.writeFileSync(CMD_FILE, JSON.stringify({ action: 'eval', code: evalCode, screenshot: cmd === 'text' || cmd === 'status' ? false : true }));

setTimeout(() => {
  try {
    const r = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
    if (r.value !== undefined) {
      if (cmd === 'advance') {
        try {
          const results = JSON.parse(r.value);
          results.forEach(step => {
            if (step.type === 'choice') {
              console.log(`[step ${step.step}] CHOICE: ${step.choices.join(' | ')}`);
            } else if (step.type === 'text') {
              console.log(`[step ${step.step}] ${step.text}`);
            } else {
              console.log(`[step ${step.step}] ${step.type}: ${step.msg}`);
            }
          });
        } catch(e) { console.log(r.value); }
      } else {
        console.log(r.value);
      }
    } else {
      console.log(JSON.stringify(r, null, 2));
    }
  } catch(e) { console.log('No result: ' + e.message); }
}, waitMs);
