/**
 * combat-loop.js — 自动战斗循环（通过 play6 控制器）
 * 用法：node scripts/combat-loop.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CMD_FILE = path.join(ROOT, 'promo', 'pcmd.json');
const RESULT_FILE = path.join(ROOT, 'promo', 'presult.json');

function sendCmd(cmd) {
  fs.writeFileSync(CMD_FILE, JSON.stringify(cmd));
  // Wait for result
  var startTime = Date.now();
  while (Date.now() - startTime < 15000) {
    try {
      const r = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
      if (r.cmdId && r.time && Date.now() - new Date(r.time).getTime() < 5000) {
        return r;
      }
    } catch(e) {}
    require('child_process').execSync('timeout /t 1 /nobreak >nul 2>&1');
  }
  return null;
}

function combatTurn() {
  // Click available spells in priority order, then end round
  const code = `(function() {
    var c = Engine._combat;
    if (!c) return JSON.stringify({done: true, msg: 'no combat'});
    var log = [];
    var priority = ['金', '针', '剑', '毒'];
    for (var p of priority) {
      var btns = [...document.querySelectorAll('#combat-overlay .spell-btn')].filter(function(e) {
        return e.offsetParent !== null && !e.classList.contains('off');
      });
      var btn = btns.find(function(e) { return e.textContent.trim().startsWith(p); });
      if (btn) {
        btn.click();
        log.push(p + '->enemy=' + c.enemies[0].hp);
      }
    }
    // End round
    var er = document.getElementById('combat-endround');
    if (er && er.offsetParent !== null) {
      er.click();
      log.push('endRound');
    }
    return JSON.stringify({done: false, log: log, round: c.round, enemyHp: c.enemies[0].hp, playerHp: c.player.hp});
  })()`;
  
  var result = sendCmd({action: 'eval', code: code, screenshot: false});
  return result;
}

async function main() {
  console.log('Starting combat loop...');
  for (var i = 0; i < 50; i++) {
    var r = combatTurn();
    if (!r) { console.log('No result at step ' + i); break; }
    
    var val = r.value;
    try {
      var parsed = JSON.parse(val);
      if (parsed.done) {
        console.log('Combat ended at step ' + i + ': ' + parsed.msg);
        break;
      }
      console.log('Step ' + i + ': R' + parsed.round + ' enemy=' + parsed.enemyHp + ' player=' + parsed.playerHp + ' actions=' + (parsed.log || []).join(','));
      if (parsed.playerHp <= 0) {
        console.log('PLAYER DEAD at step ' + i);
        break;
      }
    } catch(e) {
      console.log('Step ' + i + ': ' + val);
    }
    
    // Wait between turns
    require('child_process').execSync('timeout /t 3 /nobreak >nul 2>&1');
  }
  console.log('Combat loop done.');
}

main();
