// 牌山管理类

/**
 * TileSet class - Utility class for tile set operations
 * Manages the wall of tiles, shuffling, dealing, and drawing
 */
class TileSet {
  /**
   * Create a new TileSet instance
   * @param {Array} tiles - Initial tiles (optional, will create standard 136-tile set if not provided)
   */
  constructor(tiles = null) {
    if (tiles) {
      this.tiles = [...tiles];
    } else {
      this.tiles = this.createStandardSet();
    }
  }

  /**
   * Create a standard 136-tile Mahjong set
   * @returns {Array} Array of 136 tiles
   */
  createStandardSet() {
    const tiles = [];
    const allTypes = TileSet.getAllTileTypes();

    for (const type of allTypes) {
      for (let i = 0; i < 4; i++) {
        tiles.push({
          id: `${type}_${i}`,
          type: type,
          name: TileSet.TILE_NAMES[type]
        });
      }
    }

    return tiles;
  }

  /**
   * Get the number of tiles remaining
   * @returns {number} Tile count
   */
  get length() {
    return this.tiles.length;
  }

  /**
   * Check if tile set is empty
   * @returns {boolean} True if empty
   */
  isEmpty() {
    return this.tiles.length === 0;
  }

  /**
   * Shuffle the tile set (Fisher-Yates algorithm)
   * @returns {TileSet} this for chaining
   */
  shuffle() {
    for (let i = this.tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
    }
    return this;
  }

  /**
   * Draw a tile from the top
   * @returns {Object|null} Drawn tile or null if empty
   */
  draw() {
    if (this.tiles.length === 0) return null;
    return this.tiles.pop();
  }

  /**
   * Draw multiple tiles
   * @param {number} count - Number of tiles to draw
   * @returns {Array} Drawn tiles
   */
  drawMultiple(count) {
    const drawn = [];
    for (let i = 0; i < count && this.tiles.length > 0; i++) {
      drawn.push(this.tiles.pop());
    }
    return drawn;
  }

  /**
   * Deal tiles to players
   * @param {number} playerCount - Number of players (default 4)
   * @param {number} tilesPerPlayer - Tiles per player (default 13)
   * @returns {Object} Object with players array and remaining tiles reference
   */
  deal(playerCount = 4, tilesPerPlayer = 13) {
    const players = Array.from({ length: playerCount }, (_, i) => ({
      id: i,
      hand: [],
      pool: [],
      melds: [],
      isTenpai: false,
      isHu: false
    }));

    // Deal tiles round-robin
    for (let i = 0; i < tilesPerPlayer; i++) {
      for (let p = 0; p < playerCount; p++) {
        if (this.tiles.length > 0) {
          players[p].hand.push(this.tiles.pop());
        }
      }
    }

    return { players, remainingTiles: this };
  }

  /**
   * Get the number of remaining tiles
   * @returns {number} Remaining tile count
   */
  getRemainingCount() {
    return this.tiles.length;
  }

  /**
   * Check if a tile type is still available (not all 4 copies drawn)
   * @param {string} tileType - Tile type to check
   * @returns {boolean} True if at least one copy remains
   */
  isTypeAvailable(tileType) {
    return this.tiles.some(t => t.type === tileType);
  }

  /**
   * Count remaining tiles of a specific type
   * @param {string} tileType - Tile type
   * @returns {number} Count remaining
   */
  countTypeRemaining(tileType) {
    return this.tiles.filter(t => t.type === tileType).length;
  }

  /**
   * Get a copy of remaining tiles
   * @returns {Array} Copy of tiles array
   */
  getAll() {
    return [...this.tiles];
  }

  /**
   * Reset the tile set to a new full set
   * @returns {TileSet} this for chaining
   */
  reset() {
    this.tiles = this.createStandardSet();
    return this;
  }

  /**
   * Create a copy of this tile set
   * @returns {TileSet} New TileSet instance
   */
  clone() {
    return new TileSet([...this.tiles]);
  }

  // Static constants and methods

  /**
   * Tile type constants
   */
  static TILE_TYPES = {
    // 万子 (Characters) 1-9
    WAN_1: 'wan1', WAN_2: 'wan2', WAN_3: 'wan3', WAN_4: 'wan4', WAN_5: 'wan5',
    WAN_6: 'wan6', WAN_7: 'wan7', WAN_8: 'wan8', WAN_9: 'wan9',

    // 索子 (Bamboos) 1-9
    SOU_1: 'sou1', SOU_2: 'sou2', SOU_3: 'sou3', SOU_4: 'sou4', SOU_5: 'sou5',
    SOU_6: 'sou6', SOU_7: 'sou7', SOU_8: 'sou8', SOU_9: 'sou9',

    // 筒子 (Circles) 1-9
    PIN_1: 'pin1', PIN_2: 'pin2', PIN_3: 'pin3', PIN_4: 'pin4', PIN_5: 'pin5',
    PIN_6: 'pin6', PIN_7: 'pin7', PIN_8: 'pin8', PIN_9: 'pin9',

    // 飙牌 (Winds)
    EAST: 'east', SOUTH: 'south', WEST: 'west', NORTH: 'north',

    // 箭牌 (Dragons)
    ZHONG: 'zhong', FA: 'fa', BAI: 'bai'
  };

  /**
   * Tile Chinese names
   */
  static TILE_NAMES = {
    wan1: '一万', wan2: '二万', wan3: '三万', wan4: '四万', wan5: '五万',
    wan6: '六万', wan7: '七万', wan8: '八万', wan9: '九万',
    sou1: '一索', sou2: '二索', sou3: '三索', sou4: '四索', sou5: '五索',
    sou6: '六索', sou7: '七索', sou8: '八索', sou9: '九索',
    pin1: '一筒', pin2: '二筒', pin3: '三筒', pin4: '四筒', pin5: '五筒',
    pin6: '六筒', pin7: '七筒', pin8: '八筒', pin9: '九筒',
    east: '东风', south: '南风', west: '西风', north: '北风',
    zhong: '红中', fa: '发财', bai: '白板'
  };

  /**
   * Tile suits
   */
  static TILE_SUITS = {
    wan: ['wan1','wan2','wan3','wan4','wan5','wan6','wan7','wan8','wan9'],
    sou: ['sou1','sou2','sou3','sou4','sou5','sou6','sou7','sou8','sou9'],
    pin: ['pin1','pin2','pin3','pin4','pin5','pin6','pin7','pin8','pin9'],
    winds: ['east','south','west','north'],
    dragons: ['zhong','fa','bai']
  };

  /**
   * Get all tile types
   * @returns {Array} Array of all 34 tile types
   */
  static getAllTileTypes() {
    return [...TileSet.TILE_SUITS.wan, ...TileSet.TILE_SUITS.sou, ...TileSet.TILE_SUITS.pin,
            ...TileSet.TILE_SUITS.winds, ...TileSet.TILE_SUITS.dragons];
  }

  /**
   * Check if a tile type is an honor tile
   * @param {string} tileType - Tile type
   * @returns {boolean} True if honor tile
   */
  static isHonor(tileType) {
    return ['east', 'south', 'west', 'north', 'zhong', 'fa', 'bai'].includes(tileType);
  }

  /**
   * Check if a tile type is a suit tile
   * @param {string} tileType - Tile type
   * @returns {boolean} True if suit tile (wan, sou, pin)
   */
  static isSuit(tileType) {
    return tileType.startsWith('wan') || tileType.startsWith('sou') || tileType.startsWith('pin');
  }

  /**
   * Get the suit of a tile
   * @param {string} tileType - Tile type
   * @returns {string|null} Suit name (wan, sou, pin) or null for honors
   */
  static getSuit(tileType) {
    if (tileType.startsWith('wan')) return 'wan';
    if (tileType.startsWith('sou')) return 'sou';
    if (tileType.startsWith('pin')) return 'pin';
    return null;
  }

  /**
   * Get the number of a suit tile
   * @param {string} tileType - Tile type
   * @returns {number|null} Number 1-9 or null for honors
   */
  static getNumber(tileType) {
    const match = tileType.match(/(wan|sou|pin)(\d)/);
    return match ? parseInt(match[2]) : null;
  }

  /**
   * Create a tile object by type
   * @param {string} tileType - Tile type
   * @param {number} copyIndex - Copy index (0-3)
   * @returns {Object} Tile object
   */
  static createTile(tileType, copyIndex = 0) {
    return {
      id: `${tileType}_${copyIndex}`,
      type: tileType,
      name: TileSet.TILE_NAMES[tileType]
    };
  }

  /**
   * Create multiple tile objects of the same type
   * @param {string} tileType - Tile type
   * @param {number} count - Number of tiles to create
   * @returns {Array} Array of tile objects
   */
  static createTiles(tileType, count) {
    const tiles = [];
    for (let i = 0; i < count; i++) {
      tiles.push(TileSet.createTile(tileType, i));
    }
    return tiles;
  }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TileSet };
}