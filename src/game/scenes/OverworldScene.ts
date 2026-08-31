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

type NpcSprite = {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  introLine: string;
};

export type OverworldCallbacks = {
  onMove: (x: number, y: number, dir: PlayerSprite["direction"]) => void;
  onInteractNpc: (npcId: string) => void;
};

export class OverworldScene extends Phaser.Scene {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;
  private keyEnter!: Phaser.Input.Keyboard.Key;

  private myId: string | null = null;
  private callbacks: OverworldCallbacks | null = null;

  private playerGroup!: Map<string, Phaser.GameObjects.Container>;
  private npcGroup!: Map<string, Phaser.GameObjects.Container>;
  private myContainer: Phaser.GameObjects.Container | null = null;
  private mySprite: Phaser.GameObjects.Sprite | null = null;

  // PokeMMO Tiled world
  private map!: Phaser.Tilemaps.Tilemap;
  private worldLayer: any = null;
  private aboveLayer: any = null;
  private mapWidth = 1600;
  private mapHeight = 1200;
  private houseRects: { x: number; y: number; w: number; h: number }[] = [
    { x: 180, y: 160, w: 84, h: 64 },
    { x: 1120, y: 180, w: 84, h: 64 },
    { x: 200, y: 700, w: 84, h: 64 },
    { x: 1040, y: 680, w: 84, h: 64 },
  ];
  private treeRects: { x: number; y: number; w: number; h: number }[] = [];

  private npcsData: NpcSprite[] = [];
  private nearbyNpcId: string | null = null;
  private interactText: Phaser.GameObjects.Text | null = null;
  private interactBg: Phaser.GameObjects.Rectangle | null = null;

  private chatBubbles: Map<string, Phaser.GameObjects.Text> = new Map();
  private chatTimers: Map<string, Phaser.Time.TimerEvent> = new Map();

  private moving = false;

  constructor() {
    super("OverworldScene");
  }

  init(data: { myId: string | null; callbacks: OverworldCallbacks }) {
    this.myId = data.myId ?? null;
    this.callbacks = data.callbacks ?? null;
  }
  setCallbacks(cb: OverworldCallbacks) { this.callbacks = cb; }
  setMyId(id: string) { this.myId = id; }

  preload() {
    // PokeMMO-Online assets - Tiled town + tuxmon 32px extruded + player atlases
    // Original repo: aaron5670/PokeMMO-Online-Realtime-Multiplayer-Game (Phaser 3 + Colyseus)
    // We keep only open-world + NPC dialog, no WildEncounter/Battle
    this.load.image("TilesTown", "/assets/tilesets/tuxmon-sample-32px-extruded.png");
    this.load.tilemapTiledJSON("town", "/assets/tilemaps/town.json");
    this.load.atlas("currentPlayer", "/assets/atlas/atlas.png", "/assets/atlas/atlas.json");
    this.load.atlas("players", "/assets/atlas/players.png", "/assets/atlas/players.json");
    // Fallback Kenney for NPCs if needed
    this.load.spritesheet("chars", "/assets/characters/roguelike.png", { frameWidth: 16, frameHeight: 16, margin: 1, spacing: 1 });
  }

  create() {
    this.playerGroup = new Map();
    this.npcGroup = new Map();

    this.createWorld();
    this.createAnimations();
    this.setupInput();
    this.setupCamera();
    this.events.emit("ready");
  }

  private createWorld() {
    // Load Tiled town map - landscape 16:9, 32px tiles, multiple layers (PokeMMO-Online)
    try {
      this.map = this.make.tilemap({ key: "town" });
      const tileset = this.map.addTilesetImage("tuxmon-sample-32px-extruded", "TilesTown");
      if (!tileset) throw new Error("Tileset not found");
      const belowLayer = this.map.createLayer("Below Player", tileset, 0, 0);
      this.worldLayer = this.map.createLayer("World", tileset, 0, 0) as any;
      this.map.createLayer("Grass", tileset, 0, 0);
      this.aboveLayer = this.map.createLayer("Above Player", tileset, 0, 0) as any;
      if (this.worldLayer) this.worldLayer.setCollisionByProperty({ collides: true });
      if (this.aboveLayer) this.aboveLayer.setDepth(10);
      this.mapWidth = this.map.widthInPixels;
      this.mapHeight = this.map.heightInPixels;
      this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
      if (belowLayer) belowLayer.setDepth(0);
      // Tiled handles house/tree collisions via tiles, no manual rects needed
      this.houseRects = [];
      this.treeRects = [];
    } catch (e) {
      console.warn("Tiled town failed, fallback to generated", e);
      this.createFallbackWorld();
    }

    // UI
    const banner = this.add.rectangle(this.mapWidth / 2, 16, 320, 20, 0x3a5a8c, 1);
    banner.setStrokeStyle(3, 0x000000, 1);
    banner.setScrollFactor(0);
    banner.setDepth(60);
    const title = this.add.text(this.mapWidth / 2, 16, "FEYMON TOWN", {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: "7px",
      color: "#fff",
    });
    title.setOrigin(0.5);
    title.setScrollFactor(0);
    title.setDepth(61);

    this.interactBg = this.add.rectangle(0, 0, 110, 16, 0xf8f8f8, 1);
    this.interactBg.setStrokeStyle(3, 0x000000, 1);
    this.interactBg.setDepth(120);
    this.interactBg.setVisible(false);
    this.interactBg.setScrollFactor(0);
    this.interactText = this.add.text(0, 0, "ENTER: TALK", {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: "6px",
      color: "#000",
    });
    this.interactText.setOrigin(0.5);
    this.interactText.setDepth(121);
    this.interactText.setVisible(false);
    this.interactText.setScrollFactor(0);
  }

  private createFallbackWorld() {
    // Generated fallback - FireRed palette, 32px tiles
    const cols = Math.ceil(1600 / 32);
    const rows = Math.ceil(1200 / 32);
    const g = this.add.graphics();
    g.fillStyle(0xa8d080, 1);
    g.fillRect(0, 0, 32, 32);
    g.generateTexture("fallback-grass", 32, 32);
    g.clear();
    g.fillStyle(0xe8d8a8, 1);
    g.fillRect(0, 0, 32, 32);
    g.generateTexture("fallback-path", 32, 32);
    g.destroy();
    this.mapWidth = 1600;
    this.mapHeight = 1200;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const onPath = y === 9 || y === 19 || x === 12 || x === 28;
        const key = onPath ? "fallback-path" : "fallback-grass";
        this.add.image(x * 32 + 16, y * 32 + 16, key).setDepth(0);
      }
    }
    // Houses - FireRed style, also set rects for collision
    this.houseRects = [
      { x: 180, y: 160, w: 84, h: 64 },
      { x: 1120, y: 180, w: 84, h: 64 },
      { x: 200, y: 700, w: 84, h: 64 },
      { x: 1040, y: 680, w: 84, h: 64 },
    ];
    this.treeRects = [];
    for (const h of this.houseRects) {
      const bg = this.add.rectangle(h.x, h.y, 72, 56, 0xf8f8f8, 1);
      bg.setStrokeStyle(4, 0x000000, 1);
      bg.setDepth(h.y);
      const roof = this.add.rectangle(h.x, h.y - 22, 78, 18, 0xc03028, 1);
      roof.setStrokeStyle(3, 0x000000, 1);
      roof.setDepth(h.y + 1);
    }
    // Trees fallback
    for (let i = 0; i < 30; i++) {
      const tx = 80 + Math.random() * (this.mapWidth - 160);
      const ty = 80 + Math.random() * (this.mapHeight - 160);
      if (this.houseRects.some((h) => Math.hypot(tx - h.x, ty - h.y) < 80)) continue;
      const t = this.add.ellipse(tx, ty, 28, 28, 0x2a5a2a, 1);
      t.setStrokeStyle(2, 0x000000, 1);
      t.setDepth(ty + 10);
      this.treeRects.push({ x: tx, y: ty, w: 28, h: 28 });
    }
    this.worldLayer = null as any;
    this.aboveLayer = null;
  }

  private createAnimations() {
    // From PokeMMO Scene1.createAnimations - misa_* and onlinePlayer_*
    const anims = [
      { key: "misa-left-walk", atlas: "currentPlayer", prefix: "misa-left-walk.", start: 0, end: 3 },
      { key: "misa-right-walk", atlas: "currentPlayer", prefix: "misa-right-walk.", start: 0, end: 3 },
      { key: "misa-front-walk", atlas: "currentPlayer", prefix: "misa-front-walk.", start: 0, end: 3 },
      { key: "misa-back-walk", atlas: "currentPlayer", prefix: "misa-back-walk.", start: 0, end: 3 },
      { key: "onlinePlayer-left-walk", atlas: "players", prefix: "bob_left_walk.", start: 0, end: 3, suffix: ".png" },
      { key: "onlinePlayer-right-walk", atlas: "players", prefix: "bob_right_walk.", start: 0, end: 3, suffix: ".png" },
      { key: "onlinePlayer-front-walk", atlas: "players", prefix: "bob_front_walk.", start: 0, end: 3, suffix: ".png" },
      { key: "onlinePlayer-back-walk", atlas: "players", prefix: "bob_back_walk.", start: 0, end: 3, suffix: ".png" },
    ];
    for (const a of anims as any) {
      if (this.anims.exists(a.key)) continue;
      try {
        const cfg: any = { prefix: a.prefix, start: a.start, end: a.end, zeroPad: 3 };
        if ((a as any).suffix) cfg.suffix = (a as any).suffix;
        this.anims.create({
          key: a.key,
          frames: this.anims.generateFrameNames(a.atlas, cfg),
          frameRate: 10,
          repeat: -1,
        });
      } catch {}
    }
    // Idle frames
    for (const dir of ["front", "back", "left", "right"]) {
      const k = `misa-${dir}-idle`;
      if (!this.anims.exists(k)) {
        const frameMap: any = { front: "misa-front", back: "misa-back", left: "misa-left", right: "misa-right" };
        try { this.anims.create({ key: k, frames: [{ key: "currentPlayer", frame: frameMap[dir] }], frameRate: 1 }); } catch {}
      }
    }
  }

  private setupInput() {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.enabled = true;
    try { this.cursors = kb.createCursorKeys(); } catch { this.cursors = null; }
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyEnter = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    kb.on("keydown-E", () => this.tryInteract());
    kb.on("keydown-SPACE", () => this.tryInteract());
    kb.on("keydown-ENTER", () => this.tryInteract());
    // Click to move - grid step like FireRed
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      let near = false;
      for (const n of this.npcsData) if (Phaser.Math.Distance.Between(wp.x, wp.y, n.x, n.y) < 32) near = true;
      if (!near && this.myContainer && !this.moving) {
        const dx = wp.x - this.myContainer.x;
        const dy = wp.y - this.myContainer.y;
        if (Math.abs(dx) > Math.abs(dy)) { if (dx > 0) this.tryGridMove("right"); else this.tryGridMove("left"); }
        else { if (dy > 0) this.tryGridMove("down"); else this.tryGridMove("up"); }
      }
    });
  }

  private setupCamera() {
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.cameras.main.setZoom(0.68);
    this.cameras.main.setRoundPixels(true);
  }

  syncPlayers(players: PlayerSprite[]) {
    if (!this.playerGroup || !this.npcGroup) return;
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
          this.cameras.main.startFollow(cont, true, 0.12, 0.12);
          // enable physics collider for my player if worldLayer exists
          if (this.worldLayer && this.mySprite) {
            // Use container for follow, but sprite for physics - we keep container as visual, add invisible physics body via container
            // For simplicity, keep container as is, add arcade body to container via physics
            try { this.physics.add.existing(cont as any); (cont as any).body.setSize(16, 16); (cont as any).body.setOffset(-8, -4); } catch {}
          }
        }
      } else {
        this.updatePlayerContainer(cont, p);
      }
      if (!p.isMe) {
        const dist = Phaser.Math.Distance.Between(cont.x, cont.y, p.x, p.y);
        if (dist > 120) {
          this.tweens.killTweensOf(cont);
          cont.setPosition(p.x, p.y);
        } else if (dist > 1) {
          this.tweens.killTweensOf(cont);
          // play walk for remote
          const dir = p.direction;
          const sprite = (cont as any)._sprite as Phaser.GameObjects.Sprite | undefined;
          if (sprite) {
            const key = `onlinePlayer-${dir === "up" ? "back" : dir === "down" ? "front" : dir}-walk`;
            if (this.anims.exists(key)) sprite.play(key, true);
          }
          this.tweens.add({
            targets: cont, x: p.x, y: p.y, duration: 180, ease: "Linear",
            onComplete: () => {
              const s = (cont as any)._sprite as Phaser.GameObjects.Sprite | undefined;
              if (s) s.anims.stop();
            },
          });
        } else {
          const sprite = (cont as any)._sprite as Phaser.GameObjects.Sprite | undefined;
          if (sprite) sprite.anims.stop();
        }
      } else {
        // local authoritative, only dir - set idle frame
        const sprite = (cont as any)._sprite as Phaser.GameObjects.Sprite | undefined;
        if (sprite) {
          const idleMap: any = { up: "misa-back", down: "misa-front", left: "misa-left", right: "misa-right" };
          try { sprite.setTexture("currentPlayer", idleMap[p.direction] ?? "misa-front"); } catch {}
        }
      }
      cont.setDepth(cont.y + 30);
    }
    for (const [id, cont] of this.playerGroup.entries()) {
      if (!seen.has(id)) {
        if (id === this.myId) continue;
        cont.destroy();
        this.playerGroup.delete(id);
        const b = this.chatBubbles.get(id);
        if (b) { b.destroy(); this.chatBubbles.delete(id); this.chatTimers.get(id)?.remove(); this.chatTimers.delete(id); }
      }
    }
  }

  syncNpcs(npcs: NpcSprite[]) {
    if (!this.npcGroup || !this.playerGroup) return;
    this.npcsData = npcs;
    const seen = new Set<string>();
    for (const n of npcs) {
      seen.add(n.id);
      if (!this.npcGroup.has(n.id)) {
        const cont = this.createNpcContainer(n);
        this.npcGroup.set(n.id, cont);
      }
    }
    for (const [id, cont] of this.npcGroup.entries()) {
      if (!seen.has(id)) { cont.destroy(); this.npcGroup.delete(id); }
    }
  }

  private createPlayerContainer(p: PlayerSprite): Phaser.GameObjects.Container {
    const c = this.add.container(p.x, p.y);
    const shadow = this.add.ellipse(0, 12, 14, 6, 0x000000, 0.22);
    // Use PokeMMO atlas - misa_* for me, bob_* for others (but we use misa for all with tint fallback)
    let sprite: Phaser.GameObjects.Sprite;
    const isMe = p.isMe;
    const atlas = isMe ? "currentPlayer" : "players";
    const frameMap: any = {
      down: isMe ? "misa-front" : "bob_front_walk.000.png",
      up: isMe ? "misa-back" : "bob_back_walk.000.png",
      left: isMe ? "misa-left" : "bob_left_walk.000.png",
      right: isMe ? "misa-right" : "bob_right_walk.000.png",
    };
    const frame = frameMap[p.direction] ?? frameMap.down;
    try {
      sprite = this.add.sprite(0, -8, atlas, frame);
      sprite.setScale(1);
    } catch {
      sprite = this.add.sprite(0, -8, "currentPlayer", "misa-front");
    }
    (c as any)._sprite = sprite;
    // Color tint for other players
    if (!isMe) {
      try { sprite.setTint(Phaser.Display.Color.HexStringToColor(p.color).color); } catch {}
    }
    const nameW = Math.max(48, p.name.length * 6 + 14);
    const plate = this.add.rectangle(0, -28, nameW, 12, isMe ? 0xffcb05 : 0x000000, isMe ? 1 : 0.85);
    plate.setStrokeStyle(2, isMe ? 0x000000 : 0xffffff, 1);
    const label = this.add.text(0, -28, (isMe ? "▶ " : "") + p.name, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: "6px",
      color: isMe ? "#000" : "#fff",
    });
    label.setOrigin(0.5);
    (c as any)._label = label;
    c.add([shadow, sprite, plate, label]);
    return c;
  }

  private updatePlayerContainer(cont: Phaser.GameObjects.Container, p: PlayerSprite) {
    const label = (cont as any)._label as Phaser.GameObjects.Text | undefined;
    if (label) label.setText(((p.isMe ? "▶ " : "") + p.name));
    const sprite = (cont as any)._sprite as Phaser.GameObjects.Sprite | undefined;
    if (sprite) {
      const isMe = p.isMe;
      const frameMap: any = isMe ? { down: "misa-front", up: "misa-back", left: "misa-left", right: "misa-right" } : { down: "bob_front_walk.000.png", up: "bob_back_walk.000.png", left: "bob_left_walk.000.png", right: "bob_right_walk.000.png" };
      const f = frameMap[p.direction] ?? frameMap.down;
      try { sprite.setTexture(isMe ? "currentPlayer" : "players", f); } catch {}
    }
  }

  private createNpcContainer(n: NpcSprite): Phaser.GameObjects.Container {
    const c = this.add.container(n.x, n.y);
    const mat = this.add.ellipse(0, 16, 26, 10, 0xffcb05, 0.28);
    mat.setStrokeStyle(1, 0xf59e0b, 0.6);
    this.tweens.add({ targets: mat, scaleX: 1.12, scaleY: 1.12, duration: 900, yoyo: true, repeat: -1 });
    const shadow = this.add.ellipse(0, 12, 16, 6, 0x000000, 0.18);
    let sprite: Phaser.GameObjects.Sprite;
    // Use characters.png as NPC - fallback to atlas
    if (this.textures.exists("npcs")) {
      sprite = this.add.sprite(0, -6, "npcs", 0);
      sprite.setScale(1);
      sprite.setTint(Phaser.Display.Color.HexStringToColor(n.color).color);
    } else {
      sprite = this.add.sprite(0, -6, "currentPlayer", "misa-front");
      sprite.setTint(Phaser.Display.Color.HexStringToColor(n.color).color);
    }
    const nw = Math.max(56, n.name.length * 5.5 + 14);
    const plate = this.add.rectangle(0, -28, nw, 12, 0x000000, 0.88);
    plate.setStrokeStyle(2, 0xffcb05, 1);
    const label = this.add.text(0, -28, n.name, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: "5px",
      color: "#fff",
    });
    label.setOrigin(0.5);
    const exBg = this.add.rectangle(12, -18, 12, 12, 0xfff8c0, 1);
    exBg.setStrokeStyle(2, 0x000000, 1);
    const ex = this.add.text(12, -18, "!", {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: "7px",
      color: "#c00",
    });
    ex.setOrigin(0.5);
    this.tweens.add({ targets: ex, y: -17, duration: 600, yoyo: true, repeat: -1 });
    c.add([mat, shadow, sprite, plate, label, exBg, ex]);
    c.setDepth(n.y + 25);
    const hit = this.add.rectangle(0, 0, 32, 32, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on("pointerdown", () => this.callbacks?.onInteractNpc(n.id));
    c.setScale(1);
    return c;
  }

  showChatBubble(playerId: string, text: string) {
    if (!this.playerGroup) return;
    const cont = this.playerGroup.get(playerId);
    if (!cont) return;
    const old = this.chatBubbles.get(playerId);
    if (old) old.destroy();
    this.chatTimers.get(playerId)?.remove();
    const bubble = this.add.text(cont.x, cont.y - 34, text.slice(0, 70), {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: "6px",
      color: "#000",
      backgroundColor: "#fff",
      padding: { x: 6, y: 4 },
      wordWrap: { width: 120 },
    });
    bubble.setOrigin(0.5, 1);
    bubble.setDepth(300);
    bubble.setStroke("#000", 2);
    this.chatBubbles.set(playerId, bubble);
    this.tweens.add({ targets: bubble, y: cont.y - 40, duration: 200 });
    const timer = this.time.delayedCall(3600, () => {
      if (!bubble.scene) return;
      this.tweens.add({
        targets: bubble, alpha: 0, y: bubble.y - 8, duration: 240,
        onComplete: () => { bubble.destroy(); this.chatBubbles.delete(playerId); this.chatTimers.delete(playerId); },
      });
    });
    this.chatTimers.set(playerId, timer);
  }

  override update(_time: number, _delta: number) {
    if (!this.myContainer || !this.playerGroup || !this.npcGroup) return;
    this.updateNearby();
    for (const [pid, b] of this.chatBubbles.entries()) {
      const cont = this.playerGroup.get(pid);
      if (cont) b.setPosition(cont.x, cont.y - 40);
    }
    if (this.moving) return;
    const c = this.cursors;
    const left = (c?.left?.isDown ?? false) || this.keyA?.isDown;
    const right = (c?.right?.isDown ?? false) || this.keyD?.isDown;
    const up = (c?.up?.isDown ?? false) || this.keyW?.isDown;
    const down = (c?.down?.isDown ?? false) || this.keyS?.isDown;
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
    nx = Phaser.Math.Clamp(nx, 16, this.mapWidth - 16);
    ny = Phaser.Math.Clamp(ny, 16, this.mapHeight - 16);
    // Collision: Tiled worldLayer + houses/trees/NPCs
    if (this.worldLayer) {
      try {
        const tile = this.worldLayer.getTileAtWorldXY(nx, ny, true) as any;
        if (tile && tile.properties && (tile.properties as any).collides) return;
        const feet = this.worldLayer.getTileAtWorldXY(nx, ny + 8, true) as any;
        if (feet && feet.properties && (feet.properties as any).collides) return;
      } catch {}
    }
    // Houses manual (fallback + Tiled extra)
    for (const h of this.houseRects) {
      if (nx > h.x - h.w / 2 - 8 && nx < h.x + h.w / 2 + 8 && ny > h.y - h.h / 2 - 8 && ny < h.y + h.h / 2 + 8) return;
    }
    for (const t of this.treeRects) {
      if (nx > t.x - t.w / 2 - 6 && nx < t.x + t.w / 2 + 6 && ny > t.y - t.h / 2 - 6 && ny < t.y + t.h / 2 + 6) return;
    }
    for (const n of this.npcsData) {
      if (Math.abs(nx - n.x) < 20 && Math.abs(ny - n.y) < 20) return;
    }
    this.moving = true;
    const animKey = dir === "up" ? "misa-back-walk" : dir === "down" ? "misa-front-walk" : dir === "left" ? "misa-left-walk" : "misa-right-walk";
    try {
      if (this.anims.exists(animKey) && this.mySprite) this.mySprite.play(animKey, true);
    } catch (e) { console.warn("anim play failed", animKey, e); }
    // safety: reset moving after 400ms if tween fails
    this.time.delayedCall(500, () => { if (this.moving) this.moving = false; });
    this.tweens.add({
      targets: this.myContainer,
      x: nx,
      y: ny,
      duration: 180,
      ease: "Linear",
      onComplete: () => {
        this.moving = false;
        if (this.mySprite) {
          try { this.mySprite.anims.stop(); } catch {}
          const idleMap: any = { up: "misa-back", down: "misa-front", left: "misa-left", right: "misa-right" };
          try { this.mySprite.setTexture("currentPlayer", idleMap[dir]); } catch {}
        }
        this.myContainer?.setDepth((this.myContainer?.y ?? 0) + 30);
        try { this.callbacks?.onMove(nx, ny, dir); } catch {}
      },
      onCompleteScope: this,
    });
  }

  private updateNearby() {
    if (!this.myContainer || !this.interactText || !this.interactBg) return;
    let closest: string | null = null;
    let best = 48;
    for (const n of this.npcsData) {
      const d = Phaser.Math.Distance.Between(this.myContainer.x, this.myContainer.y, n.x, n.y);
      if (d < best) { best = d; closest = n.id; }
    }
    this.nearbyNpcId = closest;
    if (closest) {
      const cont = this.npcGroup.get(closest);
      if (cont) {
        this.interactBg.setPosition(cont.x, cont.y - 30);
        this.interactText.setPosition(cont.x, cont.y - 30);
        this.interactBg.setVisible(true);
        this.interactText.setVisible(true);
      }
    } else {
      this.interactBg.setVisible(false);
      this.interactText.setVisible(false);
    }
  }

  private tryInteract() {
    if (this.nearbyNpcId) this.callbacks?.onInteractNpc(this.nearbyNpcId);
  }
}
