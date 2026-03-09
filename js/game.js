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
  // [新增] AI难度设置
  aiDifficulty: AI_DIFFICULTY.MEDIUM
};

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
  poolSelf: document.getElementById('pool-self'),
  wall: document.getElementById('wall'),
  messageArea: document.getElementById('message-area'),
  restartArea: document.getElementById('restart-area'),
  // 4个玩家的元素
  players: {
    0: { hand: document.getElementById('player-hand'), melds: document.getElementById('player-melds'), pool: document.getElementById('pool-self'), tileCount: null },
    1: { hand: document.getElementById('ai1-hand'), melds: document.getElementById('ai1-melds'), pool: document.getElementById('pool-1'), tileCount: document.getElementById('ai1-tile-count') },
    2: { hand: document.getElementById('ai2-hand'), melds: document.getElementById('ai2-melds'), pool: document.getElementById('pool-2'), tileCount: document.getElementById('ai2-tile-count') },
    3: { hand: document.getElementById('ai3-hand'), melds: document.getElementById('ai3-melds'), pool: document.getElementById('pool-3'), tileCount: document.getElementById('ai3-tile-count') }
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
  // 隐藏重新开始按钮和亮牌区域
  elements.restartArea.style.display = 'none';
  const revealArea = document.getElementById('reveal-area');
  if (revealArea) revealArea.remove();
  
  // 清空日志
  const logContent = document.getElementById('log-content');
  if (logContent) logContent.innerHTML = '';
  
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
    setTimeout(() => aiTurn(), 500);
  }
}

// 玩家打牌
function playerDiscard(tileId) {
  // // // console.log(playerDiscard called, state:', game.state, 'currentPlayer:', game.currentPlayer, 'tileId:', tileId);

  // 状态锁检查
  if (game.isAnimating) {
    console.log('动画进行中，请稍候');
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
    if (canWin(testHand)) {
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
  
  // 读取超时设置
  const timeoutInput = document.getElementById('timeout-setting');
  const timeoutMs = (parseInt(timeoutInput?.value) || 30) * 1000;
  
  // 从下家开始检查 (玩家是0，上家是3，下家是1)
  // 玩家打完牌后，逆时针检查：西家(3)->北家(2)->东家(1)
  // 优先级: 胡 > 杠 > 碰 > 吃
  for (let i = 3; i >= 1; i--) {
    const ai = game.players[i];
    const playerName = PLAYER_VOICES[i].name;
    
    // 获取所有可能的响应，按优先级排序
    const responses = [];
    
    // 检查胡 - 最高优先级
    const testHand = [...ai.hand, lastTile];
    if (canWin(testHand)) {
      responses.push({ type: 'win', priority: 4 });
    }
    
    // 检查杠（从碰加杠或直接明杠）
    if (canKongFromPong(ai, lastTile) || canKong(ai.hand, lastTile, false)) {
      responses.push({ type: 'kong', priority: 3 });
    }
    
    // 检查碰
    if (canPong(ai.hand, lastTile)) {
      responses.push({ type: 'pong', priority: 2 });
    }
    
    // 检查吃 (上家才能吃) - 上家是 (当前打牌者 + 3) % 4
    const upperPlayer = (game.currentPlayer + 3) % 4;
    if (i === upperPlayer && canChow(ai.hand, lastTile)) {
      responses.push({ type: 'chow', priority: 1 });
    }
    
    // 按优先级排序，取最高优先级
    if (responses.length > 0) {
      responses.sort((a, b) => b.priority - a.priority);
      const bestResponse = responses[0];
      
      // 延迟响应，让玩家看到提示
      setTimeout(() => {
        // 高亮正在响应的玩家
        game.currentPlayer = i;
        highlightCurrentPlayer();
        
        switch (bestResponse.type) {
          case 'win':
            // 清除超时计时器
            if (game.passTimeout) {
              clearTimeout(game.passTimeout);
              game.passTimeout = null;
            }
            logEvent(`🎉 <span class="log-player">${playerName}</span>胡牌！`, 'win');
            game.state = GameState.GAMEOVER;
            revealAllHands(i, false, false);
            return;
            
          case 'kong':
            logEvent(`<span class="log-player">${playerName}</span>杠了 <span class="log-tile">${lastTileName}</span>（要${lastTileName}）`, 'kong');
            // 语音播报动作"杠"
            speakAction('杠', i);
            handleAIKong(ai, lastTile, game.currentPlayer);
            renderPool();
            renderAIMelds();
            updateWall();
            // 标记刚刚进行了杠，用于检测抢杠胡
            game.lastAction = 'kong';
            // 杠后立即摸牌，不使用玩家的超时设置
            setTimeout(() => {
              game.currentPlayer = i;
              const drawn = drawTile(ai, game.wall);
              if (drawn) {
                // 杠后摸牌，检查是否有人胡（抢杠胡）
                game.state = GameState.RESPONDING;
                setTimeout(() => {
                  // 检查其他玩家是否可以抢杠胡
                  if (!checkRobKongHu(ai, lastTile, i)) {
                    // 没人抢杠胡，继续杠者的回合
                    renderPool();
                    updateWall();
                    setTimeout(() => aiTurn(), 300);
                  }
                }, 300);
              } else {
                logEvent('❌ 牌山已空，流局', 'win');
                game.state = GameState.GAMEOVER;
              }
            }, 300);
            return;
            return;
            
          case 'chow':
            logEvent(`<span class="log-player">${playerName}</span>吃了 <span class="log-tile">${lastTileName}</span>（要${lastTileName}）`, 'chow');
            // 语音播报动作"吃"
            speakAction('吃', i);
            handleAIChow(ai, lastTile, game.currentPlayer);
            renderPool();
            renderAIMelds();
            updateWall();
            // 吃后立即打一张，不摸牌（不使用超时）
            setTimeout(() => {
              game.currentPlayer = i;
              aiDiscardAfterAction();
            }, 300);
            return;
        }
      }, 300);  // 短暂延迟让玩家看到提示
      
      return;
    }
  }
  
  // 没有人响应，进入下一家（从打牌者的下家开始）
  // 玩家打牌后，下一家是西家(3)
  // console.log([checkAIResponse] 无人响应，玩家打牌后轮转到西家');
  setTimeout(() => nextPlayer(0), 500);
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

// AI 执行杠
function handleAIKong(ai, tile, fromPlayerIndex) {
  const indices = [];
  ai.hand.forEach((t, i) => {
    if (t.type === tile.type && indices.length < 3) indices.push(i);
  });
  if (indices.length >= 3) {
    indices.sort((a, b) => b - a).forEach(i => ai.hand.splice(i, 1));
    ai.melds = ai.melds || [];
    ai.melds.push({
      type: 'kong',
      tiles: [{type:tile.type}, {type:tile.type}, {type:tile.type}, tile]
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
  const needed = [`${suit}${num - 1}`, `${suit}${num + 1}`];
  
  const indices = [];
  needed.forEach(need => {
    const idx = ai.hand.findIndex(t => t.type === need);
    if (idx !== -1) indices.push({ idx, type: need });
  });
  
  if (indices.length === 2) {
    indices.sort((a, b) => b.idx - a.idx).forEach(item => ai.hand.splice(item.idx, 1));
    ai.melds = ai.melds || [];
    ai.melds.push({
      type: 'chow',
      tiles: [
        { type: needed[0] },
        tile,
        { type: needed[1] }
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
  if (canWin(testHand)) {
    elements.actions.win.disabled = false;
    logEvent('🔔 <span class="log-player">你</span>可以自摸！', 'win');
  }
  
  // 检查暗杠
  if (player.hand.some(t => {
    const count = player.hand.filter(x => x.type === t.type).length;
    return count === 4;
  })) {
    elements.actions.kong.disabled = false;
    logEvent('🔔 <span class="log-player">你</span>可以暗杠！', 'kong');
  }
  
  // 检查加杠（从碰加杠）- 摸到的牌和已有的碰组成杠
  if (lastTile && player.melds) {
    const hasPongWithTile = player.melds.some(m => 
      m.type === 'pong' && m.tiles[0].type === lastTile.type
    );
    if (hasPongWithTile) {
      elements.actions.kong.disabled = false;
      logEvent(`🔔 <span class="log-player">你</span>可以杠 ${lastTile.name || lastTile.type}！（从碰加杠）`, 'kong');
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
      if (game.passTimeout) {
        clearTimeout(game.passTimeout);
        game.passTimeout = null;
      }
      logEvent(`🎉 <span class="log-player">${playerName}</span>自摸胡牌！`, 'win');
      game.state = GameState.GAMEOVER;
      revealAllHands(game.currentPlayer, true, false);
      return;
      
    case 'kong':
      logEvent(`<span class="log-player">${playerName}</span>暗杠`, 'kong');
      // 处理暗杠
      break;
      
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
  updateWall();
  
  // AI 打牌后，检查玩家是否要碰/杠/胡
  game.state = GameState.RESPONDING;
  setTimeout(() => checkPlayerResponse(), 500);
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
    // AI 打牌时语音播报
    if (game.lastDiscard) {
      speakTileName(game.lastDiscard.type, game.currentPlayer);
      logEvent(`<span class="log-player">${playerName}</span>打出了 <span class="log-tile">${game.lastDiscard.name || game.lastDiscard.type}</span>`, 'discard');
    }
  }
  
  renderPool();
  updateWall();
  
  // AI 打牌后，检查玩家是否要碰/杠/胡
  game.state = GameState.RESPONDING;
  setTimeout(() => checkPlayerResponse(), 500);
}

// 检查玩家是否要响应 (碰/杠/胡)
function checkPlayerResponse() {
  const player = game.players[0];
  const lastTile = game.lastDiscard;
  const lastTileName = lastTile ? (lastTile.name || lastTile.type) : '';
  // 保存当前打牌者（西家/北家/东家打出牌后，检查玩家是否要响应）
  const currentDrawer = game.currentPlayer;
  const discardPlayerName = PLAYER_VOICES[currentDrawer].name;
  // console.log([checkPlayerResponse] 当前打牌者:', currentDrawer, '打出的牌:', lastTileName);
  
  if (!lastTile) {
    // console.log([checkPlayerResponse] 无lastTile，调用nextPlayer');
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
  const testHand = [...player.hand, lastTile];
  if (canWin(testHand)) {
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
  
  // 检查吃 (上家打出的牌) - 最低优先级
  // 你的上家是西家(3)，只有上家打的牌才能吃
  const prevPlayer = (currentDrawer + 3) % 4;
  if (prevPlayer === 0 && canChow(player.hand, lastTile)) {
    elements.actions.chi.disabled = false;
    const suit = lastTile.type.replace(/\d/g, '');
    const num = parseInt(lastTile.type.replace(/\D/g, ''));
    const chow1 = `${suit}${num - 1}`;
    const chow2 = `${suit}${num + 1}`;
    const TILE_NAMES = {
      wan1:'一万',wan2:'二万',wan3:'三万',wan4:'四万',wan5:'五万',wan6:'六万',wan7:'七万',wan8:'八万',wan9:'九万',
      sou1:'一索',sou2:'二索',sou3:'三索',sou4:'四索',sou5:'五索',sou6:'六索',sou7:'七索',sou8:'八索',sou9:'九索',
      pin1:'一筒',pin2:'二筒',pin3:'三筒',pin4:'四筒',pin5:'五筒',pin6:'六筒',pin7:'七筒',pin8:'八筒',pin9:'九筒'
    };
    const name1 = TILE_NAMES[chow1] || chow1;
    const name2 = TILE_NAMES[chow2] || chow2;
    logEvent(`🔔 <span class="log-player">你</span>可以吃 ${name1}${name2}！`, 'chow');
  }
  
  // 如果有操作选项，启用跳过按钮
  if (!elements.actions.chi.disabled || !elements.actions.pong.disabled || 
      !elements.actions.kong.disabled || !elements.actions.win.disabled) {
    elements.actions.pass.disabled = false;
  }
  
  // 读取超时设置
  const timeoutInput = document.getElementById('timeout-setting');
  const timeoutMs = (parseInt(timeoutInput?.value) || 30) * 1000;
  
  // 超时后自动跳过
  game.passTimeout = setTimeout(() => {
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
    // 无操作时，去打牌者的下家（逆时针）
    // 如果是AI打牌，玩家不响应，去北家
    // 如果是玩家打牌，玩家不响应，去西家
    const discardPlayer = game.lastDrawer !== undefined ? game.lastDrawer : currentDrawer;
    const nextPlayer = (discardPlayer + 3) % 4;
    game.currentPlayer = nextPlayer;
    game.lastDiscard = null;
    setTimeout(() => startTurn(), 300);
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
  
  // 检查流局
  if (game.wall.length < 4) {
    showMessage('❌ 牌山已空，流局');
    game.state = GameState.GAMEOVER;
    return;
  }
  
  setTimeout(() => startTurn(), 300);
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
  return `<img class="tile-img" data-id="${tile.id}" src="assets/tiles/${type}.png" alt="${tile.type}">`;
}

// 创建 AI 牌背 HTML
function createBackHTML() {
  return `<img class="tile-back-small" src="assets/tiles/back.png">`;
}

// 渲染牌池
function renderPool() {
  // 渲染所有玩家的牌池
  for (let i = 0; i < 4; i++) {
    const el = elements.players[i].pool;
    if (!el) continue;
    
    const player = game.players[i];
    
    // 为电脑玩家添加 ai-pool class 以实现10列显示
    if (i > 0) {
      el.classList.add('ai-pool');
    } else {
      el.classList.remove('ai-pool');
    }
    
    el.innerHTML = player.pool.map(tile => createTileHTML(tile)).join('');
  }
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
  elements.wall.querySelector('.wall-count').textContent = `${game.wall.length} 张`;
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
    const tiles = meld.tiles.map(tile => createTileHTML(tile)).join('');
    // Add animation class for the newest meld
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
    
    el.innerHTML = player.melds.map(meld => {
      // 副露显示：全部亮出（明牌）
      const tiles = meld.tiles.map((tile, idx) => {
        // 碰/杠/吃全部亮出（明牌）
        return `<img class="tile-back-small" src="assets/tiles/${tile.type}.png">`;
      }).join('');
      return `<div class="meld horizontal">${tiles}</div>`;
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
  updateWall();
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
function handlePlayerAction(action) {
  const player = game.players[0];
  const lastTile = game.lastDiscard;
  const lastTileName = lastTile ? lastTile.name || lastTile.type : '';
  
  switch (action) {
    case 'win':
      // 清除超时计时器
      if (game.passTimeout) {
        clearTimeout(game.passTimeout);
        game.passTimeout = null;
      }
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
          if (game.passTimeout) {
            clearTimeout(game.passTimeout);
            game.passTimeout = null;
          }
          
          // // // console.log(PONG done: hand has', player.hand.length, 'tiles');
        }
      }
      break;
      
    case 'kong':
      // 杠：两种情况
      // 1. 从碰加杠（明杠）- 手牌1张+已有的碰3张
      // 2. 直接明杠 - 手牌3张+打出的1张
      if (lastTile) {
        Sound.playKong();
        // 语音播报动作"杠"
        speakAction('杠', 0);
        
        // 先检查是否可以从碰加杠
        if (canKongFromPong(player, lastTile)) {
          // 从碰加杠
          const meldIndex = player.melds.findIndex(m => m.type === 'pong' && m.tiles[0].type === lastTile.type);
          if (meldIndex !== -1) {
            // 移除旧的碰，添加新的杠
            const oldPong = player.melds[meldIndex];
            player.melds.splice(meldIndex, 1);
            player.melds.push({
              type: 'kong',
              tiles: [...oldPong.tiles, lastTile]
            });
            // 从手牌移除1张
            const handIdx = player.hand.findIndex(t => t.type === lastTile.type);
            if (handIdx !== -1) player.hand.splice(handIdx, 1);
            // 移除打出的牌
            if (player.pool.length > 0) player.pool.pop();
            game.lastDiscard = null;
            
            renderPlayerHand();
            renderMelds('kong');
            renderPool();

            // 杠后需要再摸一张牌
            const drawnTile = drawTile(player, game.wall);
            if (drawnTile) {
              Sound.playDraw();
              logEvent(`<span class="log-player">你</span>杠了 <span class="log-tile">${lastTileName}</span>（从碰加杠），摸到了 <span class="log-tile">${drawnTile.name || drawnTile.type}</span>，打一张牌`, 'kong');
              // 标记刚刚进行了杠，用于检测抢杠胡
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
              if (game.passTimeout) {
                clearTimeout(game.passTimeout);
                game.passTimeout = null;
              }
              checkPlayerActions();
            }
          }
        } else {
          // 直接明杠 - 手牌3张+打出的1张
          const indices = [];
          player.hand.forEach((t, i) => {
            if (t.type === lastTile.type && indices.length < 3) indices.push(i);
          });
          if (indices.length === 3) {
            indices.sort((a, b) => b - a).forEach(i => player.hand.splice(i, 1));
            player.melds = player.melds || [];
            player.melds.push({
              type: 'kong',
              tiles: [
                { type: lastTile.type },
                { type: lastTile.type },
                { type: lastTile.type },
                lastTile
              ]
            });
            // 移除打出的牌
            if (player.pool.length > 0) {
              player.pool.pop();
            }
            // 清除 lastDiscard
            game.lastDiscard = null;
            
            renderPlayerHand();
            renderMelds('kong');
            renderPool();

            // 杠后需要再摸一张牌
            const drawnTile = drawTile(player, game.wall);
            if (drawnTile) {
              Sound.playDraw();
              logEvent(`<span class="log-player">你</span>杠了 <span class="log-tile">${lastTileName}</span>，摸到了 <span class="log-tile">${drawnTile.name || drawnTile.type}</span>，打一张牌`, 'kong');
              // 标记刚刚进行了杠，用于检测抢杠胡
              game.lastAction = 'kong';
              // 排序手牌
              player.hand.sort((a, b) => a.type.localeCompare(b.type));
              renderPlayerHand();
              updateWall();
              
              game.state = GameState.DRAWING;
              elements.actions.chi.disabled = true;
              elements.actions.pong.disabled = true;
              elements.actions.kong.disabled = true;
              elements.actions.win.disabled = true;
              
              // 检查是否能自摸
              checkPlayerActions();
            } else {
              logEvent('❌ 牌山已空，流局', 'win');
              game.state = GameState.GAMEOVER;
            }
          }
        }
      }
      break;
      
    case 'chi':
      // 吃：需要选择具体组合，这里简化为直接吃
      if (lastTile) {
        Sound.playChow();
        // 语音播报动作"吃"
        speakAction('吃', 0);
        // 简化：找到能组成顺子的牌
        const suit = lastTile.type.replace(/\d/g, '');
        const num = parseInt(lastTile.type.replace(/\D/g, ''));
        const needed = [`${suit}${num - 1}`, `${suit}${num + 1}`];
        
        const indices = [];
        needed.forEach(need => {
          const idx = player.hand.findIndex(t => t.type === need);
          if (idx !== -1) indices.push({ idx, type: need });
        });
        
        if (indices.length === 2) {
          indices.sort((a, b) => b.idx - a.idx).forEach(item => player.hand.splice(item.idx, 1));
          player.melds = player.melds || [];
          player.melds.push({
            type: 'chow',
            tiles: [
              { type: needed[0] },
              lastTile,
              { type: needed[1] }
            ].sort((a, b) => a.type.localeCompare(b.type))
          });
          // 移除打出的牌
          if (player.pool.length > 0) {
            player.pool.pop();
          }
          // 清除 lastDiscard
          game.lastDiscard = null;
          
          renderPlayerHand();
          renderMelds('chow');
          renderPool();
          logEvent(`<span class="log-player">你</span>吃了 <span class="log-tile">${lastTileName}</span>（要${lastTileName}）`, 'chow');
          game.state = GameState.DISCARDING;
          elements.actions.chi.disabled = true;
          elements.actions.pong.disabled = true;
          elements.actions.kong.disabled = true;
          elements.actions.win.disabled = true;
          elements.actions.pass.disabled = true;
          if (game.passTimeout) {
            clearTimeout(game.passTimeout);
            game.passTimeout = null;
          }
          
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
    // 清除超时
    if (game.passTimeout) {
      clearTimeout(game.passTimeout);
      game.passTimeout = null;
    }
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
    setTimeout(() => startTurn(), 300);
    return;
  }
  
  // 吃碰杠后，如果状态是 DISCARDING，等待玩家打牌
  if (game.state === GameState.DISCARDING && game.currentPlayer === 0) {
    // 玩家需要再打一张牌，不跳转
    return;
  }
}

// 启动游戏
document.addEventListener('DOMContentLoaded', () => {
  // 先测试牌逻辑
  // // console.log(Testing tile system...');
  const testTiles = initTileSet();
  // // console.log(Total tiles: ${testTiles.length}`);
  
  // 初始化并开始游戏
  initGame();
});
