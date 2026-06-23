// init-save.js — 使用游戏自身的 State.create() 创建正确存档
// 然后修改到我们需要的进度
const { chromium } = require("playwright");
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SAVE_FILE = path.join(ROOT, 'promo', 'gamesave.json');
const SERVER = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  await page.goto(SERVER, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // 创建游戏存档
  const save = await page.evaluate(() => {
    // 创建角色（四灵根）
    Main.testedRoot = { elem: '四灵根', qi: 4 };
    State.create('韩立', Main.testedRoot);
    
    // 推进到 stage=4 (friends 触发前)
    State.data.storyStage = 4;
    State.data.pendingEvent = null;
    State.data.location = 'yaolu';
    State.data.cultivation = 45;
    State.data.flags.at_village = true;
    State.data.flags.joined_sect = true;
    State.data.flags.met_modafu = true;
    State.save();
    
    return localStorage.getItem('frxxz_save_v1');
  });

  if (save) {
    fs.writeFileSync(SAVE_FILE, save);
    console.log('Save created: stage=4, cult=45, loc=yaolu');
    console.log('Save size: ' + save.length + ' bytes');
  } else {
    console.log('Failed to create save');
  }

  await browser.close();
})();
