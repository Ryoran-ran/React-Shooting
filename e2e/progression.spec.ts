import { expect, test } from '@playwright/test';

test('title and stage selection work with keyboard, pause returns to selection, attempts survive reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '冒険をはじめる →' })).toBeEnabled();
  await expect(page.locator('.info-panel')).toHaveCount(0);
  const combat = await page.getByRole('button', { name: '戦闘練習', exact: true }).boundingBox();
  const practice = await page.getByRole('button', { name: '操作練習', exact: true }).boundingBox();
  expect(practice!.y).toBeGreaterThan(combat!.y + combat!.height);
  expect(practice!.x).toBeCloseTo(combat!.x);
  await page.screenshot({ path: 'artifacts/blue-current-title.png' });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'ステージ選択' })).toBeVisible();
  await expect(page.locator('.info-panel')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/blue-current-selection.png' });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'ステージ選択' })).not.toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'ステージ進行率' })).toBeVisible();
  await expect(page.locator('.info-panel')).toHaveCount(2);
  await expect(page.locator('.boss-card')).toHaveCount(0);
  await expect(page.locator('.right-panel')).toHaveAttribute('data-state', 'normal');
  await expect(page.getByRole('switch', { name: '敵の攻撃', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'ポーズ中' })).toBeVisible();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'ステージ選択' })).toBeVisible();
  await expect(page.locator('.stage-choice').first()).toContainText('1 PLAY / 0 CLEAR');
  await expect(page.locator('.stage-choice').first()).toContainText('BEST —');
  await page.reload();
  await page.getByRole('button', { name: '冒険をはじめる →' }).click();
  await expect(page.locator('.stage-choice').first()).toContainText('1 PLAY / 0 CLEAR');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'タイトル', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('play a full stage through both boss phases and persist the clear result', async ({ page }) => {
  test.setTimeout(150000);
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    let started: number | null = null;
    let lastTime = 0;
    let simulatedX = 360;
    let simulatedY = 550;
    let lastDirection = { x: 0, y: 0 };
    let lastHudPosition = '';
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => {
      const playing = !document.querySelector('[aria-label="タイトル"], [aria-label="ステージ選択"]');
      if (playing && started === null) { started = performance.now(); lastTime = started; }
      const elapsed = started === null ? 0 : (performance.now() - started) / 1000;
      const active = playing && elapsed > 0.1;
      if (active) {
        const hudPosition = document.querySelector('.field-bottom > span')?.textContent ?? '';
        if (hudPosition !== lastHudPosition) {
          const match = hudPosition.match(/X\s*(\d+)\s*\/\s*Y\s*(\d+)/);
          if (match) { simulatedX = Number(match[1]); simulatedY = Number(match[2]); }
          lastHudPosition = hudPosition;
        }
        const dt = (performance.now() - lastTime) / 1000;
        simulatedX += lastDirection.x * 120 * dt;
        simulatedY += lastDirection.y * 120 * dt;
        const destination = 360 + Math.sin(elapsed * 0.65) * 140;
        const destinationY = 550 + Math.sin(elapsed * 0.65 * 0.7) * 50;
        const x = Math.max(-1, Math.min(1, (destination - simulatedX) / 8));
        const y = Math.max(-1, Math.min(1, (destinationY - simulatedY) / 8));
        const length = Math.max(1, Math.hypot(x, y));
        lastDirection = { x: x / length, y: y / length };
      }
      lastTime = performance.now();
      const length = Math.hypot(lastDirection.x, lastDirection.y);
      const axisScale = active && length ? (0.18 + length * 0.82) / length : 0;
      return [{ connected: true, id: 'Stage playback pad', index: 0, mapping: 'standard', axes: [lastDirection.x * axisScale, lastDirection.y * axisScale, 0, 0],
        buttons: Array.from({ length: 17 }, (_, index) => ({ pressed: active && (index === 0 || index === 1), value: Number(active && (index === 0 || index === 1)) })) }];
    } });
  });
  await page.clock.install(); await page.goto('/');
  await page.getByRole('button', { name: '冒険をはじめる →' }).click();
  await page.locator('.stage-choice').first().click();
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 100);
  // Virtual hardware supplies normal analog controls; game state is never edited.
  let sawBoss = false; let sawSecondPhase = false; let sawArrival = false; let sawCollection = false; let sawLaser = false; let sawDefeat = false; let sawClear = false;
  for (let i = 0; i < 360; i++) {
    await page.clock.runFor(500);
    if (await page.getByRole('dialog', { name: 'リザルト' }).isVisible()) break;
    const arrival = page.getByRole('status', { name: 'ボス登場演出' });
    if (!sawArrival && await arrival.isVisible() && await arrival.evaluate((el) => Number(getComputedStyle(el).opacity) > 0.5)) {
      sawArrival = true;
      await expect(page.locator('.right-panel')).toHaveAttribute('data-state', 'arrival');
      await expect(page.locator('.boss-card')).toHaveCount(1);
      await page.screenshot({ path: 'artifacts/blue-current-boss-arrival.png' });
    }
    const collection = page.getByRole('status', { name: 'フェーズ切替' });
    if (!sawCollection && await collection.isVisible()) {
      sawCollection = true; await page.screenshot({ path: 'artifacts/blue-current-phase-collection.png' });
    }
    const bossText = await page.locator('.boss-card').count() ? await page.locator('.boss-card').innerText() : '';
    if (!sawBoss && bossText.includes('PHASE 1/2')) { sawBoss = true; await page.screenshot({ path: 'artifacts/blue-current-boss.png' }); }
    if (!sawSecondPhase && bossText.includes('PHASE 2/2')) { sawSecondPhase = true; await page.screenshot({ path: 'artifacts/blue-current-boss-phase2.png' }); }
    if (!sawLaser && bossText.includes('レーザー')) { sawLaser = true; await page.screenshot({ path: 'artifacts/blue-current-boss-laser.png' }); }
    const clear = page.getByRole('status', { name: 'ステージクリア演出' });
    if (!sawDefeat && (await page.locator('.status-box').innerText()).includes('CLEAR') && !await clear.isVisible()) {
      sawDefeat = true;
      await page.screenshot({ path: 'artifacts/blue-current-boss-defeat.png' });
    }
    if (!sawClear && await clear.isVisible()) {
      sawClear = true;
      await expect(page.locator('.right-panel')).toHaveAttribute('data-state', 'clear');
      await expect(page.getByRole('dialog', { name: 'リザルト' })).not.toBeVisible();
      await page.clock.runFor(850);
      expect(await clear.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
      await page.screenshot({ path: 'artifacts/blue-current-stage-clear.png' });
    }
    await expect(page.getByRole('dialog', { name: 'ゲームオーバー' })).not.toBeVisible();
  }
  expect(sawBoss).toBe(true); expect(sawSecondPhase).toBe(true);
  expect(sawArrival).toBe(true); expect(sawCollection).toBe(true); expect(sawLaser).toBe(true); expect(sawDefeat).toBe(true); expect(sawClear).toBe(true);
  await expect(page.getByRole('dialog', { name: 'リザルト' })).toBeVisible();
  await expect(page.locator('.info-panel')).toHaveCount(0);
  await expect(page.locator('.record-note')).toContainText('記録しました');
  await page.screenshot({ path: 'artifacts/blue-current-result.png' });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('blue-current.records')!));
  expect(saved.stages['stage-01'].cleared).toBe(true); expect(saved.stages['stage-01'].clears).toBe(1);
  expect(saved.stages['stage-01'].bestScore).toBeGreaterThan(8000);
  await page.clock.runFor(3000);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('blue-current.records')!).stages['stage-01'].clears)).toBe(1);
  await page.getByRole('button', { name: 'ステージ選択へ →' }).click();
  await expect(page.locator('.stage-choice').first()).toContainText('1 PLAY / 1 CLEAR');
  await page.reload(); await page.getByRole('button', { name: '冒険をはじめる →' }).click();
  await expect(page.locator('.stage-choice').first()).toContainText('1 PLAY / 1 CLEAR');
  await expect(page.locator('.stage-choice').first()).toContainText(`${saved.stages['stage-01'].bestRank} · CLEAR`);
  await page.locator('.stage-choice').first().click();
  await expect(page.locator('.hp-segments')).toHaveAttribute('aria-label', 'HP 10 / 10');
  await expect(page.locator('.score-number')).toHaveText('000000');
  expect(errors).toEqual([]);
});

test('stage two moves from shallows to a sandy beach boss and saves its own result', async ({ page }) => {
  test.setTimeout(160000);
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    let started: number | null = null, lastTime = 0, simulatedX = 360, simulatedY = 550;
    let lastDirection = { x: 0, y: 0 }, lastHudPosition = '';
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => {
      const playing = !document.querySelector('[aria-label="タイトル"], [aria-label="ステージ選択"]');
      if (playing && started === null) { started = performance.now(); lastTime = started; }
      const elapsed = started === null ? 0 : (performance.now() - started) / 1000;
      const active = playing && elapsed > 0.1;
      if (active) {
        const hudPosition = document.querySelector('.field-bottom > span')?.textContent ?? '';
        if (hudPosition !== lastHudPosition) {
          const match = hudPosition.match(/X\s*(\d+)\s*\/\s*Y\s*(\d+)/);
          if (match) { simulatedX = Number(match[1]); simulatedY = Number(match[2]); }
          lastHudPosition = hudPosition;
        }
        const dt = (performance.now() - lastTime) / 1000;
        simulatedX += lastDirection.x * 120 * dt;
        simulatedY += lastDirection.y * 120 * dt;
        const destination = 360 + Math.sin(elapsed) * 100;
        const x = Math.max(-1, Math.min(1, (destination - simulatedX) / 8));
        const y = Math.max(-1, Math.min(1, (630 - simulatedY) / 8));
        const length = Math.max(1, Math.hypot(x, y));
        lastDirection = { x: x / length, y: y / length };
      }
      lastTime = performance.now();
      const length = Math.hypot(lastDirection.x, lastDirection.y);
      const axisScale = active && length ? (0.18 + length * 0.82) / length : 0;
      return [{ connected: true, id: 'Shallows playback pad', index: 0, mapping: 'standard',
        axes: [lastDirection.x * axisScale, lastDirection.y * axisScale, 0, 0],
        buttons: Array.from({ length: 17 }, (_, index) => ({ pressed: active && (index === 0 || index === 1),
          value: Number(active && (index === 0 || index === 1)) })) }];
    } });
  });
  await page.clock.install(); await page.goto('/');
  await page.getByRole('button', { name: '冒険をはじめる →' }).click();
  await expect(page.locator('.stage-choice')).toHaveCount(2);
  await page.locator('.stage-choice').nth(1).click();
  await expect(page.locator('.field-top')).toContainText('SHIMMERING SHALLOWS');
  await expect(page.locator('.right-panel')).toContainText('ひかりの浅瀬');
  await page.screenshot({ path: 'artifacts/blue-current-stage2-shallows.png' });
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 100);
  let sawWarning = false, sawShrink = false, sawRecovery = false, sawBeach = false, sawPhaseTwo = false;
  for (let i = 0; i < 300; i++) {
    await page.clock.runFor(500);
    if (await page.getByRole('dialog', { name: 'リザルト' }).isVisible()) break;
    const gimmick = await page.locator('.gimmick-row').innerText();
    if (!sawWarning && gimmick.includes('縮小予兆')) {
      sawWarning = true; await page.screenshot({ path: 'artifacts/blue-current-stage2-shrink-warning.png' });
    }
    if (!sawShrink && gimmick.includes('縮小中') && !gimmick.includes('画面縮小中')) {
      sawShrink = true; await page.screenshot({ path: 'artifacts/blue-current-stage2-shrunk.png' });
    }
    if (sawShrink && gimmick.includes('復帰中')) sawRecovery = true;
    if (!sawBeach && await page.locator('.field-top').innerText().then((text) => text.includes('SANDY SHORE'))) {
      sawBeach = true;
      await expect(page.getByRole('status', { name: 'ボス登場演出' })).toContainText('砂浜の番人');
      await page.clock.runFor(1800);
      await page.screenshot({ path: 'artifacts/blue-current-stage2-beach.png' });
    }
    if (!sawPhaseTwo && await page.locator('.boss-card').count()
      && (await page.locator('.boss-card').innerText()).includes('PHASE 2/2')) sawPhaseTwo = true;
    await expect(page.getByRole('dialog', { name: 'ゲームオーバー' })).not.toBeVisible();
  }
  expect(sawWarning).toBe(true); expect(sawShrink).toBe(true); expect(sawRecovery).toBe(true);
  expect(sawBeach).toBe(true); expect(sawPhaseTwo).toBe(true);
  await expect(page.getByRole('dialog', { name: 'リザルト' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'リザルト' })).toContainText('STAGE 02 · SHIMMERING SHALLOWS');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('blue-current.records')!));
  expect(saved.stages['stage-02'].cleared).toBe(true);
  expect(saved.stages['stage-01']).toBeUndefined();
  await page.screenshot({ path: 'artifacts/blue-current-stage2-result.png' });
  expect(errors).toEqual([]);
});

test('storage failure does not prevent starting or retrying a stage', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
  });
  await page.goto('/');
  await page.getByRole('button', { name: '冒険をはじめる →' }).click();
  await page.locator('.stage-choice').first().click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'ステージ選択へ戻る' }).click();
  await expect(page.locator('.record-note')).toContainText('保存できません');
  await expect(page.locator('.stage-choice').first()).toContainText('1 PLAY / 0 CLEAR');
  await page.locator('.stage-choice').first().click();
  await expect(page.locator('.hp-segments')).toHaveAttribute('aria-label', 'HP 10 / 10');
});
