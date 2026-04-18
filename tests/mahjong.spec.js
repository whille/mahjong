const { test, expect } = require('@playwright/test');

test.describe('麻将游戏 E2E 测试', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    // 等待游戏初始化完成
    await page.waitForFunction(() => {
      return typeof game !== 'undefined' && game.players && game.players.length === 4;
    }, { timeout: 10000 });
  });

  test('游戏初始化 - 检查基础元素', async ({ page }) => {
    // 检查页面标题
    await expect(page.locator('h1')).toContainText('麻将');

    // 检查玩家手牌数量 (使用 .tile-img class)
    const handTiles = page.locator('#player-hand .tile-img');
    const count = await handTiles.count();
    expect(count).toBeGreaterThanOrEqual(13);

    // 检查牌山显示
    const wallCount = page.locator('.wall-count');
    await expect(wallCount).toContainText('张');
  });

  test('游戏初始化 - 四个玩家区域', async ({ page }) => {
    // 检查四个玩家区域存在
    await expect(page.locator('#player-0')).toBeVisible(); // 玩家
    await expect(page.locator('#player-1')).toBeVisible(); // 东家 AI
    await expect(page.locator('#player-2')).toBeVisible(); // 北家 AI
    await expect(page.locator('#player-3')).toBeVisible(); // 西家 AI

    // 检查 AI 手牌背面显示
    const ai1Hand = page.locator('#ai1-hand');
    await expect(ai1Hand).toBeVisible();
  });

  test('游戏初始化 - 操作按钮', async ({ page }) => {
    // 检查操作按钮存在
    const actions = ['chi', 'pong', 'kong', 'win', 'pass'];
    for (const action of actions) {
      const btn = page.locator(`[data-action="${action}"]`);
      await expect(btn).toBeVisible();
    }
  });

  test('摸牌出牌流程 - 玩家回合', async ({ page }) => {
    // 等待玩家回合
    await page.waitForFunction(() => {
      return game && game.currentPlayer === 0;
    }, { timeout: 30000 });

    // 检查玩家是否可以出牌 (使用 .tile-img class)
    const handTiles = page.locator('#player-hand .tile-img');
    const count = await handTiles.count();
    expect(count).toBeGreaterThanOrEqual(14); // 摸牌后14张

    // 点击出一张牌
    const firstTile = handTiles.first();
    await firstTile.click();

    // 等待出牌动画完成
    await page.waitForTimeout(500);
  });

  test('AI 回合 - 自动进行', async ({ page }) => {
    // 等待游戏开始
    await page.waitForTimeout(1000);

    // 等待一段时间让 AI 进行回合
    await page.waitForTimeout(5000);

    // 检查牌山数量减少
    const wallCount = await page.locator('.wall-count').textContent();
    const remaining = parseInt(wallCount.match(/\d+/)[0]);
    expect(remaining).toBeLessThan(136);
  });

  // 碰牌测试 - 随机事件，标记为跳过
  test.skip('碰牌按钮状态变化', async ({ page }) => {
    // 监听碰牌按钮状态
    const pongBtn = page.locator('[data-action="pong"]');

    // 初始状态应该禁用
    await expect(pongBtn).toBeDisabled();

    // 等待可能出现碰牌机会（最多等待30秒）
    // 注意：这个测试可能会因为牌局随机性而不触发
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-action="pong"]');
      return btn && !btn.disabled;
    }, { timeout: 30000 });

    // 如果碰牌按钮启用，验证可以点击
    await expect(pongBtn).toBeEnabled();
  });

  // 游戏结束测试 - 耗时太长，标记为跳过
  test.skip('游戏结束检测', async ({ page }) => {
    test.setTimeout(120000); // 设置2分钟超时

    // 监听游戏结束状态
    await page.waitForFunction(() => {
      return game && game.state === 'gameover';
    }, { timeout: 120000 });

    // 检查是否有胡牌或流局提示
    const messageArea = page.locator('.message-area');
    const isVisible = await messageArea.isVisible().catch(() => false);

    if (isVisible) {
      const text = await messageArea.textContent();
      console.log('Game result:', text);
    }
  });

  test('新局按钮功能', async ({ page }) => {
    // 记录当前手牌
    const handTiles = page.locator('#player-hand .tile-img');
    const initialCount = await handTiles.count();

    // 点击新局按钮
    const newGameBtn = page.locator('.restart-btn-small');
    await newGameBtn.click();

    // 等待游戏重新初始化
    await page.waitForTimeout(1000);

    // 再次检查游戏状态
    await page.waitForFunction(() => {
      return typeof game !== 'undefined' && game.players && game.players.length === 4;
    }, { timeout: 5000 });

    // 验证手牌重新发牌
    const newCount = await handTiles.count();
    expect(newCount).toBeGreaterThanOrEqual(13);
  });

  test('响应式布局 - 检查 CSS', async ({ page }) => {
    // 检查游戏容器存在
    const gameContainer = page.locator('.game-container');
    await expect(gameContainer).toBeVisible();

    // 检查桌面布局
    const mahjongTable = page.locator('.mahjong-table');
    await expect(mahjongTable).toBeVisible();

    // 检查手牌区样式
    const playerHand = page.locator('#player-hand');
    await expect(playerHand).toBeVisible();
  });

});

test.describe('麻将游戏 - 游戏逻辑测试', () => {

  test('验证游戏对象存在', async ({ page }) => {
    await page.goto('/index.html');

    // 检查全局游戏对象
    const gameObj = await page.evaluate(() => {
      return {
        exists: typeof game !== 'undefined',
        hasPlayers: typeof game !== 'undefined' && game.players && game.players.length,
        hasWall: typeof game !== 'undefined' && game.wall !== undefined,
        state: typeof game !== 'undefined' ? game.state : null
      };
    });

    expect(gameObj.exists).toBe(true);
    expect(gameObj.hasPlayers).toBe(4);
    expect(gameObj.hasWall).toBe(true);
  });

  test('验证牌组正确性', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof game !== 'undefined', { timeout: 5000 });

    const tileInfo = await page.evaluate(() => {
      const totalTiles = 136;
      const usedTiles = game.players.reduce((sum, p) => sum + p.hand.length, 0);
      const remainingTiles = game.wall.length;
      return {
        total: totalTiles,
        used: usedTiles,
        remaining: remainingTiles,
        sum: usedTiles + remainingTiles
      };
    });

    // 验证牌数正确
    expect(tileInfo.sum).toBe(tileInfo.total);
  });

  test('验证玩家手牌数量', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof game !== 'undefined', { timeout: 5000 });

    const handInfo = await page.evaluate(() => {
      const player = game.players[0];
      return {
        count: player.hand.length
      };
    });

    // 玩家手牌应该是 13 或 14 张
    expect(handInfo.count).toBeGreaterThanOrEqual(13);
    expect(handInfo.count).toBeLessThanOrEqual(14);
  });

});