// 手牌管理类

/**
 * Hand class - Encapsulates hand tile management for a Mahjong player
 * Provides methods for sorting, finding, counting, and manipulating tiles
 */
class Hand {
  /**
   * Create a new Hand instance
   * @param {Array} tiles - Initial tiles (optional)
   */
  constructor(tiles = []) {
    this.tiles = [...tiles];
  }

  /**
   * Get the number of tiles in hand
   * @returns {number} Tile count
   */
  get length() {
    return this.tiles.length;
  }

  /**
   * Check if hand is empty
   * @returns {boolean} True if empty
   */
  isEmpty() {
    return this.tiles.length === 0;
  }

  /**
   * Add a tile to hand
   * @param {Object} tile - Tile to add
   * @returns {Hand} this for chaining
   */
  add(tile) {
    this.tiles.push(tile);
    return this;
  }

  /**
   * Add multiple tiles to hand
   * @param {Array} tiles - Tiles to add
   * @returns {Hand} this for chaining
   */
  addMultiple(tiles) {
    this.tiles.push(...tiles);
    return this;
  }

  /**
   * Remove a tile by ID
   * @param {string} tileId - Tile ID to remove
   * @returns {Object|null} Removed tile or null if not found
   */
  removeById(tileId) {
    const index = this.tiles.findIndex(t => t.id === tileId);
    if (index === -1) return null;
    const [removed] = this.tiles.splice(index, 1);
    return removed;
  }

  /**
   * Remove a tile by type (removes first occurrence)
   * @param {string} tileType - Tile type to remove
   * @returns {Object|null} Removed tile or null if not found
   */
  removeByType(tileType) {
    const index = this.tiles.findIndex(t => t.type === tileType);
    if (index === -1) return null;
    const [removed] = this.tiles.splice(index, 1);
    return removed;
  }

  /**
   * Remove multiple tiles by type
   * @param {string} tileType - Tile type to remove
   * @param {number} count - Number of tiles to remove
   * @returns {Array} Removed tiles
   */
  removeMultipleByType(tileType, count) {
    const removed = [];
    const indices = [];

    // Find indices (collect first)
    for (let i = 0; i < this.tiles.length && indices.length < count; i++) {
      if (this.tiles[i].type === tileType) {
        indices.push(i);
      }
    }

    // Remove from highest index first to maintain positions
    indices.sort((a, b) => b - a).forEach(idx => {
      const [tile] = this.tiles.splice(idx, 1);
      removed.push(tile);
    });

    return removed;
  }

  /**
   * Get a tile by ID without removing
   * @param {string} tileId - Tile ID
   * @returns {Object|null} Tile or null
   */
  getById(tileId) {
    return this.tiles.find(t => t.id === tileId) || null;
  }

  /**
   * Get all tiles of a specific type
   * @param {string} tileType - Tile type
   * @returns {Array} Tiles of that type
   */
  getByType(tileType) {
    return this.tiles.filter(t => t.type === tileType);
  }

  /**
   * Check if hand contains a tile type
   * @param {string} tileType - Tile type to check
   * @returns {boolean} True if contains
   */
  contains(tileType) {
    return this.tiles.some(t => t.type === tileType);
  }

  /**
   * Count tiles of a specific type
   * @param {string} tileType - Tile type
   * @returns {number} Count
   */
  countType(tileType) {
    return this.tiles.filter(t => t.type === tileType).length;
  }

  /**
   * Get count of all tile types
   * @returns {Object} Map of tileType -> count
   */
  getTypeCounts() {
    const counts = {};
    this.tiles.forEach(t => {
      counts[t.type] = (counts[t.type] || 0) + 1;
    });
    return counts;
  }

  /**
   * Find tiles that form a pair (count >= 2)
   * @returns {Array} Array of tile types that have pairs
   */
  findPairs() {
    const counts = this.getTypeCounts();
    return Object.entries(counts)
      .filter(([type, count]) => count >= 2)
      .map(([type]) => type);
  }

  /**
   * Find tiles that form a triplet (count >= 3)
   * @returns {Array} Array of tile types that have triplets
   */
  findTriplets() {
    const counts = this.getTypeCounts();
    return Object.entries(counts)
      .filter(([type, count]) => count >= 3)
      .map(([type]) => type);
  }

  /**
   * Find tiles that form a quad (count >= 4)
   * @returns {Array} Array of tile types that have quads
   */
  findQuads() {
    const counts = this.getTypeCounts();
    return Object.entries(counts)
      .filter(([type, count]) => count >= 4)
      .map(([type]) => type);
  }

  /**
   * Find isolated tiles (count === 1)
   * @returns {Array} Array of isolated tile types
   */
  findIsolated() {
    const counts = this.getTypeCounts();
    return Object.entries(counts)
      .filter(([type, count]) => count === 1)
      .map(([type]) => type);
  }

  /**
   * Sort tiles by type
   * @returns {Hand} this for chaining
   */
  sort() {
    this.tiles.sort((a, b) => a.type.localeCompare(b.type));
    return this;
  }

  /**
   * Get all tile types in hand
   * @returns {Array} Array of tile types
   */
  getTypes() {
    return [...new Set(this.tiles.map(t => t.type))];
  }

  /**
   * Filter tiles by a predicate
   * @param {Function} predicate - Filter function
   * @returns {Array} Filtered tiles
   */
  filter(predicate) {
    return this.tiles.filter(predicate);
  }

  /**
   * Find a tile by predicate
   * @param {Function} predicate - Find function
   * @returns {Object|null} Found tile or null
   */
  find(predicate) {
    return this.tiles.find(predicate) || null;
  }

  /**
   * Check if some tiles match predicate
   * @param {Function} predicate - Test function
   * @returns {boolean} True if any match
   */
  some(predicate) {
    return this.tiles.some(predicate);
  }

  /**
   * Check if all tiles match predicate
   * @param {Function} predicate - Test function
   * @returns {boolean} True if all match
   */
  every(predicate) {
    return this.tiles.every(predicate);
  }

  /**
   * Iterate over tiles
   * @param {Function} callback - Callback function
   */
  forEach(callback) {
    this.tiles.forEach(callback);
  }

  /**
   * Map tiles to new values
   * @param {Function} callback - Map function
   * @returns {Array} Mapped values
   */
  map(callback) {
    return this.tiles.map(callback);
  }

  /**
   * Get a copy of all tiles
   * @returns {Array} Copy of tiles array
   */
  getAll() {
    return [...this.tiles];
  }

  /**
   * Clear all tiles from hand
   * @returns {Hand} this for chaining
   */
  clear() {
    this.tiles = [];
    return this;
  }

  /**
   * Create a copy of this hand
   * @returns {Hand} New Hand instance
   */
  clone() {
    return new Hand(this.tiles);
  }

  /**
   * Convert to plain array for compatibility
   * @returns {Array} Tiles array
   */
  toArray() {
    return this.tiles;
  }

  /**
   * Get tiles of a specific suit
   * @param {string} suit - Suit name (wan, sou, pin)
   * @returns {Array} Tiles of that suit
   */
  getSuit(suit) {
    return this.tiles.filter(t => t.type.startsWith(suit));
  }

  /**
   * Check if hand contains honor tiles (winds and dragons)
   * @returns {boolean} True if contains honors
   */
  hasHonors() {
    return this.tiles.some(t =>
      ['east', 'south', 'west', 'north', 'zhong', 'fa', 'bai'].includes(t.type)
    );
  }

  /**
   * Get all honor tiles
   * @returns {Array} Honor tiles
   */
  getHonors() {
    return this.tiles.filter(t =>
      ['east', 'south', 'west', 'north', 'zhong', 'fa', 'bai'].includes(t.type)
    );
  }

  /**
   * Get tiles in a number range for a suit
   * @param {string} suit - Suit name (wan, sou, pin)
   * @param {number} min - Minimum number
   * @param {number} max - Maximum number
   * @returns {Array} Tiles in range
   */
  getRange(suit, min, max) {
    return this.tiles.filter(t => {
      if (!t.type.startsWith(suit)) return false;
      const num = parseInt(t.type.replace(/\D/g, ''));
      return num >= min && num <= max;
    });
  }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Hand };
}