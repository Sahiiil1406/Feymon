import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { OverworldScene } from "../game/scenes/OverworldScene";

type Player = {
  _id: string;
  name: string;
  color: string;
  level: number;
  xp: number;
};

type Presence = {
  playerId: string;
  x: number;
  y: number;
  direction: "up" | "down" | "left" | "right";
  mapId: string;
};

type Npc = {
  _id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  introLine: string;
};

type Props = {
  myPlayerId: string;
  players: { player: Player; presence: Presence }[];
  npcs: Npc[];
  me?: { player: Player; presence: Presence | null } | null;
  onMove: (x: number, y: number, dir: Presence["direction"]) => void;
  onInteractNpc: (npcId: string) => void;
  onEnterFeynmanTower?: () => void;
  latestChat?: { authorId: string; body: string; _creationTime: number } | null;
};

export default function PhaserGame({
  myPlayerId,
  players,
  npcs,
  me,
  onMove,
  onInteractNpc,
  onEnterFeynmanTower,
  latestChat,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<OverworldScene | null>(null);
  const onMoveRef = useRef(onMove);
  const onInteractRef = useRef(onInteractNpc);
  const onTowerRef = useRef(onEnterFeynmanTower);
  const playersRef = useRef(players);
  const npcsRef = useRef(npcs);
  const meRef = useRef(me);

  onMoveRef.current = onMove;
  onInteractRef.current = onInteractNpc;
  onTowerRef.current = onEnterFeynmanTower;
  playersRef.current = players;
  npcsRef.current = npcs;
  meRef.current = me;

  // Init once
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1280,
      height: 720,
      parent: containerRef.current,
      backgroundColor: "#a7d0a0",
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
      },
      scene: [OverworldScene],
      // HD: keep crisp pixel but render at 1080p canvas, allow smooth scaling
      pixelArt: true,
      antialias: true,
      antialiasGL: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        antialias: true,
        pixelArt: true,
        roundPixels: true,
        transparent: false,
      } as any,
      fps: { target: 60, min: 30 },
      banner: false,
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    const syncCurrent = (scene: OverworldScene) => {
      try {
        const p = playersRef.current ?? [];
        const n = npcsRef.current ?? [];
        const meVal = meRef.current as any;
        // Ensure my player is always synced even if listOnline is empty (offline case)
        let playersToSync = p;
        if (meVal?.player && meVal?.presence) {
          const hasMe = p.some((pp: any) => pp.player._id === myPlayerId);
          if (!hasMe) {
            playersToSync = [
              ...p,
              { player: meVal.player, presence: meVal.presence },
            ] as any;
          }
        }
        if (playersToSync.length) {
          scene.syncPlayers(
            playersToSync.map((pp: any) => ({
              id: pp.player._id,
              name: pp.player.name,
              color: pp.player.color,
              x: pp.presence.x,
              y: pp.presence.y,
              direction: pp.presence.direction,
              isMe: pp.player._id === myPlayerId,
            }))
          );
        } else if (meVal?.player) {
          // Fallback: create my container at spawn if no presence yet
          const spawn = { x: 656, y: 1150, direction: "down" as const };
          scene.syncPlayers([
            {
              id: meVal.player._id,
              name: meVal.player.name,
              color: meVal.player.color,
              x: meVal.presence?.x ?? spawn.x,
              y: meVal.presence?.y ?? spawn.y,
              direction: (meVal.presence?.direction as any) ?? "down",
              isMe: true,
            },
          ]);
        }
        if (n.length) {
          scene.syncNpcs(
            n.map((nn) => ({
              id: nn._id,
              name: nn.name,
              x: nn.x,
              y: nn.y,
              color: nn.color,
              introLine: nn.introLine,
            }))
          );
        }
      } catch {}
    };

    const startScene = () => {
      const scene = game.scene.getScene("OverworldScene") as OverworldScene;
      if (!scene) return false;
      // ensure scene is running
      if (!scene.scene.isActive()) {
        game.scene.start("OverworldScene", {
          myId: myPlayerId,
          callbacks: {
            onMove: (...a: Parameters<Props["onMove"]>) => onMoveRef.current(...a),
            onInteractNpc: (...a: Parameters<Props["onInteractNpc"]>) => onInteractRef.current(...a),
            onEnterFeynmanTower: (...a: any) => (onTowerRef.current as any)?.(...a),
          },
        });
      } else {
        scene.setMyId(myPlayerId);
        scene.setCallbacks({
          onMove: (...a: Parameters<Props["onMove"]>) => onMoveRef.current(...a),
          onInteractNpc: (...a: Parameters<Props["onInteractNpc"]>) => onInteractRef.current(...a),
          onEnterFeynmanTower: (...a: any) => (onTowerRef.current as any)?.(...a),
        });
      }
      const readyScene = game.scene.getScene("OverworldScene") as OverworldScene;
      sceneRef.current = readyScene;
      // wait for scene's create to finish (playerGroup ready) before syncing
      if (readyScene) {
        const trySync = () => {
          // @ts-ignore - check if create has run
          if ((readyScene as any).playerGroup) syncCurrent(readyScene);
          else readyScene.events.once("ready", () => syncCurrent(readyScene));
        };
        if (readyScene.scene.isActive()) trySync();
        else readyScene.events.once("ready", trySync);
      }
      return true;
    };

    // Phaser boot is async
    game.events.once("ready", startScene);
    // fallback poll if ready already fired
    const iv = setInterval(() => {
      if (sceneRef.current) {
        clearInterval(iv);
        return;
      }
      if (startScene()) clearInterval(iv);
    }, 80);
    setTimeout(() => clearInterval(iv), 3000);

    const handleFocus = () => {
      try { (game.canvas as any)?.focus?.(); containerRef.current?.focus(); } catch {}
    };
    containerRef.current?.addEventListener("click", handleFocus);
    // auto-focus for keyboard
    setTimeout(() => handleFocus(), 300);

    return () => {
      clearInterval(iv);
      containerRef.current?.removeEventListener("click", handleFocus);
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, [myPlayerId]);

  // keep callbacks fresh
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setCallbacks({
        onMove: (...a: Parameters<Props["onMove"]>) => onMoveRef.current(...a),
        onInteractNpc: (...a: Parameters<Props["onInteractNpc"]>) => onInteractRef.current(...a),
        onEnterFeynmanTower: (...a: any) => (onTowerRef.current as any)?.(...a),
      });
    }
  }, [onMove, onInteractNpc, onEnterFeynmanTower]);

  // sync players - ensure my player exists even if listOnline is empty (offline)
  useEffect(() => {
    const s = sceneRef.current ?? (gameRef.current?.scene.getScene("OverworldScene") as OverworldScene | null);
    if (!s) return;
    sceneRef.current = s;
    let mapped = players.map((p) => ({
      id: p.player._id,
      name: p.player.name,
      color: p.player.color,
      x: p.presence.x,
      y: p.presence.y,
      direction: p.presence.direction,
      isMe: p.player._id === myPlayerId,
    }));
    const meVal: any = me as any;
    if (meVal?.player && !mapped.some((m) => m.id === myPlayerId)) {
      mapped = [
        ...mapped,
        {
          id: meVal.player._id,
          name: meVal.player.name,
          color: meVal.player.color,
          x: meVal.presence?.x ?? 656,
          y: meVal.presence?.y ?? 1150,
          direction: (meVal.presence?.direction as any) ?? "down",
          isMe: true,
        },
      ];
    }
    if (mapped.length) s.syncPlayers(mapped);
  }, [players, me, myPlayerId]);

  useEffect(() => {
    const s = sceneRef.current ?? (gameRef.current?.scene.getScene("OverworldScene") as OverworldScene | null);
    if (!s) return;
    const mapped = npcs.map((n) => ({
      id: n._id,
      name: n.name,
      x: n.x,
      y: n.y,
      color: n.color,
      introLine: n.introLine,
    }));
    s.syncNpcs(mapped);
  }, [npcs]);

  const lastChatRef = useRef<number | null>(null);
  useEffect(() => {
    if (!latestChat) return;
    const s = sceneRef.current ?? (gameRef.current?.scene.getScene("OverworldScene") as OverworldScene | null);
    if (!s) return;
    if (lastChatRef.current === latestChat._creationTime) return;
    lastChatRef.current = latestChat._creationTime;
    s.showChatBubble(latestChat.authorId, latestChat.body);
  }, [latestChat]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="phaser-wrap phaser-wrap--hd"
      style={{
        width: "100%",
        height: "100%",
        aspectRatio: "16 / 9",
        overflow: "hidden",
        background: "#a7d0a0",
        outline: "none",
        imageRendering: "pixelated" as any,
        borderRadius: "16px",
      }}
    />
  );
}
