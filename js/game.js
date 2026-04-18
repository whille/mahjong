// 麻将游戏主逻辑

// 游戏状态
const GameState = {
  WAITING: 'waiting',
  DEALING: 'dealing',
  DRAWING: 'drawing',
  DISCARDING: 'discarding',
  RESPONDING: 'responding',
  GAMEOVER: 'gameover'
};

// 游戏状态

// 玩家人声配置 - 每个人固定一个语音（两男两女）
// 实际位置：玩家=南家(0)，右侧=东家(1)，上方=北家(2)，左侧=西家(3)
const PLAYER_VOICES = {
  0: { name: '南家(你)', voice: null, pitch: 1.0 },           // 玩家（下方）
  1: { name: '东家', voice: 'zh-CNMale', pitch: 0.8 },        // 电脑1（右侧，男声）
  2: { name: '北家', voice: 'zh-CNFemale', pitch: 1.2 },      // 电脑2（上方，女声）
  3: { name: '西家', voice: 'zh-CNMale', pitch: 1.0 }         // 电脑3（左侧，男声）
};

// 游戏全局状态
let game = {
  state: GameState.WAITING,
  players: [],
  wall: [],
  currentPlayer: 0,
  lastDiscard: null,
  dealer: 0,
  lastAction: null,  // 用于跟踪上一个动作（杠后抢胡）
  // [新增] 状态锁 - 防止动画期间的并发操作
  isAnimating: false,
  // [新增] 存储所有timeout，用于清理
  timeouts: [],
  // [新增] AI难度设置
  aiDifficulty: AI_DIFFICULTY.MEDIUM,
  // [新增] 记录打牌者
  lastDrawer: undefined,
  // [新增] 记录日志内容（用于恢复）
  logEntries: []
};

// ============================================
// 游戏状态持久化
// ============================================

/**
 * 保存游戏状态到 localStorage
 */
function saveGameState() {
  const state = {
    state: game.state,
    players: game.players.map(p => ({
      id: p.id,
      hand: p.hand,
      pool: p.pool,
      melds: p.melds,
      isTenpai: p.isTenpai,
      isHu: p.isHu
    })),
    wall: game.wall,
    currentPlayer: game.currentPlayer,
    lastDiscard: game.lastDiscard,
    dealer: game.dealer,
    lastAction: game.lastAction,
    lastDrawer: game.lastDrawer,
    // 保存日志条目
    logEntries: game.logEntries || []
  };
  localStorage.setItem('mahjong_game_state', JSON.stringify(state));
}

/**
 * 从 localStorage 恢复游戏状态
 */
function loadGameState() {
  const saved = localStorage.getItem('mahjong_game_state');
  if (!saved) return false;

  try {
    const state = JSON.parse(saved);
    game.state = state.state;
    game.players = state.players;
    game.wall = state.wall;
    game.currentPlayer = state.currentPlayer;
    game.lastDiscard = state.lastDiscard;
    game.dealer = state.dealer;
    game.lastAction = state.lastAction;
    game.lastDrawer = state.lastDrawer;
    game.logEntries = state.logEntries || [];
    // 恢复后重置动画状态
    game.isAnimating = false;
    game.timeouts = [];

    // 重新绑定 AI 方法
    game.players.forEach((p, i) => {
      if (i > 0) {
        p.decide = function(tile) {
          const ai = new AIPlayer(this, game.aiDifficulty, game);
          return ai.decide(tile);
        };
        p.decideResponse = function(discardedTile) {
          const ai = new AIPlayer(this, game.aiDifficulty, game);
          return ai.decideResponse(discardedTile);
        };
        p.decideDiscardAfterAction = function() {
          const ai = new AIPlayer(this, game.aiDifficulty, game);
          return ai.decideDiscardAfterAction();
        };
      }
    });

    // 恢复日志内容
    restoreLogContent();

    return true;
  } catch (e) {
    console.error('恢复游戏状态失败:', e);
    return false;
  }
}

/**
 * 恢复日志内容
 */
function restoreLogContent() {
  const logContent = document.getElementById('log-content');
  if (!logContent || !game.logEntries) return;

  logContent.innerHTML = '';
  game.logEntries.forEach(entry => {
    const div = document.createElement('div');
    div.className = `log-entry ${entry.type || 'normal'}`;
    div.innerHTML = entry.message;
    logContent.appendChild(div);
  });

  // 滚动到底部
  logContent.scrollTop = logContent.scrollHeight;
}

/**
 * 清除保存的游戏状态
 */
function clearGameState() {
  localStorage.removeItem('mahjong_game_state');
}

// ============================================
// 动画锁工具函数
// ============================================

/**
 * 开始动画 - 设置动画锁
 */
function startAnimation() {
  game.isAnimating = true;
}

/**
 * 结束动画 - 释放动画锁
 */
function endAnimation() {
  game.isAnimating = false;
}

/**
 * 安全执行动画
 * @param {Function} animFn - 动画函数
 * @param {number} duration - 动画持续时间(ms)
 * @returns {Promise} 动画完成后resolve
 */
function runAnimation(animFn, duration = 300) {
  return new Promise((resolve) => {
    if (game.isAnimating) {
      console.warn('[Animation] 已有动画进行中，跳过');
      resolve(false);
      return;
    }

    startAnimation();

    const timeoutId = setTimeout(() => {
      endAnimation();
      // 从timeouts数组中移除
      const idx = game.timeouts.indexOf(timeoutId);
      if (idx > -1) game.timeouts.splice(idx, 1);
      resolve(true);
    }, duration);

    game.timeouts.push(timeoutId);

    // 执行动画函数
    if (typeof animFn === 'function') {
      animFn();
    }
  });
}

/**
 * 安全延迟执行 - 带动画锁
 * @param {Function} callback - 回调函数
 * @param {number} delay - 延迟时间(ms)
 * @returns {number} timeout ID
 */
function safeDelay(callback, delay = 300) {
  const timeoutId = setTimeout(() => {
    // 从timeouts数组中移除
    const idx = game.timeouts.indexOf(timeoutId);
    if (idx > -1) game.timeouts.splice(idx, 1);

    if (typeof callback === 'function') {
      callback();
    }
  }, delay);

  game.timeouts.push(timeoutId);
  return timeoutId;
}

/**
 * 清除所有待执行的timeout
 */
function clearAllTimeouts() {
  game.timeouts.forEach(id => clearTimeout(id));
  game.timeouts = [];

  // 同时清除passTimeout
  if (game.passTimeout) {
    clearTimeout(game.passTimeout);
    game.passTimeout = null;
  }
}

/**
 * 检查是否可以执行操作
 * @returns {boolean}
 */
function canExecuteAction() {
  if (game.isAnimating) {
    console.log('[Action] 动画进行中，操作被阻止');
    return false;
  }
  if (game.state === GameState.GAMEOVER) {
    console.log('[Action] 游戏已结束');
    return false;
  }
  return true;
}

// 麻将牌中文名
const TILE_CHINESE_NAMES = {
  wan1:'一万',wan2:'二万',wan3:'三万',wan4:'四万',wan5:'五万',wan6:'六万',wan7:'七万',wan8:'八万',wan9:'九万',
  sou1:'一索',sou2:'二索',sou3:'三索',sou4:'四索',sou5:'五索',sou6:'六索',sou7:'七索',sou8:'八索',sou9:'九索',
  pin1:'一筒',pin2:'二筒',pin3:'三筒',pin4:'四筒',pin5:'五筒',pin6:'六筒',pin7:'七筒',pin8:'八筒',pin9:'九筒',
  east:'东风', south:'南风', west:'西风', north:'北风',
  zhong:'红中', fa:'发财', bai:'白板'
};

// 语音播报牌名 - 根据打出牌的玩家使用不同声音
function speakTileName(tileType, playerIndex) {
  const name = TILE_CHINESE_NAMES[tileType] || tileType;
  if ('speechSynthesis' in window) {
    // 取消之前的语音
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(name);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    
    // 根据玩家选择声音
    const playerVoice = PLAYER_VOICES[playerIndex];
    if (playerVoice && playerVoice.voice) {
      utterance.voiceURI = playerVoice.voice;
    }
    if (playerVoice && playerVoice.pitch) {
      utterance.pitch = playerVoice.pitch;
    }
    
    speechSynthesis.speak(utterance);
  }
}

// 语音播报动作 - 根据玩家使用不同声音
function speakAction(actionName, playerIndex) {
  if ('speechSynthesis' in window) {
    // 取消之前的语音
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(actionName);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    
    // 根据玩家选择声音
    const playerVoice = PLAYER_VOICES[playerIndex];
    if (playerVoice && playerVoice.voice) {
      utterance.voiceURI = playerVoice.voice;
    }
    if (playerVoice && playerVoice.pitch) {
      utterance.pitch = playerVoice.pitch;
    }
    
    speechSynthesis.speak(utterance);
  }
}

// 记录日志到右侧滚动条
function logEvent(message, type = 'normal') {
  const logContent = document.getElementById('log-content');
  if (!logContent) return;

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = message;

  logContent.appendChild(entry);

  // 自动滚动到底部
  logContent.scrollTop = logContent.scrollHeight;

  // 限制显示条数
  while (logContent.children.length > 100) {
    logContent.removeChild(logContent.firstChild);
  }

  // 保存日志条目到游戏状态（用于刷新后恢复）
  if (!game.logEntries) game.logEntries = [];
  game.logEntries.push({ message, type });
  // 限制保存条数
  if (game.logEntries.length > 100) {
    game.logEntries.shift();
  }
}

// 亮牌显示（胡牌时）
function revealAllHands(winnerIndex, isZimo = false, isGangshanghua = false) {
  const revealArea = document.createElement('div');
  revealArea.className = 'reveal-area show';
  revealArea.id = 'reveal-area';

  const winner = game.players[winnerIndex];

  // 计算番数和番型
  const scoreResult = calcScore(winner.hand, winner.melds || [], isZimo, isGangshanghua);

  // 找出胡的那张牌（最后摸的或别人打的）
  let winningTile = null;
  if (!isZimo && game.lastDiscard) {
    winningTile = game.lastDiscard;
  } else if (winner.hand.length === 14) {
    // 自摸时，最后一张是新摸的牌
    winningTile = winner.hand[winner.hand.length - 1];
  }

  let html = `
    <div class="reveal-title">
      <span class="winner-icon">🎉</span>
      ${PLAYER_VOICES[winnerIndex].name} 胡牌！
      <span class="winner-icon">🎉</span>
    </div>
  `;

  // 显示番型和总番数
  if (scoreResult.fanTypes && scoreResult.fanTypes.length > 0) {
    html += `<div class="reveal-score">
      <div class="fan-types-list">`;
    scoreResult.fanTypes.forEach(fan => {
      html += `<span class="fan-badge">${fan.name} ${fan.score}番</span>`;
    });
    html += `</div>
      <div class="total-fans-display">
        <span class="total-label">总计</span>
        <span class="total-value">${scoreResult.fans}</span>
        <span class="total-unit">番</span>
      </div>
    </div>`;
  }

  // 显示胡牌类型
  html += `<div class="win-type-badge ${isZimo ? 'zimo' : 'dianpao'}">
    ${isZimo ? '自摸' : '点炮'}
    ${isGangshanghua ? ' · 杠上开花' : ''}
  </div>`;

  // 显示赢家手牌（高亮胡牌）
  html += `<div class="reveal-winner-section">
    <div class="reveal-player">
      <div class="reveal-player-name winner-name">
        <span class="winner-star">★</span>
        ${PLAYER_VOICES[winnerIndex].name}
        <span class="winner-star">★</span>
      </div>
      <div class="hand-section-label">手牌</div>
      <div class="reveal-hand winner-hand">`;

  // 排序手牌用于显示
  const sortedHand = [...winner.hand].sort((a, b) => a.type.localeCompare(b.type));
  sortedHand.forEach(tile => {
    const isWinning = winningTile && tile.type === winningTile.type;
    const highlightClass = isWinning ? 'winning-tile' : '';
    html += `<img class="tile-img ${highlightClass}" src="assets/tiles/${tile.type}.png" alt="${tile.type}">`;
  });

  html += `</div>`;

  // 显示副露
  if (winner.melds && winner.melds.length > 0) {
    html += `<div class="hand-section-label">副露</div>`;
    html += `<div class="reveal-melds">`;
    winner.melds.forEach(meld => {
      const meldTypeNames = { 'pong': '碰', 'kong': '杠', 'chow': '吃' };
      const meldTypeName = meldTypeNames[meld.type] || meld.type;
      html += `<div class="reveal-meld meld-${meld.type}">`;
      html += `<span class="meld-type-label">${meldTypeName}</span>`;
      meld.tiles.forEach(tile => {
        html += `<img class="tile-img meld-tile" src="assets/tiles/${tile.type}.png" alt="${tile.type}">`;
      });
      html += `</div>`;
    });
    html += `</div>`;
  }

  html += `</div></div>`;

  // 显示其他玩家手牌（折叠）
  html += `<div class="reveal-others-toggle">
    <button class="toggle-btn" onclick="toggleOthersHands()">查看其他玩家手牌 ▼</button>
  </div>`;
  html += `<div class="reveal-others" id="reveal-others" style="display:none;">`;

  game.players.forEach((player, idx) => {
    if (idx === winnerIndex) return;

    html += `<div class="reveal-player">
      <div class="reveal-player-name">${PLAYER_VOICES[idx].name}</div>
      <div class="hand-section-label">手牌</div>
      <div class="reveal-hand">`;

    const sortedOtherHand = [...player.hand].sort((a, b) => a.type.localeCompare(b.type));
    sortedOtherHand.forEach(tile => {
      html += `<img class="tile-img" src="assets/tiles/${tile.type}.png" alt="${tile.type}">`;
    });

    html += `</div>`;

    // 显示副露
    if (player.melds && player.melds.length > 0) {
      html += `<div class="hand-section-label">副露</div>`;
      html += `<div class="reveal-melds">`;
      player.melds.forEach(meld => {
        const meldTypeNames = { 'pong': '碰', 'kong': '杠', 'chow': '吃' };
        const meldTypeName = meldTypeNames[meld.type] || meld.type;
        html += `<div class="reveal-meld meld-${meld.type}">`;
        html += `<span class="meld-type-label">${meldTypeName}</span>`;
        meld.tiles.forEach(tile => {
          html += `<img class="tile-img meld-tile" src="assets/tiles/${tile.type}.png" alt="${tile.type}">`;
        });
        html += `</div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;
  });
  html += `</div>`;

  html += `<div class="reveal-actions">
    <button class="restart-btn" onclick="closeRevealAndRestart()">再来一局</button>
  </div>`;

  revealArea.innerHTML = html;
  document.body.appendChild(revealArea);

  // 隐藏原本的重新开始按钮
  elements.restartArea.style.display = 'none';
}

// 切换显示其他玩家手牌
function toggleOthersHands() {
  const others = document.getElementById('reveal-others');
  const btn = document.querySelector('.toggle-btn');
  if (others) {
    if (others.style.display === 'none') {
      others.style.display = 'block';
      btn.textContent = '收起其他玩家手牌 ▲';
    } else {
      others.style.display = 'none';
      btn.textContent = '查看其他玩家手牌 ▼';
    }
  }
}

function closeRevealAndRestart() {
  const revealArea = document.getElementById('reveal-area');
  if (revealArea) revealArea.remove();
  elements.restartArea.style.display = 'block';
  initGame();
}

// 检查是否能从碰加杠（明杠）
function canKongFromPong(player, tile) {
  if (!player.melds) return false;
  // 检查是否有该牌的碰
  return player.melds.some(meld => meld.type === 'pong' && meld.tiles[0].type === tile.type);
}

// 获取所有吃牌组合（完整实现）
function getChiCombinations(hand, tile) {
  const suit = tile.type.replace(/\d/g, '');
  const num = parseInt(tile.type.replace(/\D/g, ''));

  // 字牌不能吃
  if (!['wan', 'sou', 'pin'].includes(suit)) return [];

  const combinations = [];

  // 模式1: x-2, x-1, x (需要 x-2 和 x-1)
  if (num >= 3) {
    const need1 = `${suit}${num - 2}`;
    const need2 = `${suit}${num - 1}`;
    if (hand.some(t => t.type === need1) && hand.some(t => t.type === need2)) {
      combinations.push({
        tiles: [need1, need2],
        display: [need1, need2, tile.type].sort()
      });
    }
  }

  // 模式2: x-1, x, x+1 (需要 x-1 和 x+1)
  if (num >= 2 && num <= 8) {
    const need1 = `${suit}${num - 1}`;
    const need2 = `${suit}${num + 1}`;
    if (hand.some(t => t.type === need1) && hand.some(t => t.type === need2)) {
      combinations.push({
        tiles: [need1, need2],
        display: [need1, need2, tile.type].sort()
      });
    }
  }

  // 模式3: x, x+1, x+2 (需要 x+1 和 x+2)
  if (num <= 7) {
    const need1 = `${suit}${num + 1}`;
    const need2 = `${suit}${num + 2}`;
    if (hand.some(t => t.type === need1) && hand.some(t => t.type === need2)) {
      combinations.push({
        tiles: [need1, need2],
        display: [need1, need2, tile.type].sort()
      });
    }
  }

  return combinations;
}

// 吃牌选择UI（玩家有多组合时）
let chiSelectionPanel = null;

function showChiSelection(tile, combinations) {
  return new Promise(resolve => {
    // 移除已存在的面板
    if (chiSelectionPanel) {
      chiSelectionPanel.remove();
    }

    chiSelectionPanel = document.createElement('div');
    chiSelectionPanel.className = 'chi-selection-panel';
    chiSelectionPanel.innerHTML = '<h3>选择吃牌组合</h3>';

    combinations.forEach((combo, index) => {
      const option = document.createElement('div');
      option.className = 'chi-option';
      option.dataset.index = index;

      // 显示牌面
      combo.display.forEach(t => {
        const tileEl = document.createElement('img');
        tileEl.src = `assets/tiles/${t}.png`;
        tileEl.className = 'tile-img chi-tile';
        tileEl.alt = t;
        option.appendChild(tileEl);
      });

      option.addEventListener('click', () => {
        chiSelectionPanel.remove();
        chiSelectionPanel = null;
        resolve({ combination: combo, index });
      });

      chiSelectionPanel.appendChild(option);
    });

    // 过按钮
    const passBtn = document.createElement('button');
    passBtn.textContent = '过';
    passBtn.className = 'action-btn';
    passBtn.style.marginTop = '10px';
    passBtn.onclick = () => {
      chiSelectionPanel.remove();
      chiSelectionPanel = null;
      resolve(null);
    };
    chiSelectionPanel.appendChild(passBtn);

    document.body.appendChild(chiSelectionPanel);
  });
}

// DOM 元素
const elements = {
  playerHand: document.getElementById('player-hand'),
  playerMelds: document.getElementById('player-melds'),
  playerStatus: document.getElementById('player-status'),
  wallCount: document.getElementById('wall-count-header'),
  messageArea: document.getElementById('message-area'),
  restartArea: document.getElementById('restart-area'),
  // 4个玩家的元素
  players: {
    0: { hand: document.getElementById('player-hand'), melds: document.getElementById('player-melds'), tileCount: null },
    1: { hand: document.getElementById('ai1-hand'), melds: document.getElementById('ai1-melds'), tileCount: null },
    2: { hand: document.getElementById('ai2-hand'), melds: document.getElementById('ai2-melds'), tileCount: null },
    3: { hand: document.getElementById('ai3-hand'), melds: document.getElementById('ai3-melds'), tileCount: null }
  },
  actions: {
    chi: document.querySelector('[data-action="chi"]'),
    pong: document.querySelector('[data-action="pong"]'),
    kong: document.querySelector('[data-action="kong"]'),
    win: document.querySelector('[data-action="win"]'),
    pass: document.querySelector('[data-action="pass"]')
  }
};

// 初始化游戏
function initGame() {
  // 清除保存的游戏状态
  clearGameState();

  // 清空日志条目
  game.logEntries = [];

  // 隐藏重新开始按钮和亮牌区域
  elements.restartArea.style.display = 'none';
  const revealArea = document.getElementById('reveal-area');
  if (revealArea) revealArea.remove();

  // 清空日志
  const logContent = document.getElementById('log-content');
  if (logContent) logContent.innerHTML = '';

  // 清除所有副露区域的显示
  elements.playerMelds.innerHTML = '';
  for (let i = 1; i < 4; i++) {
    if (elements.players[i].melds) {
      elements.players[i].melds.innerHTML = '';
    }
  }

  showMessage('🀄 初始化游戏...');
  logEvent('🀄 游戏开始！');
  
  // 初始化牌堆
  const tiles = initTileSet();
  game.wall = shuffle(tiles);
  
  // 发牌
  const result = dealTiles(game.wall, 4);
  game.players = result.players;
  game.wall = result.remainingTiles;
  
  // 绑定 AI 方法（使用难度设置，传入游戏上下文）
  game.players.forEach((p, i) => {
    if (i > 0) {
      p.decide = function(tile) {
        const ai = new AIPlayer(this, game.aiDifficulty, game);
        return ai.decide(tile);
      };
      p.decideResponse = function(discardedTile) {
        const ai = new AIPlayer(this, game.aiDifficulty, game);
        return ai.decideResponse(discardedTile);
      };
      p.decideDiscardAfterAction = function() {
        const ai = new AIPlayer(this, game.aiDifficulty, game);
        return ai.decideDiscardAfterAction();
      };
    }
  });
  
  // 设定庄家
  game.currentPlayer = game.dealer;
  
  // 排序手牌
  game.players[0].hand.sort((a, b) => a.type.localeCompare(b.type));
  
  // 渲染
  renderGame();
  
  // 开始游戏
  startTurn();
}

// 开始回合
function startTurn() {
  // 状态锁检查
  if (game.isAnimating) {
    console.log('动画进行中，延迟开始回合');
    return;
  }

  const player = game.players[game.currentPlayer];
  const playerName = PLAYER_VOICES[game.currentPlayer].name;
// // console.log(, game.currentPlayer, playerName);

  // 高亮当前摸牌玩家
  highlightCurrentPlayer();
  
  if (game.currentPlayer === 0) {
    // 玩家回合
    game.state = GameState.DRAWING;

    // 玩家摸牌
    const tile = drawTile(player, game.wall);
    if (tile) {
      Sound.playDraw();
      // 新摸的牌暂不排序，显示在右侧
      // player.hand.sort((a, b) => a.type.localeCompare(b.type));
      logEvent(`<span class="log-player">你</span>摸牌`, 'draw');
      renderPlayerHand(tile.id);  // Pass new tile ID for animation

      // 检查能否自摸/暗杠/听牌
      checkPlayerActions();
    } else {
      logEvent('❌ 牌山已空，流局', 'win');
      game.state = GameState.GAMEOVER;
    }
  } else {
    // AI 回合
    game.state = GameState.DRAWING;
    safeDelay(() => aiTurn(), 500);
  }
}

// 玩家打牌
function playerDiscard(tileId) {
  // // // console.log(playerDiscard called, state:', game.state, 'currentPlayer:', game.currentPlayer, 'tileId:', tileId);

  // 状态锁检查
  if (!canExecuteAction()) {
    console.log('动画进行中或游戏已结束，请稍候');
    return;
  }

  // 玩家只能在自己的回合打牌
  if (game.currentPlayer !== 0) {
    // // // console.log(不是你的回合');
    return;
  }

  // 玩家回合中才能打牌 (允许 DRAWING, DISCARDING, RESPONDING 状态)
  const allowedStates = [GameState.DRAWING, GameState.DISCARDING, GameState.RESPONDING];
  if (!allowedStates.includes(game.state)) {
    // // // console.log(警告: 状态不理想但仍允许打牌', game.state);
  }

  const player = game.players[0];
  // // // console.log(手牌数:', player.hand.length, '尝试打:', tileId);

  // 找到要打的牌
  const tileIndex = player.hand.findIndex(t => t.id === tileId);
  if (tileIndex === -1) {
    // // // console.log(错误: 找不到这张牌', tileId);
    // // // console.log(手牌IDs:', player.hand.map(t => t.id));
    return;
  }

  const tile = discardTile(player, tileId);
  // // // console.log(discardTile result:', tile);

  if (tile) {
    // 设置动画锁，防止连续点击
    startAnimation();

    Sound.playDiscard();
    // 语音播报牌名，使用玩家0的声音
    speakTileName(tile.type, 0);
    game.lastDiscard = tile;
    game.lastDrawer = game.currentPlayer;  // 记录打牌者
    game.state = GameState.DISCARDING;

    // 记录到日志
    logEvent(`<span class="log-player">你</span>打出了 <span class="log-tile">${tile.name || tile.type}</span>`, 'discard');

    // 排序手牌（打出后重新排序）
    player.hand.sort((a, b) => a.type.localeCompare(b.type));

    // 渲染
    renderPlayerHand();
    renderPool();
    updateWall();

    // 保存游戏状态
    saveGameState();

    // 高亮当前响应玩家（打出牌后等待响应时不高亮任何人的回合）
    // 牌打出后，检查其他玩家是否要响应
    checkAIResponse();
  } else {
    // // // console.log(打牌失败');
  }
}

// 检查抢杠胡 - 在杠后摸牌时检查其他玩家是否可以胡
function checkRobKongHu(kongPlayer, kongTile, kongPlayerIndex) {
  // 检查除杠者外的其他玩家
  for (let i = 0; i < 4; i++) {
    if (i === kongPlayerIndex) continue;

    const player = game.players[i];
    const playerName = PLAYER_VOICES[i].name;

    // 手中加上一张杠的牌，看能否胡
    const testHand = [...player.hand, kongTile];
    if (canWin(testHand, player.melds)) {
      logEvent(`🎉 <span class="log-player">${playerName}</span>抢杠胡！`, 'win');
      game.state = GameState.GAMEOVER;
      revealAllHands(i, false, false);
      return true;
    }
  }
  return false;
}

// 检查 AI 是否要响应 (优先级: 胡 > 杠 > 碰 > 吃)
function checkAIResponse() {
  const lastTile = game.lastDiscard;
  if (!lastTile) {
    nextPlayer();
    return;
  }

  // 重置 lastAction
  game.lastAction = null;

  const lastTileName = lastTile.name || lastTile.type;

  // 获取打牌者（使用 lastDrawer 记录的打牌者）
  const discardPlayer = game.lastDrawer !== undefined ? game.lastDrawer : game.currentPlayer;

  // 读取超时设置
  const timeoutInput = document.getElementById('timeout-setting');
  const timeoutMs = (parseInt(timeoutInput?.value) || 10) * 1000;

  // 按顺时针顺序检查（从打牌者的下家开始）
  // 游戏中玩家顺序（逆时针）：南家(0) → 东家(1) → 北家(2) → 西家(3)
  // 顺时针顺序：南家(0) → 西家(3) → 北家(2) → 东家(1)
  // 下家 = (打牌者 + 1) % 4
  const checkOrder = [
    (discardPlayer + 1) % 4,  // 下家
    (discardPlayer + 2) % 4,  // 对家
    (discardPlayer + 3) % 4   // 上家
  ];

  // 按顺时针顺序检查谁能胡牌
  for (const playerIndex of checkOrder) {
    const player = game.players[playerIndex];
    const testHand = [...player.hand, lastTile];

    if (canWin(testHand, player.melds)) {
      // 这个玩家可以胡牌
      if (playerIndex === 0) {
        // 玩家可以胡，给玩家选择权
        checkPlayerResponse();
        return;
      } else {
        // AI 胡牌
        const playerName = PLAYER_VOICES[playerIndex].name;
        safeDelay(() => {
          endAnimation();
          clearAllTimeouts();
          logEvent(`🎉 <span class="log-player">${playerName}</span>胡牌！`, 'win');
          game.state = GameState.GAMEOVER;
          revealAllHands(playerIndex, false, false);
        }, 300);
        return;
      }
    }
  }

  // 没有人胡牌，继续检查其他响应（杠/碰/吃）
  // 从下家开始检查
  for (const playerIndex of checkOrder) {
    // 跳过玩家（玩家在 checkPlayerResponse 中处理）
    if (playerIndex === 0) {
      continue;
    }

    const ai = game.players[playerIndex];
    const playerName = PLAYER_VOICES[playerIndex].name;

    // 获取所有可能的响应，按优先级排序
    const responses = [];

    // 检查明杠（手牌有3张 + 别人打出1张）
    // 注意：从碰加杠只能在自己摸牌时进行，不能杠别人打出的牌
    if (canKong(ai.hand, lastTile, false)) {
      responses.push({ type: 'kong', priority: 3 });
    }

    // 检查碰
    if (canPong(ai.hand, lastTile)) {
      responses.push({ type: 'pong', priority: 2 });
    }

    // 检查吃 (上家才能吃) - 上家是 (打牌者 + 3) % 4
    const upperPlayer = (discardPlayer + 3) % 4;
    if (playerIndex === upperPlayer && canChow(ai.hand, lastTile)) {
      responses.push({ type: 'chow', priority: 1 });
    }

    // 按优先级排序，取最高优先级
    if (responses.length > 0) {
      responses.sort((a, b) => b.priority - a.priority);
      const bestResponse = responses[0];

      // 延迟响应，让玩家看到提示
      safeDelay(() => {
        // 释放动画锁
        endAnimation();

        // 高亮正在响应的玩家
        game.currentPlayer = playerIndex;
        highlightCurrentPlayer();

        switch (bestResponse.type) {
          case 'kong':
            logEvent(`<span class="log-player">${playerName}</span>杠了 <span class="log-tile">${lastTileName}</span>（要${lastTileName}）`, 'kong');
            // 语音播报动作"杠"
            speakAction('杠', playerIndex);
            handleAIKong(ai, lastTile, discardPlayer);
            renderPool();
            renderAIMelds();
            renderAIBacks();
            updateWall();
            // 标记刚刚进行了杠，用于检测抢杠胡
            game.lastAction = 'kong';
            // 杠后立即摸牌，不使用玩家的超时设置
            safeDelay(() => {
              game.currentPlayer = playerIndex;
              const drawn = drawTile(ai, game.wall);
              if (drawn) {
                // 杠后摸牌，检查是否有人胡（抢杠胡）
                game.state = GameState.RESPONDING;
                safeDelay(() => {
                  // 检查其他玩家是否可以抢杠胡
                  if (!checkRobKongHu(ai, lastTile, playerIndex)) {
                    // 没人抢杠胡，继续杠者的回合
                    renderPool();
                    updateWall();
                    safeDelay(() => aiTurn(), 300);
                  }
                }, 300);
              } else {
                logEvent('❌ 牌山已空，流局', 'win');
                game.state = GameState.GAMEOVER;
              }
            }, 300);
            return;

          case 'pong':
            logEvent(`<span class="log-player">${playerName}</span>碰了 <span class="log-tile">${lastTileName}</span>`, 'pong');
            // 语音播报动作"碰"
            speakAction('碰', playerIndex);
            handleAIPong(ai, lastTile, discardPlayer);
            renderPool();
            renderAIMelds();
            renderAIBacks();
            updateWall();
            // 碰后立即打一张，不摸牌
            safeDelay(() => {
              game.currentPlayer = playerIndex;
              aiDiscardAfterAction();
            }, 300);
            return;

          case 'chow':
            logEvent(`<span class="log-player">${playerName}</span>吃了 <span class="log-tile">${lastTileName}</span>（要${lastTileName}）`, 'chow');
            // 语音播报动作"吃"
            speakAction('吃', playerIndex);
            handleAIChow(ai, lastTile, discardPlayer);
            renderPool();
            renderAIMelds();
            renderAIBacks();
            updateWall();
            // 吃后立即打一张，不摸牌（不使用超时）
            safeDelay(() => {
              game.currentPlayer = playerIndex;
              aiDiscardAfterAction();
            }, 300);
            return;
        }
      }, 300);  // 短暂延迟让玩家看到提示

      return;
    }
  }

  // AI 没有响应，检查玩家是否可以响应
  checkPlayerResponse();
}

// AI 执行碰
function handleAIPong(ai, tile, fromPlayerIndex) {
  const indices = [];
  ai.hand.forEach((t, i) => {
    if (t.type === tile.type && indices.length < 2) indices.push(i);
  });
  if (indices.length >= 2) {
    indices.sort((a, b) => b - a).forEach(i => ai.hand.splice(i, 1));
    ai.melds = ai.melds || [];
    ai.melds.push({
      type: 'pong',
      tiles: [{type:tile.type}, {type:tile.type}, tile]
    });
    // 从打出这张牌的玩家的牌池中移除
    if (fromPlayerIndex !== undefined) {
      const fromPlayer = game.players[fromPlayerIndex];
      if (fromPlayer && fromPlayer.pool.length > 0) {
        fromPlayer.pool.pop();
      }
    }
    // 清除 lastDiscard
    game.lastDiscard = null;
  }
}

// AI 执行明杠（别人打出的牌 + 手牌3张）
// 注意：从碰加杠只能在摸牌时进行，不在这里处理
function handleAIKong(ai, tile, fromPlayerIndex) {
  // 普通明杠：手牌有3张 + 打出的1张
  const indices = [];
  ai.hand.forEach((t, i) => {
    if (t.type === tile.type && indices.length < 3) indices.push(i);
  });
  if (indices.length >= 3) {
    indices.sort((a, b) => b - a).forEach(i => ai.hand.splice(i, 1));
    ai.melds = ai.melds || [];
    ai.melds.push({
      type: 'kong',
      tiles: [{type:tile.type}, {type:tile.type}, {type:tile.type}, tile],
      concealed: false  // 明杠
    });
    // 从打出这张牌的玩家的牌池中移除
    if (fromPlayerIndex !== undefined) {
      const fromPlayer = game.players[fromPlayerIndex];
      if (fromPlayer && fromPlayer.pool.length > 0) {
        fromPlayer.pool.pop();
      }
    }
    // 清除 lastDiscard
    game.lastDiscard = null;
  }
}

// AI 执行吃
function handleAIChow(ai, tile, fromPlayerIndex) {
  const suit = tile.type.replace(/\d/g, '');
  const num = parseInt(tile.type.replace(/\D/g, ''));

  // 检查所有可能的顺子组合，与 canChow 保持一致
  const possibleCombinations = [
    [num - 2, num - 1],  // 打出的牌作为第三张
    [num - 1, num + 1],  // 打出的牌作为中间
    [num + 1, num + 2]   // 打出的牌作为第一张
  ];

  // 找到第一个可行的组合
  let foundCombination = null;
  for (const [n1, n2] of possibleCombinations) {
    if (n1 < 1 || n2 > 9) continue;
    const needed = [`${suit}${n1}`, `${suit}${n2}`];
    const hasAll = needed.every(need => ai.hand.some(t => t.type === need));
    if (hasAll) {
      foundCombination = needed;
      break;
    }
  }

  if (foundCombination) {
    const indices = [];
    foundCombination.forEach(need => {
      const idx = ai.hand.findIndex(t => t.type === need);
      if (idx !== -1) indices.push({ idx, type: need });
    });

    if (indices.length === 2) {
      indices.sort((a, b) => b.idx - a.idx).forEach(item => ai.hand.splice(item.idx, 1));
      ai.melds = ai.melds || [];
      ai.melds.push({
        type: 'chow',
        tiles: [
          { type: foundCombination[0] },
          tile,
          { type: foundCombination[1] }
        ].sort((a, b) => a.type.localeCompare(b.type))
      });
      // 从打出这张牌的玩家的牌池中移除
      if (fromPlayerIndex !== undefined) {
        const fromPlayer = game.players[fromPlayerIndex];
        if (fromPlayer && fromPlayer.pool.length > 0) {
          fromPlayer.pool.pop();
        }
      }
      // 清除 lastDiscard
      game.lastDiscard = null;
    }
  }
}

// 检查玩家可行动作
function checkPlayerActions() {
  const player = game.players[0];
  const lastTile = game.lastDiscard;

  // 重置按钮
  elements.actions.chi.disabled = true;
  elements.actions.pong.disabled = true;
  elements.actions.kong.disabled = true;
  elements.actions.win.disabled = true;
  elements.actions.pass.disabled = true; // 摸牌后没有跳过选项

  // 检查胡 (自摸)
  const testHand = [...player.hand];
  if (canWin(testHand, player.melds)) {
    elements.actions.win.disabled = false;
    logEvent('🔔 <span class="log-player">你</span>可以自摸！', 'win');
  }

  // 检查暗杠
  const concealedKongTile = player.hand.find(t => {
    const count = player.hand.filter(x => x.type === t.type).length;
    return count === 4;
  });
  if (concealedKongTile) {
    elements.actions.kong.disabled = false;
    logEvent('🔔 <span class="log-player">你</span>可以暗杠！', 'kong');
    // 记录可以暗杠的牌，供 handlePlayerAction 使用
    game.concealedKongTile = concealedKongTile;
  }

  // 检查加杠（从碰加杠）- 手牌中某张牌和已有的碰组成杠
  // 摸牌后手牌有14张，检查每张牌是否可以加杠
  if (player.melds) {
    for (const tile of player.hand) {
      const hasPongWithTile = player.melds.some(m =>
        m.type === 'pong' && m.tiles[0].type === tile.type
      );
      if (hasPongWithTile) {
        elements.actions.kong.disabled = false;
        logEvent(`🔔 <span class="log-player">你</span>可以杠 ${tile.name || tile.type}！（从碰加杠）`, 'kong');
        // 记录可以加杠的牌，供 handlePlayerAction 使用
        game.kongTile = tile;
        break;
      }
    }
  }
  
  // 听牌检测
  if (player.hand.length === 13) {
    const tenpaiTiles = checkTenpai(player.hand);
    if (tenpaiTiles.length > 0) {
      logEvent(`🎯 <span class="log-player">你</span>听牌了！`, 'draw');
    }
  }
  
  // 摸牌后没有跳过选项，必须打一张牌
}

// AI 回合
function aiTurn() {
  const ai = game.players[game.currentPlayer];
  const playerName = PLAYER_VOICES[game.currentPlayer].name;

  // AI 摸牌
  const tile = drawTile(ai, game.wall);
  if (!tile) {
    logEvent('❌ 牌山已空，流局', 'win');
    game.state = GameState.GAMEOVER;
    return;
  }

  // 记录摸牌
  logEvent(`<span class="log-player">${playerName}</span>摸牌`, 'draw');

  // 听牌检测（摸牌后如果手牌是13张）
  if (ai.hand.length === 13) {
    const tenpaiTiles = checkTenpai(ai.hand);
    if (tenpaiTiles.length > 0) {
      logEvent(`🎯 <span class="log-player">${playerName}</span>听牌了！`, 'draw');
    }
  }

  // AI 决策
  const action = ai.decide(tile);

  switch (action.type) {
    case 'win':
      // 清除超时计时器
      clearAllTimeouts();
      logEvent(`🎉 <span class="log-player">${playerName}</span>自摸胡牌！`, 'win');
      game.state = GameState.GAMEOVER;
      revealAllHands(game.currentPlayer, true, false);
      return;

    case 'kong':
      // 处理杠（暗杠或从碰加杠）
      if (action.kongType === 'fromPong') {
        // 从碰加杠
        logEvent(`<span class="log-player">${playerName}</span>杠了 <span class="log-tile">${tile.name || tile.type}</span>（从碰加杠）`, 'kong');
        speakAction('杠', game.currentPlayer);
        // 找到对应的碰并升级为杠
        const meldIndex = ai.melds.findIndex(m => m.type === 'pong' && m.tiles[0].type === tile.type);
        if (meldIndex !== -1) {
          const oldPong = ai.melds[meldIndex];
          ai.melds.splice(meldIndex, 1);
          ai.melds.push({
            type: 'kong',
            tiles: [...oldPong.tiles, tile],
            concealed: false  // 从碰加杠是明杠
          });
          // 从手牌移除
          const handIdx = ai.hand.findIndex(t => t.id === tile.id);
          if (handIdx !== -1) ai.hand.splice(handIdx, 1);
        }
      } else {
        // 暗杠
        logEvent(`<span class="log-player">${playerName}</span>暗杠`, 'kong');
        speakAction('杠', game.currentPlayer);
        // 从手牌移除4张
        const indices = [];
        ai.hand.forEach((t, i) => {
          if (t.type === tile.type && indices.length < 4) indices.push(i);
        });
        indices.sort((a, b) => b - a).forEach(i => ai.hand.splice(i, 1));
        ai.melds = ai.melds || [];
        ai.melds.push({
          type: 'kong',
          tiles: [{ type: tile.type }, { type: tile.type }, { type: tile.type }, { type: tile.type }],
          concealed: true  // 暗杠
        });
      }

      // 杠后摸牌继续
      renderAIMelds();
      renderAIBacks();
      updateWall();
      game.lastAction = 'kong';

      // 杠后摸一张牌，继续该玩家的回合
      safeDelay(() => {
        const drawnTile = drawTile(ai, game.wall);
        if (drawnTile) {
          logEvent(`<span class="log-player">${playerName}</span>摸牌`, 'draw');
          // 检查是否有人可以抢杠胡
          game.state = GameState.RESPONDING;
          safeDelay(() => {
            if (!checkRobKongHu(ai, tile, game.currentPlayer)) {
              // 继续该玩家的回合
              const nextAction = ai.decide(drawnTile);
              if (nextAction.type === 'win') {
                clearAllTimeouts();
                logEvent(`🎉 <span class="log-player">${playerName}</span>自摸胡牌！`, 'win');
                game.state = GameState.GAMEOVER;
                revealAllHands(game.currentPlayer, true, false);
              } else if (nextAction.type === 'discard') {
                discardTile(ai, nextAction.tileId);
                game.lastDiscard = ai.pool[ai.pool.length - 1];
                game.lastDrawer = game.currentPlayer;
                if (game.lastDiscard) {
                  speakTileName(game.lastDiscard.type, game.currentPlayer);
                  logEvent(`<span class="log-player">${playerName}</span>打出了 <span class="log-tile">${game.lastDiscard.name || game.lastDiscard.type}</span>`, 'discard');
                }
                renderPool();
                renderAIBacks();
                updateWall();
                game.state = GameState.RESPONDING;
                checkAIResponse();
              }
            }
          }, 300);
        } else {
          logEvent('❌ 牌山已空，流局', 'win');
          game.state = GameState.GAMEOVER;
        }
      }, 300);
      return;

    case 'pong':
      logEvent(`<span class="log-player">${playerName}</span>碰了`, 'pong');
      // 处理碰
      break;

    case 'discard':
      discardTile(ai, action.tileId);
      game.lastDiscard = ai.pool[ai.pool.length - 1];
      game.lastDrawer = game.currentPlayer;  // 记录打牌者
      // console.log([aiTurn] AI打牌:', game.lastDiscard, '当前玩家:', game.currentPlayer);
      // AI 打牌时语音播报
      if (game.lastDiscard) {
        speakTileName(game.lastDiscard.type, game.currentPlayer);
        logEvent(`<span class="log-player">${playerName}</span>打出了 <span class="log-tile">${game.lastDiscard.name || game.lastDiscard.type}</span>`, 'discard');
      }
      break;
  }

  renderPool();
  renderAIBacks();
  updateWall();

  // 保存游戏状态
  saveGameState();

  // AI 打牌后，检查其他玩家是否要响应（包括其他 AI 和玩家）
  game.state = GameState.RESPONDING;
  checkAIResponse();
}

// AI 在碰/吃后直接打牌（不摸牌）
function aiDiscardAfterAction() {
  const ai = game.players[game.currentPlayer];
  const playerName = PLAYER_VOICES[game.currentPlayer].name;

  // 直接选择一张牌打出（不摸牌）
  const action = ai.decideDiscardAfterAction();

  if (action && action.type === 'discard') {
    discardTile(ai, action.tileId);
    game.lastDiscard = ai.pool[ai.pool.length - 1];
    game.lastDrawer = game.currentPlayer;  // 记录打牌者
    // AI 打牌时语音播报
    if (game.lastDiscard) {
      speakTileName(game.lastDiscard.type, game.currentPlayer);
      logEvent(`<span class="log-player">${playerName}</span>打出了 <span class="log-tile">${game.lastDiscard.name || game.lastDiscard.type}</span>`, 'discard');
    }
  }

  renderPool();
  renderAIBacks();
  updateWall();

  // 保存游戏状态
  saveGameState();

  // AI 打牌后，检查其他玩家是否要响应（包括其他 AI 和玩家）
  game.state = GameState.RESPONDING;
  checkAIResponse();
}

// 检查玩家是否要响应 (碰/杠/胡)
function checkPlayerResponse() {
  // 清除之前的超时，避免干扰
  if (game.passTimeout) {
    clearTimeout(game.passTimeout);
    game.passTimeout = null;
  }

  const player = game.players[0];
  const lastTile = game.lastDiscard;
  const lastTileName = lastTile ? (lastTile.name || lastTile.type) : '';
  // 保存当前打牌者（西家/北家/东家打出牌后，检查玩家是否要响应）
  // 使用 lastDrawer 而不是 currentPlayer，因为 currentPlayer 可能已被 AI 响应修改
  const currentDrawer = game.lastDrawer !== undefined ? game.lastDrawer : game.currentPlayer;
  const discardPlayerName = PLAYER_VOICES[currentDrawer].name;
  console.log('[checkPlayerResponse] 当前打牌者:', currentDrawer, discardPlayerName, '打出的牌:', lastTileName);

  // 不能响应自己打出的牌
  if (currentDrawer === 0) {
    console.log('[checkPlayerResponse] 玩家打出的牌，玩家不能响应');
    endAnimation();
    const nextPlayerIndex = (currentDrawer + 3) % 4;
    game.currentPlayer = nextPlayerIndex;
    game.lastDiscard = null;
    safeDelay(() => startTurn(), 300);
    return;
  }
  console.log('[checkPlayerResponse] 玩家手牌数:', player.hand.length, '手牌:', player.hand.map(t => t.type));
  console.log('[checkPlayerResponse] 玩家副露:', player.melds ? player.melds.map(m => `${m.type}: ${m.tiles.map(t => t.type).join(',')}`) : '无');

  if (!lastTile) {
    console.log('[checkPlayerResponse] 无lastTile，调用nextPlayer');
    nextPlayer(currentDrawer);
    return;
  }

  // 高亮当前响应玩家（你）- 传入参数0，不改变游戏状态
  highlightCurrentPlayer(0);

  // 重置按钮
  elements.actions.chi.disabled = true;
  elements.actions.pong.disabled = true;
  elements.actions.kong.disabled = true;
  elements.actions.win.disabled = true;
  elements.actions.pass.disabled = true;

  // 检查胡 (抢杠胡/点炮) - 最高优先级
  const isFromKong = game.lastAction === 'kong';

  // 手牌 + 打出的牌
  const testHand = [...player.hand, lastTile];

  // 副露
  const melds = player.melds || [];

  console.log('[checkPlayerResponse] 手牌+新牌:', testHand.length, '副露:', melds.length);

  // 判断胡牌（副露已经固定，只判断手牌+新牌能否组成面子+对子）
  const canWinResult = canWin(testHand, melds);

  console.log('[checkPlayerResponse] 测试手牌:', testHand.map(t => t.type), '测试胡牌...');
  console.log('[checkPlayerResponse] canWin 结果:', canWinResult);

  if (canWinResult) {
    elements.actions.win.disabled = false;
    if (isFromKong) {
      logEvent(`🔔 <span class="log-player">你</span>可以抢杠胡 ${lastTileName}！`, 'win');
    } else {
      logEvent(`🔔 <span class="log-player">你</span>可以胡 ${lastTileName}！`, 'win');
    }
  }

  // 听牌检测（13张手牌时）
  if (player.hand.length === 13) {
    const tenpaiTiles = checkTenpai(player.hand);
    if (tenpaiTiles.length > 0) {
      logEvent(`🎯 <span class="log-player">你</span>听牌了！`, 'draw');
    }
  }

  // 检查碰 - 第二优先级
  if (canPong(player.hand, lastTile)) {
    elements.actions.pong.disabled = false;
    logEvent(`🔔 <span class="log-player">你</span>可以碰 ${lastTileName}！`, 'pong');
  }

  // 检查杠 (明杠) - 第三优先级
  // 玩家摸牌后可以杠（从碰加杠或直接明杠），但响应别人打出的牌时不能从明牌加杠
  // game.state === GameState.DRAWING 表示刚摸牌，game.state === GameState.RESPONDING 表示响应别人
  const isRespondingToDiscard = game.state === GameState.RESPONDING;
  if (!isRespondingToDiscard && canKongFromPong(player, lastTile)) {
    // 摸牌后可以从碰加杠
    elements.actions.kong.disabled = false;
    logEvent(`🔔 <span class="log-player">你</span>可以杠 ${lastTileName}！（从碰加杠）`, 'kong');
  } else if (canKong(player.hand, lastTile, false)) {
    elements.actions.kong.disabled = false;
    logEvent(`🔔 <span class="log-player">你</span>可以杠 ${lastTileName}！`, 'kong');
  }

  // 检查吃 (只有打牌者的下家才能吃) - 最低优先级
  // 逆时针顺序：南家(0) → 西家(3) → 北家(2) → 东家(1) → 南家(0)
  // 打牌者的下家 = (currentDrawer + 3) % 4
  // 玩家(0)能吃，当且仅当玩家是打牌者的下家
  const nextPlayer = (currentDrawer + 3) % 4;
  if (nextPlayer === 0 && canChow(player.hand, lastTile)) {
    elements.actions.chi.disabled = false;
    logEvent(`🔔 <span class="log-player">你</span>可以吃 <span class="log-tile">${lastTileName}</span>！`, 'chow');
  }

  // 如果有操作选项，启用跳过按钮
  if (!elements.actions.chi.disabled || !elements.actions.pong.disabled ||
      !elements.actions.kong.disabled || !elements.actions.win.disabled) {
    elements.actions.pass.disabled = false;
  }

  // 读取超时设置
  const timeoutInput = document.getElementById('timeout-setting');
  const timeoutMs = (parseInt(timeoutInput?.value) || 10) * 1000;
  console.log('[checkPlayerResponse] 超时设置:', timeoutMs / 1000, '秒');

  // 超时后自动跳过
  game.passTimeout = safeDelay(() => {
    console.log('[checkPlayerResponse] 超时触发，自动跳过');
    if (elements.actions.pass && !elements.actions.pass.disabled) {
      handlePlayerAction('pass');
    }
  }, timeoutMs);

  // 如果没有可选操作，自动继续（从当前打牌者的下家开始）
  // console.log([checkPlayerResponse] 按钮状态 - chi:', elements.actions.chi.disabled, 'pong:', elements.actions.pong.disabled, 'kong:', elements.actions.kong.disabled, 'win:', elements.actions.win.disabled);
  if (elements.actions.chi.disabled &&
      elements.actions.pong.disabled &&
      elements.actions.kong.disabled &&
      elements.actions.win.disabled) {
    // console.log([checkPlayerResponse] 无操作，跳过');
    // 释放动画锁
    endAnimation();
    // 无操作时，去打牌者的下家（逆时针）
    // 如果是AI打牌，玩家不响应，去北家
    // 如果是玩家打牌，玩家不响应，去西家
    const discardPlayer = game.lastDrawer !== undefined ? game.lastDrawer : currentDrawer;
    const nextPlayerIndex = (discardPlayer + 3) % 4;
    game.currentPlayer = nextPlayerIndex;
    game.lastDiscard = null;
    safeDelay(() => startTurn(), 300);
  } else {
    // console.log([checkPlayerResponse] 有操作，等待玩家点击');
  }
}

// 下一家
// 可选参数：fromPlayer - 从哪个玩家开始计算下一个（用于从checkPlayerResponse返回时正确轮转）
function nextPlayer(fromPlayer) {
  // 如果传入了fromPlayer，使用它作为当前玩家
  if (fromPlayer !== undefined) {
    game.currentPlayer = fromPlayer;
  }
  // 逆时针顺序：南家(0) -> 西家(3) -> 北家(2) -> 东家(1) -> 南家(0)
  game.currentPlayer = (game.currentPlayer + 3) % 4;

  // 高亮当前玩家
  highlightCurrentPlayer();

  // 检查流局 - 牌山已空
  if (game.wall.length === 0) {
    logEvent('❌ 牌山已空，流局', 'win');
    game.state = GameState.GAMEOVER;
    return;
  }

  safeDelay(() => startTurn(), 300);
}

// 渲染玩家手牌
function renderPlayerHand(newTileId = null) {
  const hand = game.players[0].hand;
  // // // console.log(renderPlayerHand called, hand length:', hand.length);

  // 直接用 onclick 绑定，不用 addEventListener
  elements.playerHand.innerHTML = hand.map((tile, index) => {
    const isNew = tile.id === newTileId ? 'tile-draw-animation' : '';
    return `<img class="tile-img ${isNew}" data-id="${tile.id}" src="assets/tiles/${tile.type}.png" alt="${tile.type}" onclick="handleTileClick('${tile.id}')">`;
  }).join('');
}

function handleTileClick(tileId) {
  // // // console.log(handleTileClick called:', tileId);
  // 选中效果
  elements.playerHand.querySelectorAll('.tile-img').forEach(t => t.classList.remove('selected'));
  const clicked = elements.playerHand.querySelector(`[data-id="${tileId}"]`);
  if (clicked) clicked.classList.add('selected');
  
  // 显示手牌数量用于调试
  const player = game.players[0];
  // // // console.log(Before discard: hand has', player.hand.length, 'tiles');
  
  // 执行打牌
  playerDiscard(tileId);
}

// 创建牌的 HTML (使用 PNG 图片)
function createTileHTML(tile, isBack = false) {
  const type = isBack ? 'back' : tile.type;
  const id = tile.id || `${tile.type}_${Math.random().toString(36).substr(2, 5)}`;
  return `<img class="tile-img" data-id="${id}" src="assets/tiles/${type}.png" alt="${tile.type}">`;
}

// 创建 AI 牌背 HTML
function createBackHTML() {
  return `<img class="tile-back-small" src="assets/tiles/back.png">`;
}

// 渲染池 - 所有弃牌显示在中央
function renderPool() {
  const poolCenter = document.getElementById('pool-center');
  if (!poolCenter) return;

  // 收集所有玩家的弃牌，按玩家分组显示
  let html = '';
  for (let i = 0; i < 4; i++) {
    const player = game.players[i];
    if (player.pool && player.pool.length > 0) {
      html += `<div class="pool-row pool-player-${i}">`;
      html += player.pool.map(tile => createTileHTML(tile)).join('');
      html += '</div>';
    }
  }
  poolCenter.innerHTML = html;
}

// 更新所有玩家手牌数
function updateAllPlayerStatus() {
  for (let i = 0; i < 4; i++) {
    const el = elements.players[i].tileCount;
    if (el) {
      el.textContent = game.players[i].hand.length;
    }
  }
}

// 高亮当前玩家（仅在摸牌阶段）
// 可选参数：highlightPlayer - 指定要高亮的玩家，默认为 game.currentPlayer
// 注意：HTML中player-area的顺序是：北家(0), 西家(1), 东家(2), 南家(3)
// 游戏中的索引是：南家(0), 东家(1), 北家(2), 西家(3)
function highlightCurrentPlayer(highlightPlayer) {
  const target = highlightPlayer !== undefined ? highlightPlayer : game.currentPlayer;
  // 将游戏索引转换为HTML DOM索引
  // 游戏: 南家(0), 东家(1), 北家(2), 西家(3)
  // DOM:  北家(0), 西家(1), 东家(2), 南家(3)
  const domIndex = [3, 2, 0, 1][target];  // 0->3, 1->2, 2->0, 3->1
  document.querySelectorAll('.player-area').forEach((el, idx) => {
    el.classList.toggle('active', idx === domIndex);
  });
}

// 更新牌山显示
function updateWall() {
  if (elements.wallCount) {
    elements.wallCount.textContent = `${game.wall.length} 张`;
  }
  updateAllPlayerStatus();
}

// 渲染副露
function renderMelds(newMeldType = null) {
  const player = game.players[0];

  if (!player.melds || player.melds.length === 0) {
    elements.playerMelds.innerHTML = '';
    return;
  }

  elements.playerMelds.innerHTML = player.melds.map((meld, index) => {
    // 暗杠显示背面，其他显示正面
    let tiles;
    if (meld.type === 'kong' && meld.concealed) {
      // 暗杠：显示4张背面
      tiles = meld.tiles.map(() => createBackHTML()).join('');
    } else {
      // 明杠/碰/吃：显示正面
      tiles = meld.tiles.map(tile => createTileHTML(tile)).join('');
    }
    const isNewest = (newMeldType && index === player.melds.length - 1) ? `new-meld meld-${newMeldType}-animation` : '';
    return `<div class="meld horizontal ${isNewest}">${tiles}</div>`;
  }).join('');
}

// 渲染 AI 副露
function renderAIMelds() {
  for (let i = 1; i < 4; i++) {
    const el = elements.players[i].melds;
    if (!el) continue;

    const player = game.players[i];
    if (!player.melds || player.melds.length === 0) {
      el.innerHTML = '';
      continue;
    }

    // 东西家（i=1 东家, i=3 西家）使用竖向排列，北家（i=2）使用横向排列
    const isVertical = (i === 1 || i === 3);

    el.innerHTML = player.melds.map(meld => {
      // 暗杠显示背面，其他显示正面
      let tiles;
      if (meld.type === 'kong' && meld.concealed) {
        // 暗杠：显示4张背面
        tiles = meld.tiles.map(() => createBackHTML()).join('');
      } else {
        // 明杠/碰/吃：显示正面
        tiles = meld.tiles.map(tile => `<img class="tile-back-small" src="assets/tiles/${tile.type}.png">`).join('');
      }
      // 东西家用 vertical，北家用 horizontal
      return `<div class="meld ${isVertical ? 'vertical' : 'horizontal'}">${tiles}</div>`;
    }).join('');
  }
}

// 显示消息
function showMessage(msg) {
  elements.messageArea.textContent = msg;
}

// 渲染整个游戏
function renderGame() {
  renderPlayerHand();
  renderPool();
  renderAIBacks();
  renderMelds();
  renderAIMelds();
  updateWall();
  // 保存游戏状态
  saveGameState();
}

// 渲染 AI 手牌背面
function renderAIBacks() {
  for (let i = 1; i < 4; i++) {
    const el = elements.players[i].hand;
    if (!el) continue;
    
    const count = game.players[i].hand.length;
    // 渲染牌背
    let html = '';
    for (let j = 0; j < count; j++) {
      html += createBackHTML();
    }
    el.innerHTML = html;
  }
}

// 切换帮助面板
function toggleHelp() {
  const panel = document.getElementById('help-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// 绑定操作按钮
document.querySelectorAll('.action-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // console.log([按钮点击]', btn.dataset.action);
    Sound.playClick();
    const action = btn.dataset.action;
    handlePlayerAction(action);
  });
});

// 处理玩家操作
async function handlePlayerAction(action) {
  const player = game.players[0];
  const lastTile = game.lastDiscard;
  const lastTileName = lastTile ? lastTile.name || lastTile.type : '';
  
  switch (action) {
    case 'win':
      // 清除所有超时
      clearAllTimeouts();
      // 胡牌
      const isPlayerZimo = game.state === GameState.DRAWING;
      if (isPlayerZimo) {
        // 自摸
        Sound.playZimo();
        // 语音播报动作"胡"
        speakAction('胡', 0);
        logEvent('🎉 <span class="log-player">你</span>自摸胡牌！', 'win');
      } else {
        // 点炮/抢杠
        Sound.playWin();
        // 语音播报动作"胡"
        speakAction('胡', 0);
        logEvent('🎉 <span class="log-player">你</span>胡牌！', 'win');
      }
      game.state = GameState.GAMEOVER;
      revealAllHands(0, isPlayerZimo, false);  // 亮出所有人的牌
      break;
      
    case 'pong':
      // 碰：把打出的牌和手牌中的2张组成副露
      if (lastTile) {
        Sound.playPong();
        // 语音播报动作"碰"
        speakAction('碰', 0);
        // 找到手牌中相同的2张
        const indices = [];
        player.hand.forEach((t, i) => {
          if (t.type === lastTile.type && indices.length < 2) indices.push(i);
        });
        if (indices.length === 2) {
          // // // console.log(PONG: removing indices', indices, 'from hand of', player.hand.length);
          // 移除这2张牌
          indices.sort((a, b) => b - a).forEach(i => player.hand.splice(i, 1));
          // // // console.log(PONG: hand now has', player.hand.length, 'tiles');
          // 添加副露
          player.melds = player.melds || [];
          player.melds.push({
            type: 'pong',
            tiles: [
              { type: lastTile.type },
              { type: lastTile.type },
              lastTile
            ]
          });
          // 移除打出的牌（从打出这张牌的玩家的牌池中移除）
          const fromPlayer = game.players[game.currentPlayer];
          if (fromPlayer && fromPlayer.pool.length > 0) {
            fromPlayer.pool.pop();
          }
          // 清除 lastDiscard
          game.lastDiscard = null;
          
          renderPlayerHand();
          renderMelds('pong');
          renderPool();
          logEvent(`<span class="log-player">你</span>碰了 <span class="log-tile">${lastTileName}</span>（要${lastTileName}）`, 'pong');
          
          // 碰后需要再打一张（不摸牌）
          game.state = GameState.DISCARDING;
          game.currentPlayer = 0;
          // 清空按钮，禁用跳过
          elements.actions.chi.disabled = true;
          elements.actions.pong.disabled = true;
          elements.actions.kong.disabled = true;
          elements.actions.win.disabled = true;
          elements.actions.pass.disabled = true;
          clearAllTimeouts();

          // // // console.log(PONG done: hand has', player.hand.length, 'tiles');
        }
      }
      break;
      
    case 'kong':
      // 杠：三种情况
      // 1. 从碰加杠（摸牌后）- 使用 game.kongTile
      // 2. 暗杠（摸牌后）- 使用 game.concealedKongTile
      // 3. 明杠 - 响应别人打出的牌（手牌3张+打出的1张）
      Sound.playKong();
      speakAction('杠', 0);

      // 检查是否是从碰加杠（摸牌后，有 game.kongTile）
      if (game.kongTile && canKongFromPong(player, game.kongTile)) {
        // 从碰加杠
        const kongTile = game.kongTile;
        const meldIndex = player.melds.findIndex(m => m.type === 'pong' && m.tiles[0].type === kongTile.type);
        if (meldIndex !== -1) {
          const oldPong = player.melds[meldIndex];
          player.melds.splice(meldIndex, 1);
          player.melds.push({ type: 'kong', tiles: [...oldPong.tiles, kongTile], concealed: false });
          const handIdx = player.hand.findIndex(t => t.id === kongTile.id);
          if (handIdx !== -1) player.hand.splice(handIdx, 1);
          game.kongTile = null;
          game.concealedKongTile = null;

          renderPlayerHand();
          renderMelds('kong');
          renderPool();

          const drawnTile = drawTile(player, game.wall);
          if (drawnTile) {
            Sound.playDraw();
            logEvent(`<span class="log-player">你</span>杠了 <span class="log-tile">${kongTile.name || kongTile.type}</span>（从碰加杠），摸到了 <span class="log-tile">${drawnTile.name || drawnTile.type}</span>，打一张牌`, 'kong');
            game.lastAction = 'kong';
            player.hand.sort((a, b) => a.type.localeCompare(b.type));
            renderPlayerHand();
            updateWall();
            game.state = GameState.DRAWING;
            elements.actions.chi.disabled = true;
            elements.actions.pong.disabled = true;
            elements.actions.kong.disabled = true;
            elements.actions.win.disabled = true;
            elements.actions.pass.disabled = true;
            clearAllTimeouts();
            checkPlayerActions();
          }
        }
      } else if (game.concealedKongTile) {
        // 暗杠 - 摸牌后手牌有4张相同的牌
        const kongType = game.concealedKongTile.type;
        const indices = [];
        player.hand.forEach((t, i) => {
          if (t.type === kongType && indices.length < 4) indices.push(i);
        });
        if (indices.length === 4) {
          indices.sort((a, b) => b - a).forEach(i => player.hand.splice(i, 1));
          player.melds = player.melds || [];
          player.melds.push({ type: 'kong', tiles: [{ type: kongType }, { type: kongType }, { type: kongType }, { type: kongType }], concealed: true });
          game.kongTile = null;
          game.concealedKongTile = null;

          renderPlayerHand();
          renderMelds('kong');
          renderPool();

          const drawnTile = drawTile(player, game.wall);
          if (drawnTile) {
            Sound.playDraw();
            logEvent(`<span class="log-player">你</span>暗杠 <span class="log-tile">${kongType}</span>，摸到了 <span class="log-tile">${drawnTile.name || drawnTile.type}</span>，打一张牌`, 'kong');
            game.lastAction = 'kong';
            player.hand.sort((a, b) => a.type.localeCompare(b.type));
            renderPlayerHand();
            updateWall();
            game.state = GameState.DRAWING;
            elements.actions.chi.disabled = true;
            elements.actions.pong.disabled = true;
            elements.actions.kong.disabled = true;
            elements.actions.win.disabled = true;
            elements.actions.pass.disabled = true;
            clearAllTimeouts();
            checkPlayerActions();
          } else {
            logEvent('❌ 牌山已空，流局', 'win');
            game.state = GameState.GAMEOVER;
          }
        }
      } else if (lastTile) {
        // 明杠 - 响应别人打出的牌
        const indices = [];
        player.hand.forEach((t, i) => {
          if (t.type === lastTile.type && indices.length < 3) indices.push(i);
        });
        if (indices.length === 3) {
          indices.sort((a, b) => b - a).forEach(i => player.hand.splice(i, 1));
          player.melds = player.melds || [];
          player.melds.push({ type: 'kong', tiles: [{ type: lastTile.type }, { type: lastTile.type }, { type: lastTile.type }, lastTile], concealed: false });
          // 从打出这张牌的玩家的牌池中移除
          const fromPlayer = game.players[game.lastDrawer !== undefined ? game.lastDrawer : game.currentPlayer];
          if (fromPlayer && fromPlayer.pool.length > 0) fromPlayer.pool.pop();
          game.lastDiscard = null;
          game.kongTile = null;
          game.concealedKongTile = null;

          renderPlayerHand();
          renderMelds('kong');
          renderPool();

          const drawnTile = drawTile(player, game.wall);
          if (drawnTile) {
            Sound.playDraw();
            logEvent(`<span class="log-player">你</span>杠了 <span class="log-tile">${lastTileName}</span>，摸到了 <span class="log-tile">${drawnTile.name || drawnTile.type}</span>，打一张牌`, 'kong');
            game.lastAction = 'kong';
            player.hand.sort((a, b) => a.type.localeCompare(b.type));
            renderPlayerHand();
            updateWall();
            game.state = GameState.DRAWING;
            elements.actions.chi.disabled = true;
            elements.actions.pong.disabled = true;
            elements.actions.kong.disabled = true;
            elements.actions.win.disabled = true;
            checkPlayerActions();
          } else {
            logEvent('❌ 牌山已空，流局', 'win');
            game.state = GameState.GAMEOVER;
          }
        }
      }
      break;

    case 'chi':
      // 吃：找到能组成顺子的牌
      if (lastTile) {
        // 找到所有可能的顺子组合
        const combinations = getChiCombinations(player.hand, lastTile);

        if (combinations.length > 0) {
          // 如果有多个组合，弹出选择窗口
          let selectedCombo = combinations[0];

          if (combinations.length > 1) {
            // 多个组合，需要用户选择
            endAnimation(); // 先释放动画锁，让用户可以交互
            clearAllTimeouts(); // 清除超时，等待用户选择

            const result = await showChiSelection(lastTile, combinations);
            if (!result) {
              // 用户点击了"过"
              elements.actions.chi.disabled = true;
              elements.actions.pong.disabled = true;
              elements.actions.kong.disabled = true;
              elements.actions.win.disabled = true;
              elements.actions.pass.disabled = true;
              clearAllTimeouts();
              return;
            }
            selectedCombo = result.combination;
          }

          Sound.playChow();
          speakAction('吃', 0);

          // 从手牌中移除选中的两张牌
          const indices = [];
          selectedCombo.tiles.forEach(need => {
            const idx = player.hand.findIndex(t => t.type === need);
            if (idx !== -1) indices.push({ idx, type: need });
          });

          indices.sort((a, b) => b.idx - a.idx).forEach(item => player.hand.splice(item.idx, 1));
          player.melds = player.melds || [];
          player.melds.push({
            type: 'chow',
            tiles: [
              { type: selectedCombo.tiles[0] },
              lastTile,
              { type: selectedCombo.tiles[1] }
            ].sort((a, b) => a.type.localeCompare(b.type))
          });
          // 移除打出的牌（从打出这张牌的玩家的牌池中移除）
          const fromPlayer = game.players[game.lastDrawer];
          if (fromPlayer && fromPlayer.pool.length > 0) {
            fromPlayer.pool.pop();
          }
          // 清除 lastDiscard
          game.lastDiscard = null;

          renderPlayerHand();
          renderMelds('chow');
          renderPool();
          logEvent(`<span class="log-player">你</span>吃了 <span class="log-tile">${lastTileName}</span>`, 'chow');
          game.state = GameState.DISCARDING;
          elements.actions.chi.disabled = true;
          elements.actions.pong.disabled = true;
          elements.actions.kong.disabled = true;
          elements.actions.win.disabled = true;
          elements.actions.pass.disabled = true;
          clearAllTimeouts();

          // 确保回合回到玩家
          game.currentPlayer = 0;
        }
      }
      break;
  }
  
  // 吃碰杠后，确保是玩家回合
  game.currentPlayer = 0;
  
  // 处理跳过
  if (action === 'pass') {
    // 清除所有超时
    clearAllTimeouts();
    // 清除 lastDiscard
    game.lastDiscard = null;
    // 跳过，玩家摸牌（回到玩家自己的回合）
    elements.actions.pass.disabled = true;
    elements.actions.chi.disabled = true;
    elements.actions.pong.disabled = true;
    elements.actions.kong.disabled = true;
    elements.actions.win.disabled = true;
    // 跳过后回到打牌者的下家（让玩家摸牌）
    const lastDrawer = game.lastDrawer || game.currentPlayer;
    game.currentPlayer = (lastDrawer + 3) % 4;  // 跳到下家
    // console.log([pass] 跳过，玩家摸牌:', game.currentPlayer);
    safeDelay(() => startTurn(), 300);
    return;
  }
  
  // 吃碰杠后，如果状态是 DISCARDING，等待玩家打牌
  if (game.state === GameState.DISCARDING && game.currentPlayer === 0) {
    // 玩家需要再打一张牌，不跳转
    return;
  }
}

// 切换战况记录面板（竖屏手机用）
function toggleLogPanel() {
  const logPanel = document.getElementById('log-panel');
  if (logPanel) {
    logPanel.classList.toggle('show');
  }
}

// 启动游戏
document.addEventListener('DOMContentLoaded', () => {
  // 先测试牌逻辑
  // // console.log(Testing tile system...');
  const testTiles = initTileSet();
  // // console.log(Total tiles: ${testTiles.length}`);

  // 尝试恢复之前的游戏状态
  if (loadGameState()) {
    console.log('恢复之前的游戏状态');
    renderGame();
    highlightCurrentPlayer();

    // 根据当前状态决定下一步操作
    if (game.state === GameState.GAMEOVER) {
      // 游戏已结束，显示亮牌区域（如果需要）
      console.log('游戏已结束');
    } else if (game.currentPlayer === 0) {
      // 玩家回合
      if (game.state === GameState.DRAWING) {
        // 玩家已摸牌，等待打牌
        console.log('等待玩家打牌');
      } else if (game.state === GameState.RESPONDING) {
        // 检查玩家是否可以响应
        checkPlayerResponse();
      }
    } else {
      // AI 回合，延迟后继续
      console.log('AI 回合继续');
      safeDelay(() => startTurn(), 500);
    }
  } else {
    // 初始化并开始新游戏
    initGame();
  }
});
