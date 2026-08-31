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
  private keySpace!: Phaser.Input.Keyboard.Key;

  private myId: string | null = null;
  private callbacks: OverworldCallbacks | null = null;

  private playerGroup!: Map<string, Phaser.GameObjects.Container>;
  private npcGroup!: Map<string, Phaser.GameObjects.Container>;
  private myContainer: Phaser.GameObjects.Container | null = null;

  private lastMoveSent = 0;
  private moveSpeed = 165;
  private mapWidth = 1600;
  private mapHeight = 1200;

  private npcsData: NpcSprite[] = [];
  private nearbyNpcId: string | null = null;
  private interactText: Phaser.GameObjects.Text | null = null;
  private interactBg: Phaser.GameObjects.Rectangle | null = null;

  private chatBubbles: Map<string, Phaser.GameObjects.Text> = new Map();
  private chatTimers: Map<string, Phaser.Time.TimerEvent> = new Map();

  // cache for collision
  private houseRects: { x: number; y: number; w: number; h: number }[] = [];
  private targetPos: { x: number; y: number } | null = null;
  private targetMarker: Phaser.GameObjects.Arc | null = null;

  constructor() {
    super("OverworldScene");
  }

  // Kenney CC0 assets - replaceable: drop your own PNGs into public/assets/characters/ and update these paths
  // Current: roguelike 16x16 with 1px margin/spacing, 54x12 grid. To use custom art, keep same frame size or update preload.
  private CHAR_FRAMES: Record<string, number> = {
    "#0ea5e9": 0, // blue
    "#ef4444": 7, // red
    "#10b981": 14, // green
    "#f59e0b": 21, // amber
    "#8b5cf6": 28, // violet
    "#ec4899": 35, // pink
  };
  private NPC_FRAMES: Record<string, number> = {
    "Prof. Oak": 96,
    "Curious Maya": 85,
    "Rival Kai": 42,
    "Stargazer Nova": 112,
    "Coder Lin": 64,
    "Nurse Joy": 78,
  };

  init(data: { myId: string | null; callbacks: OverworldCallbacks }) {
    this.myId = data.myId ?? null;
    this.callbacks = data.callbacks ?? null;
  }

  // Allow React to update callbacks without scene restart
  setCallbacks(cb: OverworldCallbacks) {
    this.callbacks = cb;
  }
  setMyId(id: string) {
    this.myId = id;
  }

  preload() {
    // Better character assets - Kenney CC0. You can replace these files:
    // public/assets/characters/roguelike.png -> your own 16x16 spritesheet (keep 1px margin/spacing or adjust below)
    // public/assets/tiles/tiny-town.png -> ground tiles (optional, currently generated)
    this.load.spritesheet("chars", "/assets/characters/roguelike.png", {
      frameWidth: 16,
      frameHeight: 16,
      margin: 1,
      spacing: 1,
    });
    // Also load a fallback single tile for debugging if needed
    this.load.image("tiny-town", "/assets/tiles/tiny-town.png");
  }

  create() {
    this.playerGroup = new Map();
    this.npcGroup = new Map();
    this.houseRects = [
      { x: 180, y: 160, w: 84, h: 64 },
      { x: 1120, y: 180, w: 84, h: 64 },
      { x: 200, y: 700, w: 84, h: 64 },
      { x: 1040, y: 680, w: 84, h: 64 },
    ];

    this.createTextures();
    this.buildWorld();
    this.setupInput();
    this.setupCamera();

    this.events.emit("ready");
  }

  private createTextures() {
    // --- Grass base
    const g = this.add.graphics();
    g.fillStyle(0xa8d86e, 1);
    g.fillRect(0, 0, 32, 32);
    // subtle grid
    g.fillStyle(0x9bcf5f, 0.9);
    g.fillRect(0, 31, 32, 1);
    g.fillRect(31, 0, 1, 32);
    // tufts
    g.fillStyle(0x8bc34a, 1);
    g.fillCircle(8, 10, 1.2);
    g.fillCircle(22, 18, 1);
    g.fillCircle(14, 24, 0.8);
    g.generateTexture("t_grass", 32, 32);
    g.clear();

    // Grass variation with tiny flower
    g.fillStyle(0xa8d86e, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x9bcf5f, 0.9);
    g.fillRect(0, 31, 32, 1);
    g.fillRect(31, 0, 1, 32);
    g.fillStyle(0xfef3c7, 1);
    g.fillCircle(16, 16, 2);
    g.fillStyle(0xfde68a, 1);
    g.fillCircle(16, 16, 0.9);
    g.generateTexture("t_grass_f", 32, 32);
    g.clear();

    // Path - warm sand with speckles and border
    g.fillStyle(0xf3e0a8, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xe6c98a, 1);
    g.fillCircle(6, 9, 1);
    g.fillCircle(19, 14, 1.1);
    g.fillCircle(24, 26, 0.7);
    g.fillStyle(0xd9b97a, 0.35);
    g.fillRect(0, 0, 32, 2);
    g.generateTexture("t_path", 32, 32);
    g.clear();

    // Path edge (darker border)
    g.fillStyle(0xf3e0a8, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xc9a86a, 1);
    g.fillRect(0, 28, 32, 4);
    g.fillCircle(10, 10, 1);
    g.generateTexture("t_path_edge", 32, 32);
    g.clear();

    // Water
    g.fillStyle(0x38bdf8, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x0ea5e9, 1);
    g.fillRect(0, 0, 32, 4);
    g.fillStyle(0x7dd3fc, 0.7);
    g.fillCircle(10, 18, 5);
    g.fillCircle(22, 22, 3.5);
    g.fillStyle(0xe0f2fe, 0.5);
    g.fillCircle(14, 14, 1);
    g.generateTexture("t_water", 32, 32);
    g.clear();

    // Deep water edge
    g.fillStyle(0x0284c7, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x0ea5e9, 1);
    g.fillCircle(12, 12, 6);
    g.generateTexture("t_water_deep", 32, 32);
    g.clear();

    // Tree - more detailed
    g.fillStyle(0x14532d, 1);
    g.fillCircle(16, 12, 11);
    g.fillCircle(10, 16, 7);
    g.fillCircle(22, 16, 7);
    g.fillStyle(0x15803d, 1);
    g.fillCircle(16, 10, 7);
    g.fillCircle(13, 13, 3);
    g.fillStyle(0x78350f, 1);
    g.fillRect(13, 19, 6, 12);
    g.fillStyle(0x92400e, 1);
    g.fillRect(13, 19, 6, 3);
    g.generateTexture("s_tree", 32, 32);
    g.clear();

    // Small pine
    g.fillStyle(0x14532d, 1);
    g.fillTriangle(16, 4, 7, 24, 25, 24);
    g.fillTriangle(16, 10, 10, 22, 22, 22);
    g.fillStyle(0x166534, 1);
    g.fillTriangle(16, 4, 9, 20, 23, 20);
    g.fillStyle(0x78350f, 1);
    g.fillRect(14, 22, 4, 8);
    g.generateTexture("s_pine", 32, 32);
    g.clear();

    // House - polished
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(36, 58, 62, 12);
    g.fillStyle(0xfef2f2, 1);
    g.fillRoundedRect(6, 18, 60, 38, 3);
    g.lineStyle(2, 0x1f2937, 1);
    g.strokeRoundedRect(6, 18, 60, 38, 3);
    // roof
    g.fillStyle(0xdc2626, 1);
    g.fillTriangle(2, 18, 36, 2, 70, 18);
    g.lineStyle(1.5, 0x991b1b, 1);
    g.strokeTriangle(2, 18, 36, 2, 70, 18);
    // roof line
    g.lineStyle(1, 0x991b1b, 0.6);
    for (let i = 0; i < 4; i++) g.lineBetween(12 + i * 12, 10, 18 + i * 12, 16);
    // windows
    g.fillStyle(0x38bdf8, 1);
    g.fillRoundedRect(12, 27, 14, 12, 1);
    g.fillRoundedRect(46, 27, 14, 12, 1);
    g.lineStyle(1.5, 0x1f2937, 1);
    g.strokeRoundedRect(12, 27, 14, 12, 1);
    g.strokeRoundedRect(46, 27, 14, 12, 1);
    g.lineBetween(19, 27, 19, 39);
    g.lineBetween(53, 27, 53, 39);
    // window shine
    g.fillStyle(0xffffff, 0.55);
    g.fillRect(14, 29, 4, 3);
    g.fillRect(48, 29, 4, 3);
    // door
    g.fillStyle(0x78350f, 1);
    g.fillRoundedRect(28, 36, 16, 20, 2);
    g.lineStyle(1.5, 0x1f2937, 1);
    g.strokeRoundedRect(28, 36, 16, 20, 2);
    g.fillStyle(0xfbbf24, 1);
    g.fillCircle(40, 46, 1.5);
    // chimney
    g.fillStyle(0x44403c, 1);
    g.fillRect(52, 8, 8, 14);
    g.fillStyle(0x78716c, 1);
    g.fillRect(52, 8, 8, 3);
    g.generateTexture("s_house", 72, 62);
    g.clear();

    // Flower deco
    g.fillStyle(0xf472b6, 1);
    g.fillCircle(6, 6, 2.5);
    g.fillStyle(0xfde68a, 1);
    g.fillCircle(6, 6, 1);
    g.generateTexture("s_flower", 12, 12);
    g.destroy();
  }

  private buildWorld() {
    const cols = Math.ceil(this.mapWidth / 32);
    const rows = Math.ceil(this.mapHeight / 32);

    // Tile layer
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const isEdge = x < 1 || y < 1 || x >= cols - 1 || y >= rows - 1;
        const isDeepEdge = x < 1 || y < 1 || x >= cols - 1 || y >= rows - 1;
        let key = "t_grass";
        if (isDeepEdge) key = y === 1 || x === 1 ? "t_water" : "t_water_deep";
        else if (isEdge) key = "t_water";
        else {
          // path cross
          const onHPath = y === 9 || y === 19;
          const onVPath = x === 12 || x === 28;
          const isPath = onHPath || onVPath;
          if (isPath) {
            // edge of path?
            const isEdgePath = (onHPath && (x === 12 || x === 28)) || (onVPath && (y === 9 || y === 19));
            key = isEdgePath ? "t_path_edge" : "t_path";
          } else {
            // random grass variation 12%
            if (Math.random() < 0.08) key = "t_grass_f";
          }
        }
        const img = this.add.image(x * 32 + 16, y * 32 + 16, key);
        img.setDepth(0);
        // slight random tint for grass
        if (key === "t_grass" && Math.random() < 0.15) img.setTint(0xa3d96a);
      }
    }

    // Houses
    const houses = [
      { x: 180, y: 160 },
      { x: 1120, y: 180 },
      { x: 200, y: 700 },
      { x: 1040, y: 680 },
    ];
    houses.forEach((p) => {
      const img = this.add.image(p.x, p.y, "s_house");
      img.setDepth(p.y);
      img.setOrigin(0.5, 0.5);
    });

    // Trees - denser forest
    const treeCount = 55;
    for (let i = 0; i < treeCount; i++) {
      const usePine = Math.random() < 0.35;
      const tx = 48 + Math.random() * (this.mapWidth - 96);
      const ty = 48 + Math.random() * (this.mapHeight - 96);
      // avoid paths
      if ((Math.abs(ty - 304) < 28 && tx > 60 && tx < 1560) || (Math.abs(ty - 624) < 28) || Math.abs(tx - 400) < 28 || Math.abs(tx - 912) < 28) continue;
      // avoid houses
      let nearHouse = false;
      for (const h of houses) if (Phaser.Math.Distance.Between(tx, ty, h.x, h.y) < 72) nearHouse = true;
      if (nearHouse) continue;

      const key = usePine ? "s_pine" : "s_tree";
      const img = this.add.image(tx, ty, key);
      img.setDepth(ty + 12);
      img.setScale(1 + Math.random() * 0.15);
      // occasional flowers near tree
      if (!usePine && Math.random() < 0.25) {
        const f = this.add.image(tx + 10 + Math.random() * 10, ty + 10, "s_flower");
        f.setDepth(ty + 11);
        f.setScale(0.9);
      }
    }

    // Decorative fences along water edge (visual only)
    // Title banner
    const bannerW = 380;
    const bannerH = 28;
    const bg = this.add.rectangle(800, 42, bannerW, bannerH, 0x0f172a, 0.9);
    bg.setStrokeStyle(2, 0xfbbf24, 1);
    bg.setDepth(60);
    const title = this.add.text(800, 42, "FEYMON VILLAGE  •  ROUTE 1", {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "12px",
      color: "#fef3c7",
      fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(61);
    title.setLetterSpacing(1.2);

    // Sign
    const signBg = this.add.rectangle(360, 300, 86, 22, 0xfffbeb, 1);
    signBg.setStrokeStyle(2, 0x78350f, 1);
    signBg.setDepth(20);
    const sign = this.add.text(360, 300, "→  OAK LAB", {
      fontFamily: "Inter, monospace",
      fontSize: "9px",
      color: "#78350f",
      fontStyle: "bold",
    });
    sign.setOrigin(0.5);
    sign.setDepth(21);

    // Interact prompt (hidden)
    this.interactBg = this.add.rectangle(0, 0, 74, 18, 0x0f172a, 0.95);
    this.interactBg.setStrokeStyle(1, 0xfbbf24, 1);
    this.interactBg.setDepth(120);
    this.interactBg.setVisible(false);
    this.interactText = this.add.text(0, 0, "E  Talk", {
      fontFamily: "Inter, sans-serif",
      fontSize: "11px",
      color: "#fef3c7",
      fontStyle: "bold",
    });
    this.interactText.setOrigin(0.5);
    this.interactText.setDepth(121);
    this.interactText.setVisible(false);
  }

  private setupInput() {
    const kb = this.input.keyboard;
    if (!kb) return;
    // ensure enabled
    kb.enabled = true;

    // cursor keys if available
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
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    kb.on("keydown-SPACE", () => this.tryInteract());
    kb.on("keydown-E", () => this.tryInteract());

    // Click / tap to move — supports "click right" expectation
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      let nearNpc = false;
      for (const n of this.npcsData) {
        if (Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, n.x, n.y) < 28) {
          nearNpc = true;
          break;
        }
      }
      if (!nearNpc) {
        this.targetPos = { x: worldPoint.x, y: worldPoint.y };
        // marker
        if (this.targetMarker) this.targetMarker.destroy();
        this.targetMarker = this.add.circle(worldPoint.x, worldPoint.y, 6, 0x0ea5e9, 0.9);
        this.targetMarker.setStrokeStyle(2, 0xffffff, 1);
        this.targetMarker.setDepth(200);
        this.tweens.add({ targets: this.targetMarker, scale: 1.6, alpha: 0.4, duration: 500, yoyo: true, repeat: 2 });
      }
    });
  }

  private setupCamera() {
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.cameras.main.setZoom(1);
    this.cameras.main.setRoundPixels(true);
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
  }

  // --- Player / NPC sync ---

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
          this.cameras.main.startFollow(cont, true, 0.14, 0.14);
        }
      } else {
        this.updatePlayerContainer(cont, p);
      }

      if (!p.isMe) {
        // remote: smooth - don't kill if already tweening to same target
        const dist = Phaser.Math.Distance.Between(cont.x, cont.y, p.x, p.y);
        if (dist > 140) {
          this.tweens.killTweensOf(cont);
          cont.setPosition(p.x, p.y);
        } else if (dist > 0.5) {
          this.tweens.killTweensOf(cont);
          this.tweens.add({
            targets: cont,
            x: p.x,
            y: p.y,
            duration: 120,
            ease: "Linear",
          });
        }
        this.setContainerDirection(cont, p.direction);
      } else {
        // local player is AUTHORITATIVE - never snap to server to avoid rubber-band
        // only sync direction, keep local pos. Server pos is for other clients.
        this.setContainerDirection(cont, p.direction);
      }
      // depth by y for pseudo-3D
      cont.setDepth(cont.y + 30);
    }

    for (const [id, cont] of this.playerGroup.entries()) {
      if (!seen.has(id)) {
        // never destroy local player - keep authoritative local
        if (id === this.myId) continue;
        cont.destroy();
        this.playerGroup.delete(id);
        // also clean bubble
        const b = this.chatBubbles.get(id);
        if (b) {
          b.destroy();
          this.chatBubbles.delete(id);
          this.chatTimers.get(id)?.remove();
          this.chatTimers.delete(id);
        }
        if (id === this.myId) this.myContainer = null;
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
      if (!seen.has(id)) {
        cont.destroy();
        this.npcGroup.delete(id);
      }
    }
  }

  private createPlayerContainer(p: PlayerSprite): Phaser.GameObjects.Container {
    const c = this.add.container(p.x, p.y);

    const shadow = this.add.ellipse(0, 14, 20, 7, 0x000000, 0.22);

    // Character sprite - Kenney CC0. Frame by color, fallback to generated.
    let char: Phaser.GameObjects.Image | null = null;
    let outline: Phaser.GameObjects.Image | null = null;
    let fallbackBody: Phaser.GameObjects.Graphics | null = null;
    let fallbackHead: Phaser.GameObjects.Graphics | null = null;
    if (this.textures.exists("chars")) {
      const frame = this.CHAR_FRAMES[p.color] ?? 0;
      outline = this.add.image(0, -2, "chars", frame);
      outline.setScale(1.55);
      outline.setTint(0x0f172a);
      outline.setAlpha(0.16);
      outline.setOrigin(0.5, 0.7);
      const img = this.add.image(0, -2, "chars", frame);
      img.setScale(1.45);
      img.setOrigin(0.5, 0.7);
      char = img;
    } else {
      fallbackBody = this.add.graphics();
      const col = Phaser.Display.Color.HexStringToColor(p.color).color;
      fallbackBody.fillStyle(col, 1);
      fallbackBody.fillRoundedRect(-9, -8, 18, 18, 4);
      fallbackBody.lineStyle(2, 0x0f172a, 0.9);
      fallbackBody.strokeRoundedRect(-9, -8, 18, 18, 4);
      fallbackHead = this.add.graphics();
      fallbackHead.fillStyle(0xffe4c4, 1);
      fallbackHead.fillCircle(0, -12, 7);
      fallbackHead.lineStyle(1.5, 0x0f172a, 0.9);
      fallbackHead.strokeCircle(0, -12, 7);
      fallbackHead.fillStyle(0x0f172a, 1);
      fallbackHead.fillCircle(-2.5, -12, 1);
      fallbackHead.fillCircle(2.5, -12, 1);
    }

    const dir = this.add.triangle(0, 0, 0, -5, -4, 4, 4, 0xfbbf24);
    dir.setName("dirTri");
    dir.setStrokeStyle(1, 0x0f172a);

    const nameW = Math.max(58, p.name.length * 7 + 20);
    const plate = this.add.graphics();
    plate.fillStyle(p.isMe ? 0xf59e0b : 0x0f172a, p.isMe ? 1 : 0.92);
    plate.fillRoundedRect(-nameW / 2, -30, nameW, 15, 7);
    plate.lineStyle(1, p.isMe ? 0x78350f : 0x334155, 1);
    plate.strokeRoundedRect(-nameW / 2, -30, nameW, 15, 7);
    plate.setName("plate");

    const label = this.add.text(0, -22.5, (p.isMe ? "◆ " : "") + p.name, {
      fontFamily: "Inter, sans-serif",
      fontSize: "9px",
      color: p.isMe ? "#0b1220" : "#fef3c7",
      fontStyle: "bold",
    });
    label.setOrigin(0.5);
    label.setName("label");

    // Add in correct depth order: shadow -> outline/char -> dir -> plate -> label
    c.add(shadow);
    if (outline) c.add(outline);
    if (char) c.add(char);
    if (fallbackBody) c.add(fallbackBody);
    if (fallbackHead) c.add(fallbackHead);
    c.add(dir);
    c.add(plate);
    c.add(label);

    (c as any)._label = label;
    (c as any)._char = char ?? fallbackBody;
    this.setContainerDirection(c, p.direction);
    return c;
  }

  private updatePlayerContainer(cont: Phaser.GameObjects.Container, p: PlayerSprite) {
    const label = (cont as any)._label as Phaser.GameObjects.Text | undefined;
    if (label && label.text !== ((p.isMe ? "◆ " : "") + p.name)) {
      label.setText((p.isMe ? "◆ " : "") + p.name);
    }
  }

  private setContainerDirection(cont: Phaser.GameObjects.Container, dir: PlayerSprite["direction"]) {
    const tri = cont.getByName("dirTri") as Phaser.GameObjects.Triangle | null;
    if (!tri) return;
    const map: Record<string, number> = { up: 0, right: 90, down: 180, left: 270 };
    tri.setRotation(Phaser.Math.DegToRad(map[dir] ?? 180));
    const off: Record<string, { x: number; y: number }> = {
      up: { x: 0, y: -14 },
      down: { x: 0, y: 10 },
      left: { x: -12, y: 0 },
      right: { x: 12, y: 0 },
    };
    const o = off[dir] ?? off.down;
    tri.setPosition(o.x, o.y);
  }

  private createNpcContainer(n: NpcSprite): Phaser.GameObjects.Container {
    const c = this.add.container(n.x, n.y);
    // ground highlight for visibility
    const mat = this.add.ellipse(0, 16, 30, 14, 0xfbbf24, 0.28);
    mat.setStrokeStyle(1, 0xf59e0b, 0.6);
    this.tweens.add({ targets: mat, scaleX: 1.12, scaleY: 1.12, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    const shadow = this.add.ellipse(0, 14, 22, 8, 0x000000, 0.18);

    // Character sprite - Kenney. Replaceable via public/assets/characters/
    let char: Phaser.GameObjects.Image | null = null;
    let charOutline: Phaser.GameObjects.Image | null = null;
    let fallbackBody: Phaser.GameObjects.Graphics | null = null;
    let fallbackHead: Phaser.GameObjects.Graphics | null = null;
    if (this.textures.exists("chars")) {
      const frame = this.NPC_FRAMES[n.name] ?? 42;
      charOutline = this.add.image(0, -2, "chars", frame);
      charOutline.setScale(1.55);
      charOutline.setTint(0x0f172a);
      charOutline.setAlpha(0.16);
      charOutline.setOrigin(0.5, 0.7);
      char = this.add.image(0, -2, "chars", frame);
      char.setScale(1.45);
      char.setOrigin(0.5, 0.7);
    } else {
      fallbackBody = this.add.graphics();
      const col = Phaser.Display.Color.HexStringToColor(n.color).color;
      fallbackBody.fillStyle(col, 1);
      fallbackBody.fillRoundedRect(-11, -10, 22, 22, 5);
      fallbackBody.lineStyle(2, 0x0f172a, 0.9);
      fallbackBody.strokeRoundedRect(-11, -10, 22, 22, 5);
      fallbackBody.fillStyle(0xffffff, 0.14);
      fallbackBody.fillRoundedRect(-9, -8, 18, 5, 2);
      fallbackHead = this.add.graphics();
      fallbackHead.fillStyle(0xffe4c4, 1);
      fallbackHead.fillCircle(0, -14, 7.5);
      fallbackHead.lineStyle(1.5, 0x0f172a, 0.9);
      fallbackHead.strokeCircle(0, -14, 7.5);
      fallbackHead.fillStyle(0x0f172a, 1);
      fallbackHead.fillCircle(-2.5, -14, 1);
      fallbackHead.fillCircle(2.5, -14, 1);
      fallbackHead.fillStyle(col, 1);
      fallbackHead.fillCircle(0, -18, 7.5);
      fallbackHead.fillRect(-7.5, -18, 15, 4);
    }

    // exclamation
    const exBg = this.add.graphics();
    exBg.fillStyle(0xfef3c7, 1);
    exBg.fillRoundedRect(12, -22, 12, 14, 3);
    exBg.lineStyle(1, 0x78350f, 1);
    exBg.strokeRoundedRect(12, -22, 12, 14, 3);
    const ex = this.add.text(18, -15, "!", {
      fontFamily: "Inter, sans-serif",
      fontSize: "10px",
      color: "#991b1b",
      fontStyle: "bold",
    });
    ex.setOrigin(0.5);
    // bob tween for !
    this.tweens.add({ targets: ex, y: -14.5, duration: 650, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    // name plate
    const nw = Math.max(60, n.name.length * 6.5 + 16);
    const plate = this.add.graphics();
    plate.fillStyle(0x0f172a, 0.95);
    plate.fillRoundedRect(-nw / 2, -34, nw, 13, 6);
    plate.lineStyle(1, 0xfbbf24, 1);
    plate.strokeRoundedRect(-nw / 2, -34, nw, 13, 6);
    const label = this.add.text(0, -27.5, n.name, {
      fontFamily: "Inter, sans-serif",
      fontSize: "8px",
      color: "#fef3c7",
      fontStyle: "bold",
    });
    label.setOrigin(0.5);

    // Add in depth order: mat -> shadow -> outline -> char/fallback -> ex -> plate -> label
    c.add(mat);
    c.add(shadow);
    if (charOutline) c.add(charOutline);
    if (char) c.add(char);
    if (fallbackBody) c.add(fallbackBody);
    if (fallbackHead) c.add(fallbackHead);
    c.add(exBg);
    c.add(ex);
    c.add(plate);
    c.add(label);
    c.setDepth(n.y + 25);
    c.setScale(1.08);

    // bigger hit area
    const hit = this.add.rectangle(0, 0, 28, 28, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on("pointerdown", () => this.callbacks?.onInteractNpc(n.id));
    hit.on("pointerover", () => c.setScale(1.06));
    hit.on("pointerout", () => c.setScale(1));

    (c as any)._npcId = n.id;
    return c;
  }

  showChatBubble(playerId: string, text: string) {
    if (!this.playerGroup) return;
    const cont = this.playerGroup.get(playerId);
    if (!cont) return;

    // clear old
    const old = this.chatBubbles.get(playerId);
    if (old) old.destroy();
    this.chatTimers.get(playerId)?.remove();

    const bubble = this.add.text(cont.x, cont.y - 38, text.slice(0, 90), {
      fontFamily: "Inter, sans-serif",
      fontSize: "11px",
      color: "#0f172a",
      backgroundColor: "#ffffff",
      padding: { x: 8, y: 6 },
      wordWrap: { width: 160 },
      align: "center",
      fontStyle: "bold",
    });
    bubble.setOrigin(0.5, 1);
    bubble.setDepth(300);
    bubble.setStroke("#e2e8f0", 3);
    // tail
    // @ts-ignore - setShadow exists
    bubble.setShadow(0, 4, "rgba(0,0,0,0.15)", 6, false, true);

    this.chatBubbles.set(playerId, bubble);

    this.tweens.add({
      targets: bubble,
      y: cont.y - 44,
      duration: 220,
      ease: "Back.Out",
    });

    const timer = this.time.delayedCall(3800, () => {
      if (!bubble.scene) return;
      this.tweens.add({
        targets: bubble,
        alpha: 0,
        y: bubble.y - 10,
        duration: 260,
        onComplete: () => {
          bubble.destroy();
          this.chatBubbles.delete(playerId);
          this.chatTimers.delete(playerId);
        },
      });
    });
    this.chatTimers.set(playerId, timer);
  }

  override update(time: number, delta: number) {
    if (!this.myContainer || !this.playerGroup || !this.npcGroup) return;

    this.updateNearbyNpcIndicator();
    // keep bubbles attached
    for (const [pid, b] of this.chatBubbles.entries()) {
      const cont = this.playerGroup.get(pid);
      if (cont) b.setPosition(cont.x, cont.y - 44);
    }

    // input - keyboard
    const c = this.cursors;
    const left = (c?.left?.isDown ?? false) || this.keyA?.isDown;
    const right = (c?.right?.isDown ?? false) || this.keyD?.isDown;
    const up = (c?.up?.isDown ?? false) || this.keyW?.isDown;
    const down = (c?.down?.isDown ?? false) || this.keyS?.isDown;

    let vx = 0, vy = 0;
    let dir: PlayerSprite["direction"] = "down";
    if (left) { vx = -1; dir = "left"; }
    else if (right) { vx = 1; dir = "right"; }
    if (up) { vy = -1; dir = "up"; }
    else if (down) { vy = 1; dir = "down"; }
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

    // click-to-move fallback when no keys pressed
    if (vx === 0 && vy === 0 && this.targetPos) {
      const dx = this.targetPos.x - this.myContainer.x;
      const dy = this.targetPos.y - this.myContainer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        this.targetPos = null;
        if (this.targetMarker) { this.targetMarker.destroy(); this.targetMarker = null; }
      } else {
        vx = dx / dist;
        vy = dy / dist;
        if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? "right" : "left";
        else dir = dy > 0 ? "down" : "up";
      }
    } else if (vx !== 0 || vy !== 0) {
      if (this.targetPos) {
        this.targetPos = null;
        if (this.targetMarker) { this.targetMarker.destroy(); this.targetMarker = null; }
      }
    }

    const isMoving = vx !== 0 || vy !== 0;

    if (isMoving) {
      const dt = delta / 1000;
      let nx = this.myContainer.x + vx * this.moveSpeed * dt;
      let ny = this.myContainer.y + vy * this.moveSpeed * dt;

      nx = Phaser.Math.Clamp(nx, 28, this.mapWidth - 28);
      ny = Phaser.Math.Clamp(ny, 28, this.mapHeight - 28);

      // house collision
      let collided = false;
      for (const h of this.houseRects) {
        if (nx > h.x - h.w / 2 - 14 && nx < h.x + h.w / 2 + 14 && ny > h.y - h.h / 2 - 10 && ny < h.y + h.h / 2 + 14) {
          collided = true;
          break;
        }
      }
      // water border
      if (nx < 32 || nx > this.mapWidth - 32 || ny < 32 || ny > this.mapHeight - 32) collided = true;

      if (!collided) {
        this.myContainer.setPosition(nx, ny);
        this.myContainer.setDepth(ny + 30);
        this.setContainerDirection(this.myContainer, dir);
      }

      if (time - this.lastMoveSent > 70) {
        this.lastMoveSent = time;
        this.callbacks?.onMove(this.myContainer.x, this.myContainer.y, dir);
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyE) || Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.tryInteract();
    }
  }

  private updateNearbyNpcIndicator() {
    if (!this.myContainer || !this.interactText || !this.interactBg) return;
    let closest: string | null = null;
    let best = 62;
    for (const n of this.npcsData) {
      const d = Phaser.Math.Distance.Between(this.myContainer.x, this.myContainer.y, n.x, n.y);
      if (d < best) { best = d; closest = n.id; }
    }
    this.nearbyNpcId = closest;
    if (closest) {
      const cont = this.npcGroup.get(closest);
      if (cont) {
        this.interactBg.setPosition(cont.x, cont.y - 42);
        this.interactText.setPosition(cont.x, cont.y - 42);
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
