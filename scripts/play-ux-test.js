const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOT_DIR = path.join(__dirname, '..', 'promo', 'ux-test');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const shot = (page, name) => page.screenshot({ path: path.join(SHOT_DIR, name) });

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();

  const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

  // === 1. 打开游戏 ===
  log('打开游戏...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, '01_title.png');
  log('截图: 01_title.png');

  // === 2. 选灵根 + 开始 ===
  log('点击「测试灵根」...');
  await page.click('#btn-test-root');
  await page.waitForTimeout(500);
  await shot(page, '02_linggen.png');

  log('点击「踏入此界」...');
  await page.click('#btn-start');
  await page.waitForTimeout(1000);
  await shot(page, '03_enter.png');

  // === 3. 跳过开场剧情 ===
  log('跳过开场剧情...');
  for (let i = 0; i < 60; i++) {
    const storyVisible = await page.evaluate(() => {
      const el = document.getElementById('story-overlay');
      return el && !el.hidden;
    });
    if (!storyVisible) { log('剧情结束'); break; }

    // 先点 titlecard 消除
    const titlecard = await page.$('#story-titlecard.show');
    if (titlecard) {
      await titlecard.click().catch(() => {});
      await page.waitForTimeout(500);
      continue;
    }

    // 尝试点选择
    const choice = await page.$('.story-choices .choice');
    if (choice) {
      const isAttached = await choice.isVisible().catch(() => false);
      if (isAttached) { await choice.click(); await page.waitForTimeout(300); continue; }
    }

    // 尝试点跳过/继续
    const skip = await page.$('#story-skip');
    if (skip) {
      const isAttached = await skip.isVisible().catch(() => false);
      if (isAttached) { await skip.click(); await page.waitForTimeout(300); continue; }
    }

    // 用 eval 直接调 UI 跳过
    await page.evaluate(() => { if (typeof UI !== 'undefined' && UI.storySkip) UI.storySkip(); }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
  await shot(page, '04_after_story.png');
  log('截图: 04_after_story.png');

  // === 4. 检查场景热点 ===
  log('检查场景热点...');
  const hotspots = await page.$$('.scene-hotspot');
  log(`找到 ${hotspots.length} 个热点`);
  for (const h of hotspots) {
    const label = await h.getAttribute('title');
    log(`  热点: ${label}`);
  }
  await shot(page, '05_hotspots.png');
  log('截图: 05_hotspots.png');

  // === 5. 点击「闭关」热点 ===
  log('点击「闭关」热点...');
  await page.evaluate(() => {
    const hs = document.querySelectorAll('.scene-hotspot');
    const cult = [...hs].find(h => h.getAttribute('title') === '闭关');
    if (cult) cult.click();
  });
  await page.waitForTimeout(500);

  const sheetVisible = await page.evaluate(() => !document.getElementById('sheet-overlay').hidden);
  const modalVisible = await page.evaluate(() => !document.getElementById('modal-overlay').hidden);
  log(`Sheet 打开: ${sheetVisible}, Modal 打开: ${modalVisible}`);
  await shot(page, '06_seclusion_sheet.png');
  log('截图: 06_seclusion_sheet.png');

  // === 6. 点「闭关一月」 ===
  log('点击「闭关一月」...');
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(b => b.textContent.includes('闭关一月'));
    if (b) b.click();
  });
  await page.waitForTimeout(800);

  // 检查 float-gain-toast
  const toast = await page.$('.float-gain-toast');
  if (toast) {
    const text = await toast.textContent();
    log(`float-gain-toast: "${text}"`);
  } else {
    log('float-gain-toast: 未找到（可能已消失）');
  }
  await shot(page, '07_after_cultivate.png');
  log('截图: 07_after_cultivate.png');

  // === 7. 检查月历条 + 季节 ===
  log('检查月历条...');
  const monthBar = await page.$('.month-bar');
  log(`月历条存在: ${!!monthBar}`);
  const season = await page.evaluate(() => {
    const stage = document.getElementById('scene-stage');
    return stage ? stage.dataset.season : null;
  });
  log(`季节: ${season}`);
  await shot(page, '08_month_bar.png');

  // === 8. 测试 ripple — 用场景上的热点按钮 ===
  log('测试 ripple 光圈...');
  // 在场景 tab 下点一个热点按钮
  await page.evaluate(() => {
    const tab = document.querySelector('[data-mtab="hero"]');
    if (tab) tab.click();
  });
  await page.waitForTimeout(300);

  // 用 eval 直接点热点并检查 ripple
  const rippleResult = await page.evaluate(() => {
    const hs = document.querySelector('.scene-hotspot');
    if (!hs) return { found: false };
    hs.click();
    return { found: true, label: hs.getAttribute('title') };
  });
  log(`Ripple 测试点击: ${rippleResult.label || '未找到按钮'}`);
  await page.waitForTimeout(100);
  const ripple = await page.$('.ripple');
  log(`Ripple 生成: ${!!ripple}`);
  await shot(page, '10_ripple.png');
  await page.waitForTimeout(500);

  // 关闭可能打开的 sheet
  await page.evaluate(() => UI.closeSheet());
  await page.waitForTimeout(200);

  // === 9. 测试 NPC 对话 sheet ===
  log('切回场景 tab，检查 NPC...');
  await page.evaluate(() => {
    const tab = document.querySelector('[data-mtab="hero"]');
    if (tab) tab.click();
  });
  await page.waitForTimeout(300);

  // 检查在场人物
  const npcs = await page.$$('.local-npc');
  log(`在场 NPC: ${npcs.length}`);
  if (npcs.length > 0) {
    log('点击第一个 NPC...');
    await npcs[0].click();
    await page.waitForTimeout(500);
    await shot(page, '11_npc_wheel.png');

    // 检查是 sheet 还是 modal
    const npcSheet = await page.evaluate(() => !document.getElementById('sheet-overlay').hidden);
    const npcModal = await page.evaluate(() => !document.getElementById('modal-overlay').hidden);
    log(`NPC 轮盘: Sheet=${npcSheet}, Modal=${npcModal}`);

    // 关闭
    await page.evaluate(() => UI.closeSheet());
    await page.waitForTimeout(200);
  } else {
    log('当前地点无 NPC');
  }

  // === 10. 最终全景截图 ===
  log('最终截图...');
  await shot(page, '12_final.png');

  // === 汇总 ===
  log('\n========== 测试汇总 ==========');
  log(`热点数量: ${hotspots.length}`);
  log(`闭关 Sheet: ${sheetVisible ? '✓' : '✗'} (modal ${modalVisible ? '仍打开' : '未打开'})`);
  log(`float-gain: ${toast ? '✓' : '已消失（正常）'}`);
  log(`月历条: ${monthBar ? '✓' : '✗'}`);
  log(`季节: ${season || '未设置'}`);
  log(`Ripple: 已测试`);
  log(`NPC sheet: ${npcs.length > 0 ? '已测试' : '当前无 NPC'}`);
  log('==============================');

  log('\n浏览器保持打开 10 秒供观察...');
  await page.waitForTimeout(10000);
  await browser.close();
  log('完成');
})();
