/**
 * mktest-save.js — 生成魔道争锋篇测试存档（直接跳到三组对位群架前）
 * 用法：node scripts/mktest-save.js
 * 输出：promo/test-save.json
 */
const fs = require('fs');
const path = require('path');

// 读取当前存档作为基础
const baseSave = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'promo', 'gamesave.json'), 'utf8'));

// 设置魔道争锋篇所需的状态
const s = baseSave;

// 境界：筑基初期（皇宫决战时韩立应为筑基）
s.realmIndex = 7;  // 筑基初期
s.realmCapIndex = 8;  // 封顶筑基中期
s.cultivation = 400;
s.spirit = 80;
s.hp = 200;
s.hpMax = 200;
s.mp = 120;
s.mpMax = 120;

// 年月
s.year = 18;
s.month = 3;

// 位置：京城
s.location = 'jingcheng';

// 设置魔道争锋篇所需 flags
s.flags = s.flags || {};
s.flags.arc1_complete = true;
s.flags.arc2_complete = true;
s.flags.arc3_complete = true;
s.flags.modao_act3_done = true;
s.flags.modao_e4_shenxun_done = true;
s.flags.jingcheng_intel = 2;
s.flags.liujing_survived = true;

// storyStage = 63 = modao_e4_santuan
s.storyStage = 63;
s.pendingEvent = null;  // 必须为 null，checkStory 才会触发

// 确保有基本装备
if (!s.items) s.items = {};
s.items.jinguang_zhuan_charge = 1;

// 保存
const outPath = path.join(__dirname, '..', 'promo', 'test-save.json');
fs.writeFileSync(outPath, JSON.stringify(s));
console.log('Test save written to', outPath);
console.log('stage:', s.storyStage, 'realm:', s.realmIndex, 'loc:', s.location);
