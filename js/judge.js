// 麻将胡牌判定模块

/**
 * 判断能否胡牌
 * @param {Array} hand - 手牌数组
 * @returns {boolean}
 */
function canWin(hand) {
  // 需要14张牌
  if (hand.length !== 14) return false;
  
  // 检查是否有对子
  const tiles = hand.map(t => t.type);
  
  // 尝试将每个对子作为雀头，检查剩余是否能组成顺子/刻子
  for (let i = 0; i < tiles.length; i++) {
    // 找相同牌作为雀头
    const j = tiles.indexOf(tiles[i], i + 1);
    if (j !== -1) {
      // 提取雀头和剩余牌
      const pair = [tiles[i], tiles[i]];
      const remaining = [...tiles.slice(0, i), ...tiles.slice(i + 1, j), ...tiles.slice(j + 1)];
      
      if (canFormMelds(remaining)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 判断剩余牌能否组成顺子或刻子
 */
function canFormMelds(tiles) {
  if (tiles.length === 0) return true;
  if (tiles.length % 3 !== 0) return false;
  
  // 排序
  tiles.sort();
  
  // 尝试消除一个顺子或刻子
  const tileStr = tiles.join(',');
  
  // 检查刻子 (AAA)
  for (let i = 0; i < tiles.length; i++) {
    if (i + 2 < tiles.length && 
        tiles[i] === tiles[i + 1] && 
        tiles[i] === tiles[i + 2]) {
      const remaining = [...tiles.slice(0, i), ...tiles.slice(i + 3)];
      if (canFormMelds(remaining)) return true;
    }
  }
  
  // 检查顺子 (ABC) - 只对万/索/筒有效
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const num = parseInt(tile.replace(/\D/g, ''));
    const suit = tile.replace(/\d/g, '');
    
    // 风牌和箭牌不能组成顺子
    if (!['wan', 'sou', 'pin'].includes(suit)) continue;
    
    const next1 = `${suit}${num + 1}`;
    const next2 = `${suit}${num + 2}`;
    
    const idx1 = tiles.indexOf(next1);
    const idx2 = tiles.indexOf(next2);
    
    if (idx1 !== -1 && idx2 !== -1) {
      const remaining = tiles.filter((t, idx) => idx !== i && idx !== idx1 && idx !== idx2);
      if (canFormMelds(remaining)) return true;
    }
  }
  
  return false;
}

/**
 * 检查是否听牌
 * @param {Array} hand - 13张手牌
 * @returns {Array} - 听牌后能胡的牌列表
 */
function checkTenpai(hand) {
  if (hand.length !== 13) return [];
  
  const waitingTiles = [];
  const allTypes = getAllTileTypes();
  
  // 尝试加入每种牌，看能否胡
  for (const type of allTypes) {
    // 检查牌堆中是否还有这种牌
    const testHand = [...hand, { type, id: `test_${type}` }];
    if (canWin(testHand)) {
      waitingTiles.push(type);
    }
  }
  
  return waitingTiles;
}

/**
 * 能否碰牌
 */
function canPong(hand, discardedTile) {
  const count = hand.filter(t => t.type === discardedTile.type).length;
  return count >= 2;
}

/**
 * 能否吃牌
 */
function canChow(hand, discardedTile) {
  const suit = discardedTile.type.replace(/\d/g, '');
  const num = parseInt(discardedTile.type.replace(/\D/g, ''));
  
  // 字牌不能吃
  if (!['wan', 'sou', 'pin'].includes(suit)) return false;
  if (num < 1 || num > 7) return false; // 只有1-7才能吃
  
  const needed = [
    `${suit}${num - 1}`,
    `${suit}${num + 1}`
  ];
  
  return needed.every(neededType => 
    hand.some(t => t.type === neededType)
  );
}

/**
 * 能否杠牌
 */
function canKong(hand, discardedTile, isSelfDraw = false) {
  const count = hand.filter(t => t.type === discardedTile.type).length;
  
  // 明杠: 手中有3张，桌上有1张
  if (!isSelfDraw && count >= 3) return true;
  
  // 暗杠: 手中有4张
  if (count >= 4) return true;
  
  return false;
}

/**
 * 能否从碰加杠（明杠）
 */
function canKongFromPong(player, tile) {
  if (!player.melds) return false;
  // 检查是否有该牌的碰
  return player.melds.some(meld => meld.type === 'pong' && meld.tiles[0].type === tile.type);
}

/**
 * 计算番数 (简化版)
 */
function calcScore(hand, melds = [], isZimo = false, isGangshanghua = false) {
  let fans = 1; // 屁胡
  
  // 获取所有牌型
  const tiles = hand.map(t => t.type);
  
  // 检查七对子
  if (isQiDui(tiles)) {
    fans = Math.max(fans, 4);
  }
  
  // 检查清一色
  if (isQingYiSe(tiles, melds)) {
    fans = Math.max(fans, 4);
  }
  
  // 检查混一色
  if (isHunYiSe(tiles, melds)) {
    fans = Math.max(fans, 3);
  }
  
  // 检查碰碰胡
  if (isPengPengHu(tiles, melds)) {
    fans = Math.max(fans, 2);
  }
  
  // 杠上开花
  if (isGangshanghua) fans += 2;
  
  // 自摸
  if (isZimo) fans += 1;
  
  return fans;
}

// 七对子
function isQiDui(tiles) {
  const counts = {};
  tiles.forEach(t => counts[t] = (counts[t] || 0) + 1);
  
  let pairs = 0;
  Object.values(counts).forEach(c => {
    if (c === 2) pairs++;
    else if (c === 4) pairs += 2; // 四张算两对
  });
  
  return pairs === 7;
}

// 清一色
function isQingYiSe(tiles, melds) {
  const allTiles = [...tiles, ...melds.flat()];
  const suits = new Set(allTiles.map(t => t.type.replace(/\d/g, '')));
  return suits.size === 1 && !suits.has('');
}

// 混一色
function isHunYiSe(tiles, melds) {
  const allTiles = [...tiles, ...melds.flat()];
  const suits = new Set(allTiles.map(t => t.type.replace(/\d/g, '')));
  const hasZi = allTiles.some(t => ['east','south','west','north','zhong','fa','bai'].includes(t.type));
  
  return suits.size === 2 && hasZi && suits.size <= 2;
}

// 碰碰胡
function isPengPengHu(tiles, melds) {
  const allTiles = [...tiles, ...melds.flat()];
  const counts = {};
  allTiles.forEach(t => counts[t] = (counts[t] || 0) + 1);
  
  const triplets = Object.values(counts).filter(c => c >= 3).length;
  const pairs = Object.values(counts).filter(c => c === 2).length;
  
  return triplets === 4 && pairs === 1;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    canWin, checkTenpai, canPong, canChow, canKong, calcScore
  };
}
