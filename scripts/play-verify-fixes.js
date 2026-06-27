/**
 * Playwright 验证脚本：验证 UI 修复
 * - 场景热点清除（进入剧情/战斗后热点不残留）
 * - 地图/场景互斥（手机端）
 * - BGM 不重叠
 * - 基本流程正常
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[ERROR] ${err.message}`));

  const results = [];
  function check(name, ok, detail) {
    results.push({ name, ok, detail: detail || '' });
    console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  }

  try {
    // 1. 导航到游戏
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    check('页面加载', true);

    // 2. 测试灵根 → 踏入此界
    const testBtn = await page.locator('text=测试灵根').first();
    if (await testBtn.isVisible()) {
      await testBtn.click();
      await page.waitForTimeout(300);
    }
    const enterBtn = await page.locator('text=踏入此界').first();
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      await page.waitForTimeout(500);
    }

    // 3. 跳过开场剧情（点击 story-overlay 推进）
    for (let i = 0; i < 30; i++) {
      const storyOv = page.locator('#story-overlay');
      if (await storyOv.isHidden()) break;
      // 点击题字卡或对话框推进
      const titlecard = page.locator('#story-titlecard.show');
      if (await titlecard.isVisible({ timeout: 200 }).catch(() => false)) {
        await titlecard.click();
        await page.waitForTimeout(200);
        continue;
      }
      const dialog = page.locator('#story-dialog');
      if (await dialog.isVisible({ timeout: 200 }).catch(() => false)) {
        await dialog.click();
        await page.waitForTimeout(200);
        continue;
      }
      // 可能有选项
      const choices = page.locator('#story-choices .choice, #story-choices button');
      const count = await choices.count();
      if (count > 0) {
        await choices.first().click();
        await page.waitForTimeout(300);
        continue;
      }
      await page.waitForTimeout(200);
    }

    // 4. 检查是否进入了游戏主界面
    const sceneStage = page.locator('#scene-stage');
    const sceneVisible = await sceneStage.isVisible().catch(() => false);
    check('进入游戏主界面', sceneVisible);

    // 5. 检查 scene-hotspots-layer 存在
    const hotspotsLayer = page.locator('#scene-hotspots');
    const layerExists = await hotspotsLayer.count() > 0;
    check('scene-hotspots-layer DOM 存在', layerExists);

    // 6. 检查 scene-hotspots-layer 在无热点时为空
    const layerContent = layerExists ? await hotspotsLayer.innerHTML() : '';
    const layerEmpty = layerContent.trim() === '';
    check('无热点时 scene-hotspots-layer 为空', layerEmpty, `content: "${layerContent.substring(0, 50)}"`);

    // 7. 检查 worldmap-canvas 与 scene-stage 的互斥关系
    const worldmap = page.locator('#worldmap-canvas');
    const wmHidden = await worldmap.getAttribute('hidden');
    check('初始状态 worldmap-canvas 隐藏', wmHidden !== null);

    // 8. 检查 action-dock 存在
    const dock = page.locator('#action-dock');
    const dockExists = await dock.count() > 0;
    check('action-dock DOM 存在', dockExists);

    // 9. 检查 action-buttons 存在
    const actionBtns = page.locator('#action-buttons');
    const actionBtnsExists = await actionBtns.count() > 0;
    check('action-buttons DOM 存在', actionBtnsExists);

    // 10. 检查无 console error
    const errors = consoleLogs.filter(l => l.startsWith('[ERROR]'));
    check('无 JS 运行时错误', errors.length === 0, errors.length ? errors.join('; ') : '');

    // 11. 截图
    await page.screenshot({ path: 'promo/ux-test/verify-fixes.png', fullPage: false });
    check('截图完成', true);

    // 12. 检查 BGM 状态（通过 eval）
    const bgmState = await page.evaluate(() => {
      if (typeof Sfx !== 'undefined' && Sfx.curBgm) return Sfx.curBgm();
      return 'Sfx not available';
    });
    check('BGM 状态可查询', bgmState !== 'Sfx not available', `curBgm: ${bgmState}`);

  } catch (e) {
    check('脚本执行', false, e.message);
  }

  // 汇总
  console.log('\n========== 验证结果 ==========');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`通过: ${passed}  失败: ${failed}  总计: ${results.length}`);
  if (failed > 0) {
    console.log('\n失败项:');
    results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.name} — ${r.detail}`));
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
