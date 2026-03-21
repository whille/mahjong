// 麻将AI决策模块

// AI难度配置
const AI_DIFFICULTY = {
  SIMPLE: 'simple',    // 随机出牌，不吃碰杠
  MEDIUM: 'medium',    // 基础策略
  HARD: 'hard'         // 筋牌防御 + 高级策略
};

/**
 * AI玩家决策类
 * 根据难度级别做出不同的游戏决策
 */
class AIPlayer {
  /**
   * @param {Object} player - 玩家数据对象
   * @param {string} difficulty - AI难度 (simple/medium/hard)
   * @param {Object} gameContext - 游戏上下文 (包含 players, wall 等)
   */
  constructor(player, difficulty = AI_DIFFICULTY.MEDIUM, gameContext = null) {
    this.player = player;
    this.difficulty = difficulty;
    this.gameContext = gameContext;
  }

  /**
   * 设置游戏上下文
   * @param {Object} context - 游戏上下文
   */
  setGameContext(context) {
    this.gameContext = context;
  }

  // 回合开始决策 (摸牌后)
  decide(drawnTile) {
    // 简单AI：随机出牌，不吃碰杠
    if (this.difficulty === AI_DIFFICULTY.SIMPLE) {
      return this.simpleDecide(drawnTile);
    }

    // 中等/困难AI
    return this.advancedDecide(drawnTile);
  }

  // 简单AI决策
  simpleDecide(drawnTile) {
    // 检查自摸
    const testHand = [...this.player.hand];
    if (canWin(testHand, this.player.melds)) {
      return { type: 'win', tile: drawnTile };
    }

    // 随机出牌
    const randomIndex = Math.floor(Math.random() * this.player.hand.length);
    return { type: 'discard', tileId: this.player.hand[randomIndex].id };
  }

  // 高级AI决策
  advancedDecide(drawnTile) {
    // 检查胡 (自摸)
    const testHand = [...this.player.hand];
    if (canWin(testHand, this.player.melds)) {
      return { type: 'win', tile: drawnTile };
    }

    // 检查杠
    if (canKong(this.player.hand, drawnTile, true)) {
      if (this.shouldKong(drawnTile)) {
        return { type: 'kong', tileId: drawnTile.id };
      }
    }

    // 打牌策略
    const toDiscard = this.chooseDiscard();
    if (toDiscard) {
      return { type: 'discard', tileId: toDiscard.id };
    }

    // 防御性代码：无法选择打出的牌
    console.error('[advancedDecide] 无法选择打出的牌');
    const randomIndex = Math.floor(Math.random() * this.player.hand.length);
    if (this.player.hand[randomIndex]) {
      return { type: 'discard', tileId: this.player.hand[randomIndex].id };
    }
    return { type: 'pass' };
  }

  // 碰/吃后直接打牌（不摸牌）
  decideDiscardAfterAction() {
    // 检查胡
    if (canWin(this.player.hand, this.player.melds)) {
      return { type: 'win' };
    }

    // 打牌策略
    const toDiscard = this.chooseDiscard();
    if (toDiscard) {
      return { type: 'discard', tileId: toDiscard.id };
    }

    // 防御性代码：无法选择打出的牌，返回 pass
    console.error('[decideDiscardAfterAction] 无法选择打出的牌');
    return { type: 'pass' };
  }

  // 响应其他玩家打出的牌
  respond(discardedTile) {
    const hand = this.player.hand;

    // 简单AI不响应
    if (this.difficulty === AI_DIFFICULTY.SIMPLE) {
      return { type: 'pass' };
    }

    // 检查胡 (抢杠/点炮)
    const testHand = [...hand, discardedTile];
    if (canWin(testHand, this.player.melds)) {
      return { type: 'win' };
    }

    // 检查碰
    if (canPong(hand, discardedTile)) {
      if (this.shouldPong(discardedTile)) {
        return { type: 'pong', tile: discardedTile };
      }
    }

    // 检查杠 (明杠)
    if (canKong(hand, discardedTile, false)) {
      if (this.shouldKong(discardedTile)) {
        return { type: 'kong', tile: discardedTile };
      }
    }

    return { type: 'pass' };
  }

  // 响应其他玩家打出的牌 (独立方法)
  decideResponse(discardedTile) {
    const hand = this.player.hand;

    // 简单AI不响应
    if (this.difficulty === AI_DIFFICULTY.SIMPLE) {
      return null;
    }

    // 检查胡 (抢杠/点炮)
    const testHand = [...hand, discardedTile];
    if (canWin(testHand, this.player.melds)) {
      return { type: 'win' };
    }

    // 检查碰 (高优先级)
    if (canPong(hand, discardedTile)) {
      if (this.shouldPong(discardedTile)) {
        return { type: 'pong' };
      }
    }

    // 检查杠 (明杠)
    if (canKong(hand, discardedTile, false)) {
      if (this.shouldKong(discardedTile)) {
        return { type: 'kong' };
      }
    }

    return null;
  }

  // 评估是否碰
  shouldPong(tile) {
    const hand = this.player.hand;
    const counts = {};
    hand.forEach(t => counts[t.type] = (counts[t.type] || 0) + 1);

    // 有4张相同牌，碰
    if (counts[tile.type] >= 3) return true;

    // 碰了能听牌，碰
    const testHand = hand.filter(t => t.type !== tile.type);
    testHand.push({ type: tile.type }, { type: tile.type });
    if (checkTenpai(testHand).length > 0) return true;

    // 字牌容易碰
    if (['east','south','west','north','zhong','fa','bai'].includes(tile.type)) {
      return Math.random() > 0.3;
    }

    return Math.random() > 0.5;
  }

  // 评估是否杠
  shouldKong(tile) {
    const hand = this.player.hand;
    const counts = {};
    hand.forEach(t => counts[t.type] = (counts[t.type] || 0) + 1);

    // 暗杠 (4张)
    if (counts[tile.type] === 4) return true;

    // 明杠 (3张 + 打出的)
    // 简化: 50%概率杠
    return Math.random() > 0.5;
  }

  // 选择打哪张牌
  chooseDiscard(dangerousTiles = []) {
    const hand = this.player.hand;

    // 困难难度使用筋牌防御
    if (this.difficulty === AI_DIFFICULTY.HARD) {
      return this.hardChooseDiscard();
    }

    // 中等难度
    // 统计各牌数量
    const counts = {};
    hand.forEach(t => counts[t.type] = (counts[t.type] || 0) + 1);

    // 1. 避开危险牌 (后期防御)
    const safeTiles = hand.filter(t => !dangerousTiles.includes(t.type));
    if (safeTiles.length > 0 && dangerousTiles.length > 0) {
      // 优先打安全牌
      const counts2 = {};
      safeTiles.forEach(t => counts2[t.type] = (counts2[t.type] || 0) + 1);

      // 打孤张
      const singles = safeTiles.filter(t => counts2[t.type] === 1);
      if (singles.length > 0) return singles[0];

      // 打多余
      const extras = safeTiles.filter(t => counts2[t.type] > 2);
      if (extras.length > 0) return extras[0];

      return safeTiles[Math.floor(Math.random() * safeTiles.length)];
    }

    // 2. 打孤张 (只有1张)
    const singles = hand.filter(t => counts[t.type] === 1);
    if (singles.length > 0) {
      // 优先打字牌
      const ziTiles = singles.filter(t =>
        ['east','south','west','north','zhong','fa','bai'].includes(t.type)
      );
      if (ziTiles.length > 0) {
        return ziTiles[Math.floor(Math.random() * ziTiles.length)];
      }
      return singles[Math.floor(Math.random() * singles.length)];
    }

    // 3. 打多余牌 (超过2张)
    const extras = hand.filter(t => counts[t.type] > 2);
    if (extras.length > 0) {
      return extras[0];
    }

    // 4. 随机打一张
    const randomTile = hand[Math.floor(Math.random() * hand.length)];
    if (randomTile) {
      return randomTile;
    }

    // 防御性代码：手牌为空时不应该到达这里
    console.error('[chooseDiscard] 手牌为空，无法选择打出的牌');
    return null;
  }

  // 困难AI：筋牌防御
  hardChooseDiscard() {
    const hand = this.player.hand;
    const visibleTiles = this.getVisibleTiles();

    // 计算每张牌的保留价值和危险度
    const tileScores = hand.map(tile => ({
      tile: tile,
      keepScore: this.evaluateKeepValue(tile, hand),
      dangerScore: this.evaluateDangerScore(tile, visibleTiles)
    }));

    // 综合评分
    tileScores.forEach(item => {
      item.finalScore = item.keepScore - (item.dangerScore * 0.8);
    });

    // 排序
    tileScores.sort((a, b) => a.finalScore - b.finalScore);

    // 优先选安全牌
    const safeTiles = tileScores.filter(t => t.dangerScore < 30);
    if (safeTiles.length > 0) {
      return safeTiles[0].tile;
    }

    // 防御性代码：检查是否有可选的牌
    if (tileScores.length > 0) {
      return tileScores[0].tile;
    }

    console.error('[hardChooseDiscard] 手牌为空，无法选择打出的牌');
    return null;
  }

  // 获取所有可见牌
  getVisibleTiles() {
    const visibleTiles = {};

    // 需要游戏上下文
    if (!this.gameContext || !this.gameContext.players) {
      return visibleTiles;
    }

    const allPlayers = [0, 1, 2, 3];
    allPlayers.forEach(playerId => {
      const player = this.gameContext.players[playerId];

      // 打出的牌
      if (player.pool) {
        player.pool.forEach(tile => {
          const key = tile.type;
          visibleTiles[key] = (visibleTiles[key] || 0) + 1;
        });
      }

      // 副露的牌
      if (player.melds) {
        player.melds.forEach(meld => {
          meld.tiles.forEach(tile => {
            const key = tile.type;
            visibleTiles[key] = (visibleTiles[key] || 0) + 1;
          });
        });
      }
    });

    return visibleTiles;
  }

  // 评估保留价值
  evaluateKeepValue(tile, hand) {
    let score = 0;
    const counts = {};
    hand.forEach(t => counts[t.type] = (counts[t.type] || 0) + 1);

    // 对子和刻子有价值
    if (counts[tile.type] >= 2) score += 50;
    if (counts[tile.type] >= 3) score += 100;

    // 顺子潜力
    const suit = tile.type.replace(/\d/g, '');
    const num = parseInt(tile.type.replace(/\D/g, ''));

    if (['wan', 'sou', 'pin'].includes(suit)) {
      const hasLeft = hand.some(t => t.type === `${suit}${num - 1}`);
      const hasRight = hand.some(t => t.type === `${suit}${num + 1}`);

      if (hasLeft && hasRight) score += 40;
      else if (hasLeft || hasRight) score += 20;
    }

    return score;
  }

  // 评估危险度（筋牌防御）
  evaluateDangerScore(tile, visibleTiles) {
    let danger = 0;
    const tileType = tile.type;
    const visibleCount = visibleTiles[tileType] || 0;
    const remainingCount = 4 - visibleCount;

    // 4张都可见 = 绝对安全
    if (remainingCount === 0) return 0;

    const suit = tile.type.replace(/\d/g, '');
    const num = parseInt(tile.type.replace(/\D/g, ''));

    // 筋牌检测
    if (['wan', 'sou', 'pin'].includes(suit)) {
      if (this.isSujiSafe(num, suit, visibleTiles)) {
        danger -= 15;
      }
    }

    // 字牌危险度
    if (!['wan', 'sou', 'pin'].includes(suit)) {
      if (visibleCount >= 3) return 0;
      if (visibleCount >= 2) danger += 10;
      else danger += 25;
    } else {
      // 数牌危险度
      if (num >= 4 && num <= 6) {
        danger += 20;
      }
      if (num === 3 || num === 7) {
        danger += 15;
      }
      if (num === 1 || num === 9) {
        danger += 5;
      }

      if (visibleCount === 0) danger += 20;
      else if (visibleCount === 1) danger += 15;
      else if (visibleCount === 2) danger += 10;
    }

    // 对手副露越多越危险
    if (this.gameContext && this.gameContext.players) {
      for (let i = 0; i < 4; i++) {
        if (i !== this.player.id) {
          const opponent = this.gameContext.players[i];
          if (opponent.melds && opponent.melds.length > 0) {
            danger += opponent.melds.length * 5;
          }
        }
      }
    }

    return Math.max(0, Math.min(100, danger));
  }

  // 筋牌安全判定
  isSujiSafe(num, suit, visibleTiles) {
    // 筋牌关系: 1-4-7, 2-5-8, 3-6-9
    const sujiPatterns = [
      [1, 4, 7],
      [2, 5, 8],
      [3, 6, 9]
    ];

    for (const pattern of sujiPatterns) {
      if (pattern.includes(num)) {
        const middleValue = pattern[1];
        const middleKey = `${suit}${middleValue}`;

        if ((visibleTiles[middleKey] || 0) >= 2) {
          return true;
        }
      }
    }

    return false;
  }

  // 评估危险牌 (哪些牌敌人可能胡)
  evaluateDanger(pool) {
    const dangerous = [];
    const allTypes = getAllTileTypes();

    // 统计桌面上打出的牌
    const discarded = {};
    pool.forEach(t => discarded[t.type] = (discarded[t.type] || 0) + 1);

    // 检查每种牌是否危险 (场上只打出1-2张，可能有人握着)
    allTypes.forEach(type => {
      const discardedCount = discarded[type] || 0;
      if (discardedCount <= 2) {
        // 后期 (牌山少于20张) 更危险
        if (this.gameContext && this.gameContext.wall && this.gameContext.wall.length < 20) {
          dangerous.push(type);
        }
      }
    });

    return dangerous;
  }
}

// 导出 (支持Node.js和浏览器)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIPlayer, AI_DIFFICULTY };
}