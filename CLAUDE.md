# CLAUDE.md

This file provides guidance to Kscc (claudexxxxxx.ai/code) when working with code in this repository.

## Project Overview

A single-player Chinese Mahjong web game where 1 human player competes against 3 AI opponents. Built with vanilla HTML/CSS/JS with no build tools or dependencies.

**Tech Stack**: Pure HTML/CSS/JS, Web Audio API for sound synthesis, Speech Synthesis API for voice announcements

## Running the Game

```bash
# Serve locally (any static server works)
python3 -m http.server 8080
# Then open http://localhost:8080/index.html
```

## Testing

```bash
node test.js
```

The test suite covers:
- Tile operations (shuffle, deal, draw, discard)
- Win condition detection
- Chow/pong/kong validation
- Tenpai (ready hand) detection
- Game flow simulation

## Architecture

```
js/
├── tile.js         - Tile definitions, deck operations (shuffle, deal, draw, discard)
├── judge.js        - Win condition logic, chow/pong/kong validation, score calculation
├── game.js         - Main game loop, AI logic, UI rendering, event handling
├── sound.js        - Web Audio API sound synthesis for game events
└── tile-graphics.js - SVG tile generation (alternative to PNG assets)
```

### Core Data Structures

**Tile**: `{ id: string, type: string, name: string }`
- `type` values: `wan1-wan9`, `sou1-sou9`, `pin1-pin9`, `east/south/west/north`, `zhong/fa/bai`

**Player**: `{ id: number, hand: Tile[], pool: Tile[], melds: Meld[], isTenpai: boolean, isHu: boolean }`

**Meld**: `{ type: 'pong'|'kong'|'chow', tiles: Tile[] }`

### Game State Machine

```
WAITING → DEALING → DRAWING → DISCARDING → RESPONDING → GAMEOVER
                        ↑                        │
                        └────────────────────────┘
```

### Key Functions

| Module | Function | Purpose |
|--------|----------|---------|
| tile.js | `initTileSet()` | Create 136-tile deck |
| tile.js | `shuffle(tiles)` | Fisher-Yates shuffle |
| tile.js | `dealTiles(tileSet, 4)` | Deal 13 tiles to each player |
| judge.js | `canWin(hand)` | Check 14-tile win condition |
| judge.js | `checkTenpai(hand)` | Return tiles that would complete hand |
| judge.js | `canPong/canChow/canKong()` | Action validation |
| game.js | `AIPlayer` class | AI decision-making (discard selection, action evaluation) |

## Game Rules (Simplified Chinese Mahjong)

- **Deck**: 136 tiles (34 types x 4 each)
- **Win condition**: 4 melds (sequences/triplets) + 1 pair
- **Player order** (counter-clockwise): 南家(player) → 西家 → 北家 → 东家
- **Action priority**: 胡 > 杠 > 碰 > 吃

### Scoring (Fans)

| Type | Fans |
|------|------|
| Basic win | 1 |
| All triplets | 2 |
| Half flush (one suit + honors) | 3 |
| Full flush (one suit) | 4 |
| Seven pairs | 4 |
| Kong-based win | +2 |
| Self-draw | +1 |

## AI Strategy

The `AIPlayer` class in game.js:1314-1519 implements:
1. **Discard priority**: Isolated tiles → Excess tiles → Random
2. **Honor preference**: Discard winds/dragons first when isolated
3. **Defense**: Avoid dangerous tiles in late game (wall < 20 tiles)
4. **Pong/Kong evaluation**: Consider if action leads to tenpai

## Assets

- `assets/tiles/*.png` - Tile face images (47 files)
- Images named by tile type: `wan1.png`, `sou5.png`, `zhong.png`, etc.
- Back of tile: `back.png`

## CSS Architecture

- `css/style.css` - Main layout, player areas, game table styling
- `css/tiles.css` - Tile-specific styling
- Classical Chinese aesthetic: dark background, gold accents, green felt table