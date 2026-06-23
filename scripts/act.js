// act.js — 游戏行动辅助脚本
// 用法：node scripts/act.js <command> [args]
//   node scripts/act.js clear       — 清除剧情 overlay
//   node scripts/act.js cultivate   — 修炼推进一个月
//   node scripts/act.js status      — 查看状态
//   node scripts/act.js objective   — 查看当前目标
//   node scripts/act.js tabs        — 列出可用行动按钮
//   node scripts/act.js click <text> — 点击包含文字的按钮
//   node scripts/act.js advance <months> — 连续修炼N个月
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CMD_FILE = path.join(ROOT, 'promo', 'cmd.json');
const RESULT_FILE = path.join(ROOT, 'promo', 'result.json');

const cmd = process.argv[2] || 'status';
const arg1 = process.argv[3];

const STUBS = "window.Fx={ensure(){},warm(){},at(){return{x:0,y:0}},launch(){},strike(){},burst(){},fadeOut(){},shake(){},haptic(){},glow(){},ring(){},beam(){},flash(){},ripple(){},particle(){},sparks(){},trail(){},slash(){},stab(){},crush(){},smash(){},sweep(){},ambient(){},motes(){},clear(){},detach(){}};window.Cutscene={clear(){},resetCam(){},hasStaging(){return false},play(){},stop(){}};";

let evalCode = '';
let waitMs = 5000;

switch (cmd) {
  case 'clear':
    evalCode = `(function(){${STUBS}if(UI._story){try{UI.clearStory();}catch(e){}}var ov=UI.el('story-overlay');if(ov)ov.hidden=true;document.body.classList.remove('story-on');UI._story=null;if(State.data&&State.data.pendingEvent){State.data.pendingEvent=null;}State.save();UI.renderAll();return 'cleared';})()`;
    break;

  case 'status':
    evalCode = `JSON.stringify({stage:State.data.storyStage,pending:State.data.pendingEvent,loc:State.data.location,name:State.data.name,realm:State.realm().name,year:State.data.year,month:State.data.month,cult:State.data.cultivation,hp:State.data.hp+'/'+State.data.hpMax})`;
    break;

  case 'objective':
    evalCode = `(function(){var o=Engine.currentObjective();return JSON.stringify(o);})()`;
    break;

  case 'tabs':
    evalCode = `[...document.querySelectorAll('.btn-action,button[data-action],.action-btn,.mtab')].filter(e=>e.offsetParent!==null&&e.textContent.trim()).map(e=>(e.className||e.tagName)+': '+e.textContent.trim().substring(0,100)).join('\\n')`;
    break;

  case 'click':
    evalCode = `(function(){${STUBS}var btn=[...document.querySelectorAll('button,.btn,.btn-action,.choice,.mtab')].find(e=>e.offsetParent!==null&&e.textContent.includes('${arg1}'));if(btn){btn.click();return 'clicked: '+btn.textContent.trim().substring(0,100);}return 'not found: ${arg1}';})()`;
    waitMs = 8000;
    break;

  case 'cultivate':
    evalCode = `(function(){${STUBS}try{Engine.doAction('cultivate');}catch(e){return 'err: '+e.message;}return 'ok: '+State.data.year+'.'+State.data.month+' stage='+State.data.storyStage+' pending='+State.data.pendingEvent;})()`;
    waitMs = 8000;
    break;

  case 'advance': {
    const months = parseInt(arg1 || '6', 10);
    waitMs = months * 3000 + 5000;
    evalCode = `(async function(){${STUBS}var log=[];for(var i=0;i<${months};i++){try{Engine.doAction('cultivate');}catch(e){log.push({i:i,err:e.message});break;}log.push({i:i,year:State.data.year,month:State.data.month,stage:State.data.storyStage,pending:State.data.pendingEvent,realm:State.realm().name,cult:State.data.cultivation});if(State.data.pendingEvent){log.push({i:i,msg:'event triggered'});break;}if(State.data.combat){log.push({i:i,msg:'combat triggered'});break;}}return JSON.stringify(log);})()`;
    break;
  }

  default:
    console.log('Unknown command: ' + cmd);
    return;
}

fs.writeFileSync(CMD_FILE, JSON.stringify({ action: 'eval', code: evalCode, screenshot: true }));

setTimeout(() => {
  try {
    const r = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
    if (r.value !== undefined) {
      if (cmd === 'advance') {
        try {
          const log = JSON.parse(r.value);
          log.forEach(e => {
            if (e.err) console.log(`[month ${e.i}] ERROR: ${e.err}`);
            else if (e.msg) console.log(`[month ${e.i}] ${e.msg}`);
            else console.log(`[month ${e.i}] ${e.year}.${e.month} | ${e.realm} | stage=${e.stage} | pending=${e.pending} | cult=${e.cult}`);
          });
        } catch(e2) { console.log(r.value); }
      } else {
        console.log(r.value);
      }
    } else {
      console.log(JSON.stringify(r, null, 2));
    }
  } catch(e) { console.log('No result: ' + e.message); }
}, waitMs);
