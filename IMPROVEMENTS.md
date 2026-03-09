# Mahjong 改进建议文档

本文档整理了 `majiang` 项目相比 `mahjong` 的优秀设计，包含代码示例，供改进参考。

---

## 目录

1. [AI 难度分级系统](#1-ai-难度分级系统)
2. [HardAI 筋牌防御算法](#2-hardai-筋牌防御算法)
3. [吃牌逻辑完整实现](#3-吃牌逻辑完整实现)
4. [番型扩展](#4-番型扩展)
5. [动作动画系统](#5-动作动画系统)
6. [结算界面详细展示](#6-结算界面详细展示)
7. [响应式CSS设计](#7-响应式css设计)
8. [状态锁机制](#8-状态锁机制)

---

## 1. AI 难度分级系统

### 问题
`mahjong` 只有一种 AI 难度，新手和高手体验不佳。

### 解决方案
实现三档难度，通过 `aiDifficulty` 属性控制。

### 代码实现

```javascript
// ============================================
// GameController 构造函数
// ============================================
class GameController {
    constructor() {
        this.gameState = new GameState();
        this.renderer = new GameRenderer();
        this.aiDifficulty = 'simple'; // 'simple' | 'medium' | 'hard'
        // ... 其他初始化
    }

    // 根据 AI 难度选择决策类
    getAIDecision(playerId) {
        switch (this.aiDifficulty) {
            case 'simple':
                return null; // 简单 AI 不需要决策类，直接随机
            case 'medium':
                return AIDecision.decideTurnAction(this.gameState, playerId);
            case 'hard':
                return HardAIDecision.decideTurnAction(this.gameState, playerId);
        }
    }
}
```

### 简单 AI 实现

```javascript
// ============================================
// Simple AI - 随机出牌，不吃碰杠
// ============================================
processAITurn(playerId) {
    const player = this.gameState.players[playerId];

    // 简单 AI：只检查自摸，不主动吃碰杠
    if (this.gameState.canHu(player)) {
        this.handleHu(player, null, true); // 自摸
        return;
    }

    // 随机出牌
    const randomIndex = Math.floor(Math.random() * player.hand.length);
    const discardTile = player.hand[randomIndex];

    setTimeout(() => {
        this.discardTile(player, discardTile);
    }, 800 + Math.random() * 500); // 800-1300ms 延迟
}

// 简单 AI 不响应对手出牌
checkAIResponseToDiscard(playerId) {
    if (this.aiDifficulty === 'simple') {
        return false; // 直接跳过
    }
    // medium/hard AI 的响应逻辑...
}
```

### 中等 AI 实现

```javascript
// ============================================
// AIDecision - 中等难度
// ============================================
class AIDecision {
    static decideTurnAction(gameState, playerId) {
        const player = gameState.players[playerId];

        // 1. 检查自摸
        if (gameState.canHu(player)) {
            return { action: 'hu', isSelfDraw: true };
        }

        // 2. 检查暗杠/补杠 (70% 概率杠)
        const gangOptions = gameState.getGangOptions(player);
        const selfGangOptions = gangOptions.filter(o => !o.fromDiscard);
        if (selfGangOptions.length > 0 && Math.random() < 0.7) {
            return { action: 'gang', gangOption: selfGangOptions[0] };
        }

        // 3. 策略出牌
        const discardTile = this.decideDiscard(player, gameState);
        return { action: 'discard', tile: discardTile };
    }

    static decideResponseToDiscard(gameState, playerId) {
        const player = gameState.players[playerId];
        const lastTile = gameState.lastDiscardedTile;

        // 优先级: 胡 > 杠 > 碰 > 吃

        if (gameState.canHu(player, lastTile)) {
            return { action: 'hu', tile: lastTile };
        }

        // 检查明杠 (60% 概率)
        const gangOptions = gameState.getGangOptions(player);
        const discardGang = gangOptions.find(o => o.fromDiscard);
        if (discardGang && Math.random() < 0.6) {
            return { action: 'gang', gangOption: discardGang };
        }

        // 检查碰 (80% 概率)
        if (gameState.canPeng(player, lastTile) && Math.random() < 0.8) {
            return { action: 'peng', tile: lastTile };
        }

        // 检查吃 (50% 概率)
        if (gameState.canChi(player, lastTile) && Math.random() < 0.5) {
            const combos = gameState.getChiCombinations(lastTile);
            return { action: 'chi', tile: lastTile, combination: combos[0] };
        }

        return null; // 过
    }

    // 出牌策略评分
    static decideDiscard(player, gameState) {
        const hand = player.hand;

        const tileScores = hand.map(tile => ({
            tile: tile,
            score: this.evaluateDiscardPriority(tile, hand, player.melds)
        }));

        // 排序：分数低的先打
        tileScores.sort((a, b) => a.score - b.score);

        // 20% 随机性
        if (Math.random() < 0.2 && tileScores.length > 1) {
            return tileScores[1].tile;
        }

        return tileScores[0].tile;
    }

    static evaluateDiscardPriority(tile, hand, melds) {
        let score = 0;

        // 对子和刻子有价值
        const sameCount = hand.filter(t =>
            t.suit === tile.suit && t.value === tile.value
        ).length;

        if (sameCount >= 2) score += 50;  // 对子
        if (sameCount >= 3) score += 100; // 刻子

        // 顺子潜力
        if (['wan', 'tiao', 'tong'].includes(tile.suit)) {
            const hasLeft = hand.some(t =>
                t.suit === tile.suit && t.value === tile.value - 1
            );
            const hasRight = hand.some(t =>
                t.suit === tile.suit && t.value === tile.value + 1
            );

            if (hasLeft && hasRight) score += 40; // 中张
            else if (hasLeft || hasRight) score += 20; // 边张
        }

        // 字牌灵活性低
        if (tile.category === 'wind') score -= 5;

        return score;
    }
}
```

---

## 2. HardAI 筋牌防御算法

### 问题
`mahjong` 的防守逻辑简单，只统计场上牌数，没有筋牌分析。

### 解决方案
实现筋牌安全判定和综合危险评分。

### 代码实现

```javascript
// ============================================
// HardAIDecision - 困难难度
// ============================================
class HardAIDecision {

    // 获取所有可见牌（打出的牌 + 副露）
    static getVisibleTiles(gameState, currentPlayerId) {
        const visibleTiles = {};
        const allPlayers = ['east', 'south', 'west', 'north'];

        allPlayers.forEach(playerId => {
            const player = gameState.players[playerId];

            // 打出的牌
            player.discardedTiles.forEach(tile => {
                const key = `${tile.suit}_${tile.value}`;
                visibleTiles[key] = (visibleTiles[key] || 0) + 1;
            });

            // 副露的牌
            player.melds.forEach(meld => {
                meld.tiles.forEach(tile => {
                    const key = `${tile.suit}_${tile.value}`;
                    visibleTiles[key] = (visibleTiles[key] || 0) + 1;
                });
            });
        });

        return visibleTiles;
    }

    // 评估出牌危险度
    static evaluateDangerScore(tile, gameState, playerId, visibleTiles) {
        let danger = 0;
        const tileKey = `${tile.suit}_${tile.value}`;
        const visibleCount = visibleTiles[tileKey] || 0;
        const remainingCount = 4 - visibleCount;

        // 4张都可见 = 绝对安全
        if (remainingCount === 0) return 0;

        // 筋牌检测
        if (['wan', 'tiao', 'tong'].includes(tile.suit)) {
            if (this.isSujiSafe(tile, visibleTiles)) {
                danger -= 15;
            }
        }

        // 字牌危险度
        if (tile.category === 'wind' || tile.category === 'dragon') {
            if (visibleCount >= 3) return 0;
            if (visibleCount >= 2) danger += 10;
            else danger += 25; // 单张字牌危险
        } else {
            // 数牌危险度

            // 中张 (4,5,6) 更危险
            if (tile.value >= 4 && tile.value <= 6) {
                danger += 20;
            }

            // 3 和 7 也危险
            if (tile.value === 3 || tile.value === 7) {
                danger += 15;
            }

            // 幺九较安全
            if (tile.value === 1 || tile.value === 9) {
                danger += 5;
            }

            // 可见数量影响
            if (visibleCount === 0) danger += 20;
            else if (visibleCount === 1) danger += 15;
            else if (visibleCount === 2) danger += 10;
        }

        // 对手副露越多越危险
        const playerOrder = ['east', 'south', 'west', 'north'];
        playerOrder.forEach(pid => {
            if (pid === playerId) return;

            const opponent = gameState.players[pid];
            if (opponent.melds.length > 0) {
                danger += opponent.melds.length * 5;
            }
        });

        return Math.max(0, Math.min(100, danger));
    }

    // 筋牌安全判定
    static isSujiSafe(tile, visibleTiles) {
        const v = tile.value;
        const suit = tile.suit;

        // 筋牌原理：
        // 如果 4 已经被打出很多，那么 1 和 7 相对安全
        // 因为 1-2-3 和 2-3-4 的顺子需要 1 或 7
        const sujiPatterns = [
            [1, 4, 7], // 筋: 1-4-7
            [2, 5, 8], // 筋: 2-5-8
            [3, 6, 9]  // 筋: 3-6-9
        ];

        for (const pattern of sujiPatterns) {
            if (pattern.includes(v)) {
                const middleValue = pattern[1]; // 中间张
                const middleKey = `${suit}_${middleValue}`;

                // 如果中间张可见 >= 2 张，则筋牌安全
                if ((visibleTiles[middleKey] || 0) >= 2) {
                    return true;
                }
            }
        }

        return false;
    }

    // 综合出牌决策
    static decideDiscard(player, gameState, playerId) {
        const hand = player.hand;
        const visibleTiles = this.getVisibleTiles(gameState, playerId);

        // 计算每张牌的保留价值和危险度
        const tileScores = hand.map(tile => ({
            tile: tile,
            keepScore: this.evaluateKeepValue(tile, hand, player.melds),
            dangerScore: this.evaluateDangerScore(tile, gameState, playerId, visibleTiles)
        }));

        // 综合评分 = 保留价值 - 危险度 * 0.8
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

        return tileScores[0].tile;
    }
}
```

### 筋牌原理图解

```
筋牌关系：
┌─────────────────────────────────┐
│  数牌 1-9 的筋牌关系：           │
│                                 │
│  1 ── 4 ── 7  (同筋)            │
│  2 ── 5 ── 8  (同筋)            │
│  3 ── 6 ── 9  (同筋)            │
│                                 │
│  原理：如果 4 被打出很多，       │
│  那么 1 和 7 相对安全，          │
│  因为不可能形成 1-2-3 或 6-7-8  │
│  的两面听                       │
└─────────────────────────────────┘
```

---

## 3. 吃牌逻辑完整实现

### 问题
`mahjong` 的吃牌逻辑标注为 TODO，未实现。

### 解决方案
实现完整的吃牌组合检测和选择界面。

### 代码实现

```javascript
// ============================================
// 吃牌组合检测
// ============================================

/**
 * 获取所有可能的吃牌组合
 * @param {Tile} tile - 被打出的牌
 * @returns {Array<Array<Tile>>} 可吃的组合数组
 */
getChiCombinations(tile) {
    // 只有数牌可以吃
    if (!['wan', 'tiao', 'tong'].includes(tile.type)) {
        return [];
    }

    const combinations = [];
    const v = tile.value;
    const suit = tile.type.replace(/[0-9]/g, ''); // 提取花色

    // 三种顺子模式
    // 模式1: x-2, x-1, x  (需要 x-2 和 x-1)
    if (v >= 3) {
        combinations.push([
            { suit, value: v - 2 },
            { suit, value: v - 1 }
        ]);
    }

    // 模式2: x-1, x, x+1  (需要 x-1 和 x+1)
    if (v >= 2 && v <= 8) {
        combinations.push([
            { suit, value: v - 1 },
            { suit, value: v + 1 }
        ]);
    }

    // 模式3: x, x+1, x+2  (需要 x+1 和 x+2)
    if (v <= 7) {
        combinations.push([
            { suit, value: v + 1 },
            { suit, value: v + 2 }
        ]);
    }

    return combinations;
}

/**
 * 检查玩家是否可以吃
 * @param {Player} player - 玩家
 * @param {Tile} tile - 被打出的牌
 * @param {string} discarderId - 打牌者ID
 * @returns {boolean}
 */
canChi(player, tile, discarderId) {
    // 只有下家可以吃
    const playerOrder = ['south', 'west', 'north', 'east']; // 逆时针
    const discarderIndex = playerOrder.indexOf(discarderId);
    const nextPlayerId = playerOrder[(discarderIndex + 1) % 4];

    if (player.id !== nextPlayerId) {
        return false;
    }

    // 检查是否有可吃的组合
    const combinations = this.getChiCombinations(tile);
    const validCombos = combinations.filter(combo =>
        combo.every(needed =>
            player.hand.some(h =>
                h.suit === needed.suit && h.value === needed.value
            )
        )
    );

    return validCombos.length > 0;
}
```

### 吃牌选择 UI

```javascript
// ============================================
// 显示吃牌选择界面
// ============================================
showChiSelection(tile, combinations) {
    // 创建选择面板
    const panel = document.createElement('div');
    panel.className = 'chi-selection-panel';
    panel.innerHTML = '<h3>选择吃牌组合</h3>';

    combinations.forEach((combo, index) => {
        const option = document.createElement('div');
        option.className = 'chi-option';
        option.dataset.index = index;

        // 显示牌面
        combo.forEach(t => {
            const tileEl = this.createTileElement(t);
            option.appendChild(tileEl);
        });

        // 加上被吃的牌
        const discardedTileEl = this.createTileElement(tile);
        discardedTileEl.classList.add('highlight');
        option.appendChild(discardedTileEl);

        option.addEventListener('click', () => {
            this.executeChi(tile, combo);
            panel.remove();
        });

        panel.appendChild(option);
    });

    // 过按钮
    const passBtn = document.createElement('button');
    passBtn.textContent = '过';
    passBtn.className = 'btn secondary';
    passBtn.onclick = () => {
        panel.remove();
        this.handleGuo();
    };
    panel.appendChild(passBtn);

    document.body.appendChild(panel);
}
```

### CSS 样式

```css
/* 吃牌选择面板 */
.chi-selection-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(20, 40, 30, 0.95);
    padding: 20px;
    border-radius: 12px;
    border: 2px solid var(--primary-color);
    z-index: 1000;
}

.chi-option {
    display: flex;
    gap: 5px;
    padding: 10px;
    margin: 10px 0;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.chi-option:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.02);
}

.chi-option .tile.highlight {
    box-shadow: 0 0 10px var(--primary-color);
}
```

---

## 4. 番型扩展

### 问题
`mahjong` 只支持 7 种番型，缺少高番牌型。

### 解决方案
扩展番型系统，增加国士无双、大三元等。

### 代码实现

```javascript
// ============================================
// 番型定义
// ============================================
const FanType = {
    PING_HU: { name: '平胡', score: 1 },
    DUI_DUI_HU: { name: '对对胡', score: 2 },
    QING_YI_SE: { name: '清一色', score: 6 },
    HUN_YI_SE: { name: '混一色', score: 3 },
    QI_DUI_ZI: { name: '七对子', score: 2 },
    GUO_SHI_WU_SHUANG: { name: '国士无双', score: 13 },
    XIAO_SAN_YUAN: { name: '小三元', score: 2 },
    DA_SAN_YUAN: { name: '大三元', score: 8 },
    SI_AN_KE: { name: '四暗刻', score: 6 },
    SAN_AN_KE: { name: '三暗刻', score: 2 },
    ZI_MO: { name: '自摸', score: 1 },
    GANG_KAI: { name: '杠开', score: 1 }
};

// ============================================
// 国士无双检测 (十三幺)
// ============================================
static checkThirteenOrphans(hand, lastTile = null) {
    const tiles = lastTile ? [...hand, lastTile] : [...hand];

    // 国士无双需要的13张牌
    const required = [
        'wan_1', 'wan_9',      // 一万、九万
        'tiao_1', 'tiao_9',    // 一条、九条
        'tong_1', 'tong_9',    // 一筒、九筒
        'dong', 'nan', 'xi', 'bei',  // 东南西北
        'zhong', 'fa', 'bai'   // 中发白
    ];

    // 统计手牌
    const tileCounts = {};
    tiles.forEach(t => {
        const key = `${t.suit}_${t.value || 1}`;
        tileCounts[key] = (tileCounts[key] || 0) + 1;
    });

    // 检查是否包含所有13种牌
    let hasAll = true;
    let pairTile = null;

    for (const req of required) {
        if (!tileCounts[req]) {
            hasAll = false;
            break;
        }
        if (tileCounts[req] === 2) {
            pairTile = req; // 找到对子
        }
    }

    if (!hasAll || !pairTile) return null;

    return {
        winType: 'thirteenOrphans',
        fanTypes: [{ name: '国士无双', score: 13 }],
        score: 13
    };
}

// ============================================
// 大三元检测
// ============================================
static checkDaSanYuan(sets, pair) {
    // 检查是否有中、发、白三个刻子
    const dragons = ['zhong', 'fa', 'bai'];
    let dragonPungs = 0;

    sets.forEach(set => {
        if (set.type === 'pung' && dragons.includes(set.tiles[0].suit)) {
            dragonPungs++;
        }
    });

    if (dragonPungs === 3) {
        return { name: '大三元', score: 8 };
    }

    return null;
}

// ============================================
// 四暗刻检测
// ============================================
static checkSiAnKe(sets, melds) {
    // 暗刻：手中的刻子（非碰牌）
    if (melds.length > 0) return null; // 有副露不算

    let anKe = 0;
    sets.forEach(set => {
        if (set.type === 'pung' && !set.isMelded) {
            anKe++;
        }
    });

    if (anKe === 4) {
        return { name: '四暗刻', score: 6 };
    }
    if (anKe === 3) {
        return { name: '三暗刻', score: 2 };
    }

    return null;
}
```

---

## 5. 动画系统

### 问题
`mahjong` 缺少吃碰杠动画，游戏体验不够流畅。

### 解决方案
使用 CSS 动画 + 覆盖层实现动作动画。

### 代码实现

```javascript
// ============================================
// 动画管理
// ============================================
class AnimationManager {

    // 吃牌动画
    animateChi(tile, combination) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'action-overlay chi-overlay';
            overlay.innerHTML = `
                <div class="action-content">
                    <span class="action-text">吃</span>
                    <div class="action-tiles"></div>
                </div>
            `;

            const tilesContainer = overlay.querySelector('.action-tiles');

            // 添加吃牌组合
            combination.forEach(t => {
                tilesContainer.appendChild(this.createTileElement(t));
            });
            tilesContainer.appendChild(this.createTileElement(tile));

            document.body.appendChild(overlay);

            // 播放音效
            soundManager.play('chi');

            setTimeout(() => {
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 300);
            }, 800);
        });
    }

    // 碰牌动画
    animatePeng(tile) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'action-overlay peng-overlay';
            overlay.innerHTML = `
                <div class="action-content">
                    <span class="action-text">碰</span>
                    <div class="action-tiles"></div>
                </div>
            `;

            const tilesContainer = overlay.querySelector('.action-tiles');

            // 添加4张牌（3张手牌 + 1张被打出的）
            for (let i = 0; i < 3; i++) {
                tilesContainer.appendChild(this.createTileElement(tile));
            }

            document.body.appendChild(overlay);
            soundManager.play('peng');

            setTimeout(() => {
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 300);
            }, 800);
        });
    }

    // 杠牌动画
    animateGang(tile, isAnGang = false) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'action-overlay gang-overlay';
            overlay.innerHTML = `
                <div class="action-content">
                    <span class="action-text">${isAnGang ? '暗杠' : '杠'}</span>
                    <div class="action-tiles"></div>
                </div>
            `;

            const tilesContainer = overlay.querySelector('.action-tiles');

            // 添加4张牌
            for (let i = 0; i < 4; i++) {
                const tileEl = this.createTileElement(tile);
                if (isAnGang && i === 3) {
                    tileEl.classList.add('hidden-tile'); // 暗杠最后一张隐藏
                }
                tilesContainer.appendChild(tileEl);
            }

            document.body.appendChild(overlay);
            soundManager.play('gang');

            setTimeout(() => {
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 300);
            }, 1000);
        });
    }
}
```

### CSS 动画

```css
/* 动作覆盖层 */
.action-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
    animation: fadeIn 0.3s ease;
}

.action-overlay.fade-out {
    animation: fadeOut 0.3s ease forwards;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
}

.action-content {
    text-align: center;
    animation: scaleIn 0.3s ease;
}

@keyframes scaleIn {
    from { transform: scale(0.5); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

.action-text {
    display: block;
    font-size: 3rem;
    font-weight: bold;
    margin-bottom: 20px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
}

/* 不同动作的颜色 */
.chi-overlay .action-text { color: #4CAF50; }
.peng-overlay .action-text { color: #2196F3; }
.gang-overlay .action-text { color: #FFD700; }

.action-tiles {
    display: flex;
    gap: 10px;
    justify-content: center;
}

.action-tiles .tile {
    width: 40px;
    height: 55px;
    animation: tileSlide 0.3s ease backwards;
}

.action-tiles .tile:nth-child(1) { animation-delay: 0.1s; }
.action-tiles .tile:nth-child(2) { animation-delay: 0.2s; }
.action-tiles .tile:nth-child(3) { animation-delay: 0.3s; }
.action-tiles .tile:nth-child(4) { animation-delay: 0.4s; }

@keyframes tileSlide {
    from { transform: translateY(-30px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
```

---

## 6. 结算界面详细展示

### 问题
`mahjong` 结算界面简单，缺少详细牌型展示。

### 解决方案
实现详细的结算界面，显示手牌、副露、番型明细。

### 代码实现

```javascript
// ============================================
// 显示详细结算界面
// ============================================
showDetailedSettlement(winner, result) {
    const screen = document.getElementById('settlement-screen');

    // 构建结算内容
    let html = `
        <h2>${winner === 'player' ? '恭喜胡牌!' : 'AI 胡牌'}</h2>

        <div class="settlement-result">
            <!-- 胡牌类型 -->
            <div class="win-type">
                ${this.getWinTypeName(result.winType)}
            </div>

            <!-- 手牌展示 -->
            <div class="winning-hand">
                <div class="hand-label">手牌</div>
                <div class="hand-tiles">
                    ${winner.hand.map(t => this.createTileHTML(t)).join('')}
                </div>
            </div>

            <!-- 副露展示 -->
            ${result.melds && result.melds.length > 0 ? `
                <div class="melds-display">
                    <div class="hand-label">副露</div>
                    ${result.melds.map(meld => `
                        <div class="meld-set">
                            ${meld.tiles.map(t => this.createTileHTML(t)).join('')}
                            <span class="meld-label">
                                ${this.getMeldTypeName(meld.type)}
                            </span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <!-- 番型明细 -->
            <div class="fan-breakdown">
                <div class="fan-header">番型明细</div>
                ${result.fanTypes.map(fan => `
                    <div class="fan-row">
                        <span class="fan-name">${fan.name}</span>
                        <span class="fan-score">${fan.score}番</span>
                    </div>
                `).join('')}
            </div>

            <!-- 总分 -->
            <div class="score-total">
                <span class="score-label">总计</span>
                <span class="score-value">${result.score}番</span>
            </div>
        </div>

        <button class="btn primary" onclick="gameController.restartGame()">
            再来一局
        </button>
    `;

    screen.innerHTML = html;
    screen.classList.remove('hidden');
}

getWinTypeName(winType) {
    const names = {
        'standard': '标准胡牌',
        'sevenPairs': '七对子',
        'thirteenOrphans': '国士无双'
    };
    return names[winType] || winType;
}

getMeldTypeName(type) {
    const names = {
        'chi': '吃',
        'peng': '碰',
        'gang': '杠',
        'an-gang': '暗杠'
    };
    return names[type] || type;
}
```

### CSS 样式

```css
/* 结算界面样式 */
.winning-hand {
    background: rgba(201, 162, 39, 0.1);
    border: 2px solid rgba(201, 162, 39, 0.3);
    border-radius: 12px;
    padding: 15px;
    margin-bottom: 15px;
}

.hand-label {
    color: var(--primary-color);
    font-size: 0.9rem;
    margin-bottom: 10px;
    text-align: center;
}

.hand-tiles {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: center;
}

.melds-display {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    justify-content: center;
    padding: 15px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.meld-set {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
}

.fan-breakdown {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 15px;
    margin: 15px 0;
}

.fan-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.fan-name { color: #f0f0f0; }
.fan-score {
    color: var(--primary-color);
    font-weight: 600;
}

.score-total {
    display: flex;
    justify-content: space-between;
    padding: 15px 20px;
    background: linear-gradient(135deg, rgba(201, 162, 39, 0.2) 0%, rgba(201, 162, 39, 0.1) 100%);
    border: 2px solid var(--primary-color);
    border-radius: 10px;
}

.score-value {
    color: var(--primary-color);
    font-size: 1.5rem;
    font-weight: bold;
}
```

---

## 7. 响应式CSS设计

### 问题
`mahjong` 的牌面尺寸固定，不同屏幕体验不一致。

### 解决方案
使用 CSS 变量控制尺寸，媒体查询自适应。

### 代码实现

```css
/* ============================================
   CSS 变量定义
   ============================================ */
:root {
    --tile-width: 32px;
    --tile-height: 44px;
    --tile-depth: 4px;
    --primary-color: #c9a227;
    --table-color: #1a5f3c;
    --bg-color: #0a1a12;
    --text-color: #f0f0f0;
}

/* ============================================
   桌面端 (>768px)
   ============================================ */
.player-area.bottom .tile {
    width: var(--tile-width);
    height: var(--tile-height);
    font-size: 0.9rem;
}

/* ============================================
   平板端 (768px)
   ============================================ */
@media (max-width: 768px) {
    :root {
        --tile-width: 24px;
        --tile-height: 34px;
    }

    .player-area.bottom .tile {
        font-size: 0.75rem;
    }

    .mahjong-table {
        width: 80%;
        height: 50%;
    }
}

/* ============================================
   手机端 (480px)
   ============================================ */
@media (max-width: 480px) {
    :root {
        --tile-width: 20px;
        --tile-height: 28px;
    }

    .player-area.bottom .tile {
        font-size: 0.6rem;
    }

    .action-panel {
        bottom: 60px;
        gap: 5px;
    }

    .action-btn {
        padding: 8px 12px;
        font-size: 0.8rem;
    }
}
```

---

## 8. 状态锁机制

### 问题
`mahjong` 没有防止并发操作的机制，可能导致状态混乱。

### 解决方案
使用 `isAnimating` 锁防止并发操作。

### 代码实现

```javascript
// ============================================
// GameController 状态锁
// ============================================
class GameController {
    constructor() {
        this.isAnimating = false; // 动画锁
        this.justDiscarded = null; // 最近打出的牌
        // ...
    }

    // 处理玩家点击手牌
    handlePlayerTileClick(tile) {
        // 防止动画期间操作
        if (this.isAnimating) {
            console.log('动画进行中，请稍候');
            return;
        }

        // 检查是否是玩家回合
        if (!this.gameState.isHumanTurn) {
            return;
        }

        // 区分摸牌后出牌和响应出牌
        if (this.justDiscarded) {
            // 响应阶段，不能直接出牌
            return;
        }

        this.discardTile(this.gameState.players.south, tile);
    }

    // 出牌（带动画锁）
    async discardTile(player, tile) {
        if (this.isAnimating) return;

        this.isAnimating = true;

        try {
            // 移除手牌
            player.hand = player.hand.filter(t => t.id !== tile.id);

            // 播放出牌动画
            await this.animateDiscard(tile);

            // 更新游戏状态
            this.gameState.lastDiscardedTile = tile;
            this.gameState.lastDiscardedBy = player.id;
            player.discardedTiles.push(tile);

            // 检查其他玩家响应
            await this.checkResponses();
        } finally {
            this.isAnimating = false;
        }
    }

    // 动画辅助函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async animateDiscard(tile) {
        // 动画逻辑
        await this.delay(200);
    }
}
```

---

## 总结

| 改进项 | 优先级 | 复杂度 | 影响范围 |
|--------|--------|--------|----------|
| AI 难度分级 | 高 | 中 | AI 逻辑 |
| 筋牌防御 | 高 | 高 | AI 逻辑 |
| 吃牌逻辑 | 高 | 中 | 游戏核心 |
| 番型扩展 | 中 | 中 | 结算逻辑 |
| 动画系统 | 中 | 低 | UI/UX |
| 结算界面 | 中 | 低 | UI/UX |
| 响应式设计 | 低 | 低 | CSS |
| 状态锁 | 中 | 低 | 游戏控制 |

建议按优先级逐步实施，每个改进项独立测试验证。