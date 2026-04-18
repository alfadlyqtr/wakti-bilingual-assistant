// Capability doc: PHASER GAME ENGINE
// Loaded only when the user asks for a game (~3% of requests).
// Extracted from the legacy BASE_SYSTEM_PROMPT to slim the base prompt.

export const PHASER_CAPABILITY = `
## 🎮 PHASER GAME ENGINE (USER ASKED FOR A GAME)

### FILE STRUCTURE
- /App.js — EVERYTHING (entire game in one file, no imports of Phaser from other files)
- /styles.css — Full-screen canvas, dark background, HUD styling

### CRITICAL SANDPACK CONSTRAINT
⛔ NEVER split Phaser scenes into separate files (MenuScene.js, GameScene.js, etc.)
⛔ NEVER write \`extends window.Phaser.Scene\` at the top level of any module
⛔ NEVER import Phaser classes from other files

WHY: Sandpack evaluates each module immediately. \`window.Phaser\` is undefined at module load time because the CDN script hasn't loaded yet. This causes: "Cannot read properties of undefined (reading 'Scene')"

### THE ONLY CORRECT PATTERN — EVERYTHING IN /App.js

\`\`\`jsx
import React, { useEffect, useRef } from 'react';

export default function App() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    // Load Phaser from CDN first
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js';
    script.async = true;
    script.onload = () => {
      const Phaser = window.Phaser; // Only access AFTER script loads

      // Define ALL scenes INSIDE onload — Phaser exists here
      class MenuScene extends Phaser.Scene {
        constructor() { super('MenuScene'); }
        create() {
          this.add.text(400, 300, 'Press SPACE to Play', { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);
          this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene'));
        }
      }

      class GameScene extends Phaser.Scene {
        constructor() { super('GameScene'); }
        create() {
          this.player = this.add.rectangle(400, 500, 40, 60, 0x00ff88);
          this.physics.add.existing(this.player);
          this.cursors = this.input.keyboard.createCursorKeys();
          this.score = 0;
          this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#fff' });
        }
        update() {
          const body = this.player.body;
          body.setVelocity(0);
          if (this.cursors.left.isDown) body.setVelocityX(-300);
          if (this.cursors.right.isDown) body.setVelocityX(300);
          this.score++;
          this.scoreText.setText('Score: ' + Math.floor(this.score / 10));
        }
      }

      class GameOverScene extends Phaser.Scene {
        constructor() { super('GameOverScene'); }
        create() {
          this.add.text(400, 300, 'Game Over!', { fontSize: '48px', fill: '#ff4444' }).setOrigin(0.5);
          this.input.keyboard.once('keydown-SPACE', () => this.scene.start('MenuScene'));
        }
      }

      if (gameRef.current) { gameRef.current.destroy(true); }

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: 'game-container',
        backgroundColor: '#0a0a1a',
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
        scene: [MenuScene, GameScene, GameOverScene]
      });
    };
    document.head.appendChild(script);

    return () => {
      if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; }
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a1a', overflow: 'hidden' }}>
      <div id="game-container" ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
\`\`\`

### GAME BUILDING RULES (MANDATORY)
1. ALL scene classes MUST be defined INSIDE the \`script.onload\` callback — never at module top level
2. ALL Phaser usage MUST happen after \`const Phaser = window.Phaser;\` inside onload
3. Use \`this.add.graphics()\` to draw colorful shapes — no external image assets needed
4. Use \`this.add.rectangle()\` for player, enemies, obstacles — colored boxes work great
5. Use \`tileSprite\` for scrolling backgrounds
6. Always include: Score HUD, Lives/Health display, Level indicator as \`this.add.text()\`
7. Input: \`this.cursors = this.input.keyboard.createCursorKeys()\` + touch support
8. Collisions: \`this.physics.add.overlap(groupA, groupB, callback)\`

### PHASER API — CRITICAL RULES

**PLAYER object — ALWAYS use this pattern:**
\`\`\`js
// ✅ CORRECT — single rectangle with physics
this.player = this.add.rectangle(x, y, width, height, 0x00ff88);
this.physics.add.existing(this.player);
this.player.body.setCollideWorldBounds(true);

// ✅ CORRECT — draw complex shape with graphics, then use rectangle for physics
const gfx = this.add.graphics();
gfx.fillStyle(0x00ff88);
gfx.fillRect(-15, -20, 30, 40);
this.player = this.add.rectangle(x, y, 30, 40, 0x000000, 0); // alpha=0 = invisible
this.physics.add.existing(this.player);
// in update() -> gfx.setPosition(this.player.x, this.player.y)
\`\`\`

**⛔ NEVER DO THIS:**
\`\`\`js
this.player = this.physics.add.group();
this.player.add(someGraphics);  // ❌ groups don't have .add() for graphics objects
\`\`\`

**Groups are for MULTIPLE objects (enemies, bullets), NOT the player:**
\`\`\`js
this.enemies = this.physics.add.group();
const enemy = this.add.rectangle(x, y, 30, 30, 0xff0000);
this.physics.add.existing(enemy);
this.enemies.add(enemy);
\`\`\`

**Containers (grouped visuals):**
\`\`\`js
const container = this.add.container(x, y);
const body = this.add.rectangle(0, 0, 30, 40, 0x00ff88);
const roof = this.add.triangle(0, -25, -15, 0, 15, 0, 0, -20, 0xff0000);
container.add([body, roof]);
\`\`\`

### GAME TYPE SPECIFICS
- **Racing**: Scrolling road stripes (tileSprite), player car at bottom, obstacles from top
- **Shooter**: Player at bottom, spacebar fires bullets (physics group), enemies wave-spawn from top
- **Platformer**: gravity: { y: 400 }, static platform group, jump on spacebar/up arrow
- **Puzzle**: Grid-based state in arrays, draw grid with graphics, click/keyboard input
`;
