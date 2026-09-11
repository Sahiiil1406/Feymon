import Phaser from "phaser";

type PlayerSprite = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  direction: "up" | "down" | "left" | "right";
  isMe: boolean;
};

export type DojoRoomCallbacks = {
  onMove?: (x: number, y: number, dir: PlayerSprite["direction"]) => void;
  onTalkSensei?: () => void;
  onTalkNpc?: (id: string) => void;
  onExitDojo?: () => void;
};

type DojoNpc = {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  spriteBase: string;
  isMain?: boolean;
};

export class DojoRoomScene extends Phaser.Scene {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;
  private keyEnter!: Phaser.Input.Keyboard.Key;

  private myId: string | null = null;
  private callbacks: DojoRoomCallbacks | null = null;

  private playerGroup!: Map<string, Phaser.GameObjects.Container>;
  private npcGroup!: Map<string, Phaser.GameObjects.Container>;
  private myContainer: Phaser.GameObjects.Container | null = null;
  private mySprite: Phaser.GameObjects.Sprite | null = null;

  // Fill full 1280×720 game viewport — symmetric, no white empty side
  private roomW = 1280;
  private roomH = 720;
  private wallRects: { x: number; y: number; w: number; h: number }[] = [];

  // positions relative to room centre — symmetric layout
  private exitDoor = { x: 640, y: 680, w: 72, h: 28 };
  private npcsData: DojoNpc[] = [
    { id: "dojo-sensei", name: "Master Kairo", role: "AI SENSEI • Talk to start loop", x: 640, y: 160, spriteBase: "professor", isMain: true },
    { id: "dojo-assist", name: "Acolyte Rin", role: "Challenges your gaps", x: 360, y: 300, spriteBase: "girl1" },
    { id: "dojo-scholar", name: "Scholar Nova", role: "Socratic probes", x: 920, y: 300, spriteBase: "omnichannelfemale" },
    { id: "dojo-rival", name: "Rival Kai", role: "Tests your analogies", x: 640, y: 420, spriteBase: "knight" },
  ];
  private nearbyNpcId: string | null = null;
  private nearExit = false;
  private nearSensei = false;

  private interactText: Phaser.GameObjects.Text | null = null;
  private interactBg: Phaser.GameObjects.Rectangle | null = null;

  private moving = false;
  private lastInteractAt = 0;

  constructor() {
    super("DojoRoomScene");
  }

  init(data: { myId: string | null; callbacks: DojoRoomCallbacks; entryPos?: { x: number; y: number } }) {
    this.myId = data.myId ?? null;
    this.callbacks = data.callbacks ?? null;
    // entryPos can be used to place player; stored for create
    (this as any)._entryPos = data.entryPos ?? { x: this.exitDoor.x, y: this.exitDoor.y - 42 };
  }

  setCallbacks(cb: DojoRoomCallbacks) {
    this.callbacks = cb;
  }
  setMyId(id: string) {
    this.myId = id;
  }

  preload() {
    // Ensure all atlases available even if dojo started first; also preload fallback floor tiles if needed
    if (!this.textures.exists("currentPlayerHD")) {
      this.load.atlas("currentPlayerHD", "/assets/atlas/atlas-hd.png", "/assets/atlas/atlas-hd.json");
      this.load.atlas("playersHD", "/assets/atlas/players-hd.png", "/assets/atlas/players-hd.json");
      this.load.atlas("currentPlayer", "/assets/atlas/atlas.png", "/assets/atlas/atlas.json");
      this.load.atlas("players", "/assets/atlas/players.png", "/assets/atlas/players.json");
    }
    // Ensure dojo floor tileset exists (reuse town tileset — already cached from overworld)
    if (!this.textures.exists("TilesTown")) {
      this.load.image("TilesTown", "/assets/tilesets/tuxmon-sample-32px-extruded.png");
    }
    // Pastoral is available as vivid fallback
    if (!this.textures.exists("PastoralHD")) {
      this.load.image("PastoralHD", "/assets/tilesets/pastoral-hd.png");
    }
    // Dojo tatami/wood/wall files generated on demand — preload them if missing cache
    this.load.image("dojoTatamiFile", "/assets/tilesets/dojo-tatami.png");
    this.load.image("dojoWoodFile", "/assets/tilesets/dojo-wood.png");
    this.load.image("dojoWallFile", "/assets/tilesets/dojo-wall.png");
  }

  create() {
    this.playerGroup = new Map();
    this.npcGroup = new Map();
    this.moving = false;
    this.nearbyNpcId = null;
    this.nearExit = false;
    this.nearSensei = false;

    // Warm brown wooden dojo floor — fixes white wash; #8B5A2B matches brown tatami PNG
    try { this.cameras.main.setBackgroundColor("#8B5A2B"); } catch {}
    // Fallback base rectangle covering whole room (always visible even if textures missing)
    try { this.add.rectangle(this.roomW / 2, this.roomH / 2, this.roomW, this.roomH, 0x8b5a2b).setDepth(-10); } catch {}

    this.createRoom();
    this.createNpcSprites();
    this.createAnimationsIfNeeded();
    this.setupInput();
    this.setupCamera();

    // place my player if not yet synced — will be synced via syncPlayers from PhaserGame
    this.events.emit("ready");

    // no fadeIn — was leaving screen black if interrupted
    // this.cameras.main.fadeIn(280, 0, 0, 0);
    console.log("[DojoRoomScene] create done, room", this.roomW, this.roomH, "npcs", this.npcsData.length);
  }

  private createRoom() {
    const w = this.roomW;
    const h = this.roomH;

    // Floor — brown wood tiles — idempotent (fixes re-enter crash) — now true brown #8B5A2B not white
    try {
      if (!this.textures.exists("dojo-tatami")) {
        const g = this.add.graphics();
        g.fillStyle(0x8b5a2b, 1); // brown floor, visible vs white
        g.fillRect(0, 0, 32, 32);
        g.lineStyle(1, 0x6b3a1f, 1);
        g.strokeRect(0, 0, 32, 32);
        g.lineStyle(1, 0x5a3218, 0.95);
        g.lineBetween(0, 16, 32, 16);
        g.fillStyle(0x785032, 0.9);
        g.fillRect(4, 4, 2, 2);
        g.fillRect(22, 20, 2, 2);
        // subtle highlight
        g.fillStyle(0xa67c52, 0.18);
        g.fillRect(2, 2, 28, 1);
        g.generateTexture("dojo-tatami", 32, 32);
        g.destroy();
      }
      if (!this.textures.exists("dojo-wood")) {
        const g2 = this.add.graphics();
        g2.fillStyle(0x2d1e14, 1);
        g2.fillRect(0, 0, 32, 16);
        g2.fillStyle(0x4a2e1a, 1);
        g2.fillRect(0, 6, 32, 2);
        g2.lineStyle(1, 0x23180e, 1);
        g2.lineBetween(8, 0, 8, 16);
        g2.lineBetween(24, 0, 24, 16);
        g2.lineStyle(1, 0x8b5a2b, 0.4);
        g2.lineBetween(0, 0, 32, 0);
        g2.generateTexture("dojo-wood", 32, 16);
        g2.destroy();
      }
      if (!this.textures.exists("dojo-wall")) {
        const g3 = this.add.graphics();
        g3.fillStyle(0x1c1917, 1);
        g3.fillRect(0, 0, 32, 32);
        g3.lineStyle(1, 0x3a352f, 1);
        g3.strokeRect(0, 0, 32, 32);
        g3.lineStyle(1, 0xf59e0b, 0.85);
        g3.lineBetween(0, 0, 32, 0);
        g3.generateTexture("dojo-wall", 32, 32);
        g3.destroy();
      }
    } catch (e) {
      console.warn("[DojoRoomScene] tatami gen failed", e);
    }
    // Ensure fallback base if textures missing — brown symmetric grid
    try {
      const bg = this.add.rectangle(w / 2, h / 2, w - 20, h - 20, 0x8b5a2b);
      bg.setDepth(-5);
      const grid = this.add.graphics();
      grid.lineStyle(1, 0x6b3a1f, 0.55);
      for (let x = 20; x < w; x += 32) grid.lineBetween(x, 20, x, h - 20);
      for (let y = 20; y < h; y += 32) grid.lineBetween(20, y, w - 20, y);
      grid.setDepth(-4);
      // Also tile the actual PNG files as visual backup (ensures something visible even if generateTexture blocked)
      // This proves download succeeded
      if (this.textures.exists("dojoTatamiFile")) {
        // faint tiled overlay using file texture for verification
        const test = this.add.image(24, 24, "dojoTatamiFile").setOrigin(0).setAlpha(0.0).setDepth(-6);
        test.setVisible(false);
      }
    } catch {}

    // Draw tiled floor — robust: fallback to rectangle if texture missing (prevents dark screen)
    const cols = Math.ceil(w / 32);
    const rows = Math.ceil(h / 32);
    const hasTatami = this.textures.exists("dojo-tatami") || this.textures.exists("dojoTatamiFile");
    const hasWood = this.textures.exists("dojo-wood") || this.textures.exists("dojoWoodFile");
    const tatamiKey = this.textures.exists("dojo-tatami") ? "dojo-tatami" : "dojoTatamiFile";
    const woodKey = this.textures.exists("dojo-wood") ? "dojo-wood" : "dojoWoodFile";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) continue;
        const px = x * 32 + 16;
        const py = y * 32 + 16;
        const isDoor = y === rows - 1 && x > cols / 2 - 2 && x < cols / 2 + 2;
        try {
          if (isDoor) {
            if (hasWood) this.add.image(px, py, woodKey).setDepth(0);
            else this.add.rectangle(px, py, 32, 16, 0x2d1e14).setDepth(0);
          } else {
            if (hasTatami) this.add.image(px, py, tatamiKey).setDepth(0);
            else this.add.rectangle(px, py, 32, 32, 0x8b5a2b).setStrokeStyle(1, 0x6b3a1f).setDepth(0);
          }
        } catch {
          this.add.rectangle(px, py, 32, 32, isDoor ? 0x2d1e14 : 0x8b5a2b).setDepth(0);
        }
      }
    }

    // Walls — thick dark outer border + interior dojo partitions (makes it a real room)
    this.wallRects = [];
    const wallThickness = 20;
    // outer
    this.wallRects.push({ x: w / 2, y: wallThickness / 2, w, h: wallThickness }); // top
    this.wallRects.push({ x: wallThickness / 2, y: h / 2, w: wallThickness, h }); // left
    this.wallRects.push({ x: w - wallThickness / 2, y: h / 2, w: wallThickness, h }); // right
    this.wallRects.push({ x: (w / 2 - 64) / 2 + wallThickness / 2, y: h - wallThickness / 2, w: w / 2 - 64, h: wallThickness });
    this.wallRects.push({ x: w - (w / 2 - 64) / 2 - wallThickness / 2, y: h - wallThickness / 2, w: w / 2 - 64, h: wallThickness });
    // interior — symmetric dojo partitions (brown wooden walls)
    // Left/right vertical shoji partitions separating side alcoves
    this.wallRects.push({ x: 480, y: 300, w: 16, h: 160 });
    this.wallRects.push({ x: 800, y: 300, w: 16, h: 160 });
    // Upper sensei dais divider — two segments leaving central passage
    this.wallRects.push({ x: 520, y: 220, w: 160, h: 14 });
    this.wallRects.push({ x: 760, y: 220, w: 160, h: 14 });
    // Lower training area low walls
    this.wallRects.push({ x: 360, y: 520, w: 120, h: 14 });
    this.wallRects.push({ x: 920, y: 520, w: 120, h: 14 });
    // 4 corner pillars (visual + collision)
    this.wallRects.push({ x: 300, y: 200, w: 20, h: 20 });
    this.wallRects.push({ x: 980, y: 200, w: 20, h: 20 });
    this.wallRects.push({ x: 300, y: 520, w: 20, h: 20 });
    this.wallRects.push({ x: 980, y: 520, w: 20, h: 20 });

    const wallG = this.add.graphics();
    wallG.fillStyle(0x1c1917, 1);
    wallG.fillRect(0, 0, w, wallThickness);
    wallG.fillRect(0, 0, wallThickness, h);
    wallG.fillRect(w - wallThickness, 0, wallThickness, h);
    wallG.fillRect(0, h - wallThickness, w / 2 - 64, wallThickness);
    wallG.fillRect(w / 2 + 64, h - wallThickness, w / 2 - 64, wallThickness);
    // interior walls — brown wood with orange trim
    wallG.fillStyle(0x3a2516, 1);
    wallG.fillRect(480 - 8, 300 - 80, 16, 160);
    wallG.fillRect(800 - 8, 300 - 80, 16, 160);
    wallG.fillRect(520 - 80, 220 - 7, 160, 14);
    wallG.fillRect(760 - 80, 220 - 7, 160, 14);
    wallG.fillRect(360 - 60, 520 - 7, 120, 14);
    wallG.fillRect(920 - 60, 520 - 7, 120, 14);
    // pillars
    wallG.fillStyle(0x2d1e14, 1);
    wallG.fillRect(300 - 10, 200 - 10, 20, 20);
    wallG.fillRect(980 - 10, 200 - 10, 20, 20);
    wallG.fillRect(300 - 10, 520 - 10, 20, 20);
    wallG.fillRect(980 - 10, 520 - 10, 20, 20);
    // wood trim highlight
    wallG.lineStyle(2, 0xf59e0b, 0.9);
    wallG.lineBetween(wallThickness, wallThickness, w - wallThickness, wallThickness);
    wallG.lineBetween(wallThickness, wallThickness, wallThickness, h - wallThickness);
    wallG.lineBetween(w - wallThickness, wallThickness, w - wallThickness, h - wallThickness);
    // interior trim
    wallG.lineStyle(1, 0xf59e0b, 0.6);
    wallG.strokeRect(480 - 8, 300 - 80, 16, 160);
    wallG.strokeRect(800 - 8, 300 - 80, 16, 160);
    wallG.strokeRect(520 - 80, 220 - 7, 160, 14);
    wallG.strokeRect(760 - 80, 220 - 7, 160, 14);
    wallG.setDepth(1);

    // Decor — top alcove (tokonoma) for sensei
    const alcove = this.add.rectangle(w / 2, 56, 300, 72, 0x0a0a0a, 1);
    alcove.setStrokeStyle(1, 0xf59e0b, 0.6);
    alcove.setDepth(2);
    const alcoveLabel = this.add.text(w / 2, 50, "  AI  SENSEI  —  FEYNMAN  DOJO  ", {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "10px",
      color: "#f59e0b",
    });
    alcoveLabel.setOrigin(0.5);
    alcoveLabel.setDepth(3);
    alcoveLabel.setLetterSpacing(1);
    const subLabel = this.add.text(w / 2, 66, "  Talk to Master Kairo to begin  •  Counter → Rating → Level  ", {
      fontFamily: "'Inter', sans-serif",
      fontSize: "9px",
      color: "#8a8a8a",
    });
    subLabel.setOrigin(0.5);
    subLabel.setDepth(3);

    // lanterns flanking alcove
    const lanL = this.add.circle(w / 2 - 150, 56, 8, 0xf59e0b, 1);
    lanL.setStrokeStyle(1, 0x1c1917, 0.5);
    lanL.setDepth(3);
    const lanR = this.add.circle(w / 2 + 150, 56, 8, 0xf59e0b, 1);
    lanR.setStrokeStyle(1, 0x1c1917, 0.5);
    lanR.setDepth(3);
    this.tweens.add({ targets: [lanL, lanR], scale: 1.1, duration: 900, yoyo: true, repeat: -1 });

    // low tables — symmetric under Rin/Nova
    const t1 = this.add.rectangle(360, 330, 90, 28, 0x1c1917, 0.85);
    t1.setStrokeStyle(1, 0x3a3a3a, 0.6);
    t1.setDepth(1);
    const t2 = this.add.rectangle(920, 330, 90, 28, 0x1c1917, 0.85);
    t2.setStrokeStyle(1, 0x3a3a3a, 0.6);
    t2.setDepth(1);
    // additional center table for Kai symmetric
    const t3 = this.add.rectangle(640, 460, 90, 28, 0x1c1917, 0.85);
    t3.setStrokeStyle(1, 0x3a3a3a, 0.6);
    t3.setDepth(1);

    // exit mat
    const mat = this.add.ellipse(this.exitDoor.x, this.exitDoor.y, 72, 18, 0x1c1917, 0.12);
    mat.setDepth(1);
    const matInner = this.add.ellipse(this.exitDoor.x, this.exitDoor.y, 50, 10, 0xf59e0b, 0.18);
    matInner.setDepth(1);

    // exit door visual
    const doorGlow = this.add.rectangle(this.exitDoor.x, this.exitDoor.y - 8, 56, 28, 0xfffbeb, 0.55);
    doorGlow.setStrokeStyle(1, 0xf59e0b, 0.85);
    doorGlow.setDepth(2);
    const doorArrow = this.add.text(this.exitDoor.x, this.exitDoor.y - 8, "▼  EXIT", {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "10px",
      color: "#1c1917",
    });
    doorArrow.setOrigin(0.5);
    doorArrow.setDepth(3);
    this.tweens.add({ targets: doorGlow, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });

    // exit marker - NOT clickable for exit; must use ENTER at door (as requested)
    const exitHit = this.add.rectangle(this.exitDoor.x, this.exitDoor.y - 6, this.exitDoor.w + 12, this.exitDoor.h + 12, 0x000000, 0.0);
    exitHit.setDepth(2);
    // no pointerdown -> exit only via ENTER at door (tryInteract). Keep visual hint only
    // optional: show hand but not exit
    exitHit.setInteractive({ useHandCursor: true });
    exitHit.on("pointerdown", () => {
      // nudge hint instead of instant exit — user must press ENTER
      if (this.nearExit) this.tryInteract();
    });

    // physics bounds
    this.physics.world.setBounds(0, 0, w, h);
    this.cameras.main.setBounds(0, 0, w, h);

    // Scroll factor fixed for interact prompt
    this.interactBg = this.add.rectangle(0, 0, 180, 22, 0x1c1917, 0.92);
    this.interactBg.setStrokeStyle(1, 0xe9ddd0, 0.8);
    this.interactBg.setDepth(120);
    this.interactBg.setVisible(false);
    this.interactText = this.add.text(0, 0, "ENTER  TALK", {
      fontFamily: "'Inter', sans-serif",
      fontSize: "11px",
      color: "#fdfbf7",
      fontStyle: "600",
    });
    this.interactText.setOrigin(0.5);
    this.interactText.setDepth(121);
    this.interactText.setVisible(false);

    // Header banner inside room
    const banner = this.add.rectangle(w / 2, 18, 260, 22, 0x1c1917, 0.88);
    banner.setStrokeStyle(1, 0xe9ddd0, 0.9);
    banner.setDepth(60);
    const title = this.add.text(w / 2, 18, "DOJO  TRAINING  HALL", {
      fontFamily: "'Inter', sans-serif",
      fontSize: "10px",
      color: "#fdfbf7",
      fontStyle: "600",
    });
    title.setOrigin(0.5);
    title.setDepth(61);
    title.setLetterSpacing(1.5);
  }

  private createNpcSprites() {
    // already defined npcsData
    for (const n of this.npcsData) {
      const cont = this.createNpcContainer(n);
      this.npcGroup.set(n.id, cont);
    }
  }

  private createNpcContainer(n: DojoNpc): Phaser.GameObjects.Container {
    const c = this.add.container(n.x, n.y);
    const mat = this.add.ellipse(0, 16, 30, 11, 0xf59e0b, 0.18);
    this.tweens.add({ targets: mat, scaleX: 1.08, duration: 1000, yoyo: true, repeat: -1 });
    const shadow = this.add.ellipse(0, 12, 16, 7, 0x1c1917, 0.16);

    const atlas = this.textures.exists("playersHD") ? "playersHD" : "players";
    const base = n.spriteBase;
    let sprite: Phaser.GameObjects.Sprite;
    const frame = `${base}_front.png`;
    try {
      sprite = this.add.sprite(0, -10, atlas, frame);
      sprite.setScale(atlas.includes("HD") ? 0.92 : 1.75);
    } catch {
      sprite = this.add.sprite(0, -10, "currentPlayer", "misa-front");
      sprite.setScale(0.6);
    }
    sprite.setOrigin(0.5, 0.85);

    // name plate — for interior we show name (helps identify main)
    const nameW = Math.max(84, n.name.length * 7 + 16);
    const plate = this.add.rectangle(0, -36, nameW, 16, n.isMain ? 0xf59e0b : 0x1c1917, 1);
    plate.setStrokeStyle(1, n.isMain ? 0x1c1917 : 0xe9ddd0, 0.6);
    const label = this.add.text(0, -36, (n.isMain ? "✦ " : "") + n.name, {
      fontFamily: "'Inter', sans-serif",
      fontSize: "10px",
      color: n.isMain ? "#1c1917" : "#fdfbf7",
      fontStyle: n.isMain ? "700" : "600",
    });
    label.setOrigin(0.5);
    label.setLetterSpacing(0.2);

    // role label subtle
    const role = this.add.text(0, -48, n.role, {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "8px",
      color: n.isMain ? "#f59e0b" : "#8a8a8a",
    });
    role.setOrigin(0.5);
    role.setAlpha(0.9);

    // exclamation for main only
    if (n.isMain) {
      const exBg = this.add.rectangle(16, -20, 14, 14, 0x1c1917, 1);
      exBg.setStrokeStyle(1, 0xf59e0b, 0.8);
      const ex = this.add.text(16, -20, "!", {
        fontFamily: "'Inter', sans-serif",
        fontSize: "9px",
        color: "#fde68a",
        fontStyle: "700",
      });
      ex.setOrigin(0.5);
      this.tweens.add({ targets: ex, y: -22, duration: 650, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: exBg, y: -22, duration: 650, yoyo: true, repeat: -1 });
      c.add([mat, shadow, sprite, plate, label, role, exBg, ex]);
    } else {
      c.add([mat, shadow, sprite, plate, label, role]);
    }
    c.setDepth(n.y + 25);
    const hit = this.add.rectangle(0, 0, 36, 36, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.handleNpcClick(n.id));
    c.add(hit);
    (c as any)._sprite = sprite;
    (c as any)._base = base;
    return c;
  }

  private createAnimationsIfNeeded() {
    if (!this.anims.exists("misa-front-walk")) {
      try {
        const atlas = this.textures.exists("currentPlayerHD") ? "currentPlayerHD" : "currentPlayer";
        for (const d of ["left", "right", "front", "back"] as const) {
          const dirMap: any = { left: "misa-left-walk", right: "misa-right-walk", front: "misa-front-walk", back: "misa-back-walk" };
          const key = dirMap[d];
          if (!this.anims.exists(key)) {
            const prefix = `misa-${d}-walk.`;
            this.anims.create({
              key,
              frames: this.anims.generateFrameNames(atlas, { prefix, start: 0, end: 3, zeroPad: 3 }),
              frameRate: 10,
              repeat: -1,
            });
          }
        }
      } catch {}
    }
  }

  private setupInput() {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.enabled = true;
    try {
      this.cursors = kb.createCursorKeys();
    } catch {
      this.cursors = null;
    }
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyEnter = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    const winHandler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "Enter" || e.key === " " || e.key === "e" || e.key === "E") {
        if (Date.now() - this.lastInteractAt < 260) return;
        this.tryInteract();
      }
    };
    window.addEventListener("keydown", winHandler);
    this.events.once("shutdown", () => window.removeEventListener("keydown", winHandler));
    this.events.once("destroy", () => window.removeEventListener("keydown", winHandler));

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (Phaser.Math.Distance.Between(wp.x, wp.y, this.exitDoor.x, this.exitDoor.y) < 42) {
        // Click on door only shows prompt — actual exit requires ENTER (requested: Enter at door only)
        // Do not auto-exit on click; tryInteract will handle if already near, otherwise move nearby
        if (this.nearExit) this.tryInteract();
        return;
      }
      for (const n of this.npcsData) {
        if (Phaser.Math.Distance.Between(wp.x, wp.y, n.x, n.y) < 30) {
          this.handleNpcClick(n.id);
          return;
        }
      }
      // click to move one tile
      if (this.myContainer && !this.moving) {
        const dx = wp.x - this.myContainer.x;
        const dy = wp.y - this.myContainer.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) this.tryGridMove("right");
          else this.tryGridMove("left");
        } else {
          if (dy > 0) this.tryGridMove("down");
          else this.tryGridMove("up");
        }
      }
    });
  }

  private setupCamera() {
    this.cameras.main.setBounds(0, 0, this.roomW, this.roomH);
    // 1.0 fills 1280×720 viewport perfectly symmetric — no white gap on right. 1.05 previously left 70px white on right due to 880 room.
    this.cameras.main.setZoom(1.0);
    this.cameras.main.setRoundPixels(true);
    try { this.cameras.main.centerOn(this.roomW / 2, this.roomH / 2); } catch {}
  }

  syncPlayers(players: PlayerSprite[]) {
    if (!this.playerGroup) return;
    const seen = new Set<string>();
    for (const p of players) {
      seen.add(p.id);
      let cont = this.playerGroup.get(p.id);
      if (!cont) {
        cont = this.createPlayerContainer(p);
        this.playerGroup.set(p.id, cont);
        if (p.isMe) {
          this.myContainer = cont;
          this.mySprite = (cont as any)._sprite as Phaser.GameObjects.Sprite;
          this.cameras.main.startFollow(cont, true, 0.14, 0.14);
          try {
            this.physics.add.existing(cont as any);
            (cont as any).body.setSize(16, 16);
            (cont as any).body.setOffset(-8, -4);
          } catch {}
        }
      } else {
        this.updatePlayerContainer(cont, p);
      }
      if (!p.isMe) {
        const dist = Phaser.Math.Distance.Between(cont.x, cont.y, p.x, p.y);
        if (dist > 100) {
          this.tweens.killTweensOf(cont);
          cont.setPosition(p.x, p.y);
        } else if (dist > 1) {
          this.tweens.killTweensOf(cont);
          this.tweens.add({
            targets: cont,
            x: p.x,
            y: p.y,
            duration: 160,
            ease: "Linear",
          });
        }
      } else {
        const sprite = (cont as any)._sprite as Phaser.GameObjects.Sprite | undefined;
        if (sprite) {
          const idleMap: any = { up: "misa-back", down: "misa-front", left: "misa-left", right: "misa-right" };
          const atlas = this.textures.exists("currentPlayerHD") ? "currentPlayerHD" : "currentPlayer";
          try {
            sprite.setTexture(atlas, idleMap[p.direction] ?? "misa-front");
          } catch {}
        }
      }
      cont.setDepth(cont.y + 30);
    }
    for (const [id, cont] of this.playerGroup.entries()) {
      if (!seen.has(id)) {
        if (id === this.myId) continue;
        cont.destroy();
        this.playerGroup.delete(id);
      }
    }
  }

  private createPlayerContainer(p: PlayerSprite): Phaser.GameObjects.Container {
    const c = this.add.container(p.x, p.y);
    const shadow = this.add.ellipse(0, 13, 18, 8, 0x1c1917, 0.18);
    let sprite: Phaser.GameObjects.Sprite;
    const isMe = p.isMe;
    const atlas = isMe ? (this.textures.exists("currentPlayerHD") ? "currentPlayerHD" : "currentPlayer") : (this.textures.exists("playersHD") ? "playersHD" : "players");
    const frameMap: any = isMe ? { down: "misa-front", up: "misa-back", left: "misa-left", right: "misa-right" } : { down: "bob_front.png", up: "bob_back.png", left: "bob_left.png", right: "bob_right.png" };
    const frame = frameMap[p.direction] ?? frameMap.down;
    const isHD = atlas.includes("HD");
    try {
      sprite = this.add.sprite(0, -10, atlas, frame);
      sprite.setScale(isHD ? (isMe ? 0.72 : 0.70) : (isMe ? 1.35 : 1.30));
    } catch {
      sprite = this.add.sprite(0, -10, "currentPlayer", "misa-front");
      sprite.setScale(1.1);
    }
    (c as any)._sprite = sprite;
    if (!isMe) {
      try {
        sprite.setTint(Phaser.Display.Color.HexStringToColor(p.color).color);
      } catch {}
    }
    const nameW = Math.max(62, p.name.length * 7 + 18);
    const plateShadow = this.add.rectangle(0, -34.5, nameW, 16, 0x1c1917, 0.14);
    const plate = this.add.rectangle(0, -36, nameW, 16, isMe ? 0xf59e0b : 0x1c1917, 1);
    plate.setStrokeStyle(1, isMe ? 0x1c1917 : 0xe9ddd0, 0.7);
    const label = this.add.text(0, -36, (isMe ? "◆ " : "") + p.name, {
      fontFamily: "'Inter', sans-serif",
      fontSize: "10px",
      color: isMe ? "#1c1917" : "#fdfbf7",
      fontStyle: isMe ? "700" : "600",
    });
    label.setOrigin(0.5);
    (c as any)._label = label;
    c.add([shadow, sprite, plateShadow, plate, label]);
    return c;
  }

  private updatePlayerContainer(cont: Phaser.GameObjects.Container, p: PlayerSprite) {
    const label = (cont as any)._label as Phaser.GameObjects.Text | undefined;
    if (label) label.setText((p.isMe ? "◆ " : "") + p.name);
    const sprite = (cont as any)._sprite as Phaser.GameObjects.Sprite | undefined;
    if (sprite) {
      const isMe = p.isMe;
      const atlas = isMe ? (this.textures.exists("currentPlayerHD") ? "currentPlayerHD" : "currentPlayer") : (this.textures.exists("playersHD") ? "playersHD" : "players");
      const frameMap: any = isMe ? { down: "misa-front", up: "misa-back", left: "misa-left", right: "misa-right" } : { down: "bob_front.png", up: "bob_back.png", left: "bob_left.png", right: "bob_right.png" };
      const f = frameMap[p.direction] ?? frameMap.down;
      try {
        sprite.setTexture(atlas, f);
      } catch {}
    }
  }

  override update(_time: number, _delta: number) {
    if (!this.myContainer || !this.playerGroup || !this.npcGroup) return;
    this.updateNearby();
    if (this.moving) return;
    const c = this.cursors;
    const left = (c?.left?.isDown ?? false) || this.keyA?.isDown;
    const right = (c?.right?.isDown ?? false) || this.keyD?.isDown;
    const up = (c?.up?.isDown ?? false) || this.keyW?.isDown;
    const down = (c?.down?.isDown ?? false) || this.keyS?.isDown;
    const activeTag = (document.activeElement?.tagName || "").toLowerCase();
    const isTyping = activeTag === "input" || activeTag === "textarea" || activeTag === "select";
    if (isTyping) return;
    if (left) this.tryGridMove("left");
    else if (right) this.tryGridMove("right");
    else if (up) this.tryGridMove("up");
    else if (down) this.tryGridMove("down");
    if (Phaser.Input.Keyboard.JustDown(this.keyE) || Phaser.Input.Keyboard.JustDown(this.keyEnter)) this.tryInteract();
  }

  private tryGridMove(dir: PlayerSprite["direction"]) {
    if (this.moving || !this.myContainer) return;
    const step = 32;
    let nx = this.myContainer.x;
    let ny = this.myContainer.y;
    if (dir === "left") nx -= step;
    if (dir === "right") nx += step;
    if (dir === "up") ny -= step;
    if (dir === "down") ny += step;
    // clamp inside walls
    nx = Phaser.Math.Clamp(nx, 28, this.roomW - 28);
    ny = Phaser.Math.Clamp(ny, 28, this.roomH - 28);
    // wall collision (extra check for door gap)
    const isAtDoorGap = nx > this.exitDoor.x - 36 && nx < this.exitDoor.x + 36 && ny > this.exitDoor.y - 24;
    if (!isAtDoorGap) {
      for (const wr of this.wallRects) {
        if (nx > wr.x - wr.w / 2 - 10 && nx < wr.x + wr.w / 2 + 10 && ny > wr.y - wr.h / 2 - 10 && ny < wr.y + wr.h / 2 + 10) return;
      }
    }
    // block on NPCs
    for (const n of this.npcsData) {
      if (Math.abs(nx - n.x) < 26 && Math.abs(ny - n.y) < 26) return;
    }
    this.moving = true;
    const animKey = dir === "up" ? "misa-back-walk" : dir === "down" ? "misa-front-walk" : dir === "left" ? "misa-left-walk" : "misa-right-walk";
    try {
      if (this.anims.exists(animKey) && this.mySprite) this.mySprite.play(animKey, true);
    } catch {}
    this.time.delayedCall(500, () => {
      if (this.moving) this.moving = false;
    });
    this.tweens.add({
      targets: this.myContainer,
      x: nx,
      y: ny,
      duration: 165,
      ease: "Linear",
      onComplete: () => {
        this.moving = false;
        if (this.mySprite) {
          try {
            this.mySprite.anims.stop();
          } catch {}
          const idleMap: any = { up: "misa-back", down: "misa-front", left: "misa-left", right: "misa-right" };
          const atlas = this.textures.exists("currentPlayerHD") ? "currentPlayerHD" : "currentPlayer";
          try {
            this.mySprite.setTexture(atlas, idleMap[dir]);
          } catch {}
        }
        this.myContainer?.setDepth((this.myContainer?.y ?? 0) + 30);
        try {
          this.callbacks?.onMove?.(nx, ny, dir);
        } catch {}
      },
      onCompleteScope: this,
    });
  }

  private updateNearby() {
    if (!this.myContainer || !this.interactText || !this.interactBg) return;
    const exitDist = Phaser.Math.Distance.Between(this.myContainer.x, this.myContainer.y, this.exitDoor.x, this.exitDoor.y - 6);
    this.nearExit = exitDist < 56;

    // find closest NPC
    let closest: string | null = null;
    let best = 64;
    for (const n of this.npcsData) {
      const d = Phaser.Math.Distance.Between(this.myContainer.x, this.myContainer.y, n.x, n.y);
      if (d < best) {
        best = d;
        closest = n.id;
      }
    }
    this.nearbyNpcId = closest;
    this.nearSensei = closest === "dojo-sensei";

    if (this.nearExit) {
      this.interactBg.setPosition(this.exitDoor.x, this.exitDoor.y - 30);
      this.interactText.setPosition(this.exitDoor.x, this.exitDoor.y - 30);
      this.interactBg.setSize(150, 22);
      this.interactText.setText("ENTER  •  EXIT DOJO");
      this.interactBg.setVisible(true);
      this.interactText.setVisible(true);
      return;
    }
    if (closest) {
      const cont = this.npcGroup.get(closest);
      if (cont) {
        const isMain = closest === "dojo-sensei";
        this.interactBg.setPosition(cont.x, cont.y - 54);
        this.interactText.setPosition(cont.x, cont.y - 54);
        this.interactBg.setSize(isMain ? 190 : 140, 22);
        this.interactText.setText(isMain ? "ENTER  •  TRAIN WITH SENSEI" : "ENTER  •  TALK");
        this.interactBg.setVisible(true);
        this.interactText.setVisible(true);
      }
    } else {
      this.interactBg.setVisible(false);
      this.interactText.setVisible(false);
    }
  }

  private tryInteract() {
    if (Date.now() - this.lastInteractAt < 280) return;
    this.lastInteractAt = Date.now();
    if (this.nearExit) {
      this.handleExit();
      return;
    }
    if (this.nearSensei) {
      this.callbacks?.onTalkSensei?.();
      return;
    }
    if (this.nearbyNpcId) {
      // for non-main, still allow talk (future: show dialog)
      if (this.nearbyNpcId === "dojo-sensei") this.callbacks?.onTalkSensei?.();
      else this.callbacks?.onTalkNpc?.(this.nearbyNpcId);
    }
  }

  private handleNpcClick(id: string) {
    if (Date.now() - this.lastInteractAt < 280) return;
    this.lastInteractAt = Date.now();
    if (id === "dojo-sensei") this.callbacks?.onTalkSensei?.();
    else this.callbacks?.onTalkNpc?.(id);
  }

  private handleExit() {
    if (Date.now() - this.lastInteractAt < 200) {
      // still allow exit but debounce slightly longer after rapid — prevent double trigger
      // if already recently, ignore second
      // we still proceed if user explicitly spams? allow once per 280ms in tryInteract, so here we enforce 280
      const dt = Date.now() - this.lastInteractAt;
      if (dt < 280) return;
    }
    this.lastInteractAt = Date.now();
    // instant exit — previous fadeOut left screen black and blocked input for 220ms, caused “dark screen” confusion
    try { this.callbacks?.onExitDojo?.(); } catch {}
  }

  public isNearExit(x: number, y: number): boolean {
    return Phaser.Math.Distance.Between(x, y, this.exitDoor.x, this.exitDoor.y) < 56;
  }
}
