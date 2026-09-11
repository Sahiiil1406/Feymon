import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { OverworldScene } from "../game/scenes/OverworldScene";
import { DojoRoomScene } from "../game/scenes/DojoRoomScene";

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
  onTalkSensei?: () => void;
  onTalkDojoNpc?: (id: string) => void;
  onExitDojo?: () => void;
  latestChat?: { authorId: string; body: string; _creationTime: number } | null;
  activeMap?: "overworld" | "dojo";
};

export default function PhaserGame({
  myPlayerId,
  players,
  npcs,
  me,
  onMove,
  onInteractNpc,
  onEnterFeynmanTower,
  onTalkSensei,
  onTalkDojoNpc,
  onExitDojo,
  latestChat,
  activeMap = "overworld",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  // sceneRef can hold either Overworld or Dojo instance
  const sceneRef = useRef<any | null>(null);

  const onMoveRef = useRef(onMove);
  const onInteractRef = useRef(onInteractNpc);
  const onTowerRef = useRef(onEnterFeynmanTower);
  const onSenseiRef = useRef(onTalkSensei);
  const onTalkDojoRef = useRef(onTalkDojoNpc);
  const onExitDojoRef = useRef(onExitDojo);
  const playersRef = useRef(players);
  const npcsRef = useRef(npcs);
  const meRef = useRef(me);
  const activeMapRef = useRef(activeMap);

  onMoveRef.current = onMove;
  onInteractRef.current = onInteractNpc;
  onTowerRef.current = onEnterFeynmanTower;
  onSenseiRef.current = onTalkSensei;
  onTalkDojoRef.current = onTalkDojoNpc;
  onExitDojoRef.current = onExitDojo;
  playersRef.current = players;
  npcsRef.current = npcs;
  meRef.current = me;
  activeMapRef.current = activeMap;

  const mapOverworldCallbacks = () => ({
    onMove: (...a: Parameters<Props["onMove"]>) => onMoveRef.current(...a),
    onInteractNpc: (...a: Parameters<Props["onInteractNpc"]>) => onInteractRef.current(...a),
    onEnterFeynmanTower: (...a: any) => (onTowerRef.current as any)?.(...a),
  });

  const mapDojoCallbacks = () => ({
    onMove: (...a: Parameters<Props["onMove"]>) => onMoveRef.current(...a),
    onTalkSensei: (...a: any) => (onSenseiRef.current as any)?.(...a),
    onTalkNpc: (...a: any) => (onTalkDojoRef.current as any)?.(...a),
    onExitDojo: (...a: any) => (onExitDojoRef.current as any)?.(...a),
  });

  const getMappedOverworldPlayers = () => {
    const p = playersRef.current ?? [];
    const meVal: any = meRef.current as any;
    let mapped = p.map((pp: any) => ({
      id: pp.player._id,
      name: pp.player.name,
      color: pp.player.color,
      x: pp.presence.x,
      y: pp.presence.y,
      direction: pp.presence.direction,
      isMe: pp.player._id === myPlayerId,
    }));
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
    if (mapped.length === 0 && meVal?.player) {
      const spawn = { x: 656, y: 1150, direction: "down" as const };
      mapped = [
        {
          id: meVal.player._id,
          name: meVal.player.name,
          color: meVal.player.color,
          x: meVal.presence?.x ?? spawn.x,
          y: meVal.presence?.y ?? spawn.y,
          direction: (meVal.presence?.direction as any) ?? "down",
          isMe: true,
        },
      ];
    }
    return mapped;
  };

  const getMappedDojoPlayers = () => {
    const meVal: any = meRef.current as any;
    if (meVal?.player) {
      return [
        {
          id: meVal.player._id,
          name: meVal.player.name,
          color: meVal.player.color,
          // interior entry near exit door — centered symmetric (640, 620)
          x: 640,
          y: 620,
          direction: "up" as const,
          isMe: true,
        },
      ];
    }
    const p = playersRef.current ?? [];
    const mine = p.find((pp: any) => pp.player._id === myPlayerId) as any;
    if (mine) {
      return [
        {
          id: mine.player._id,
          name: mine.player.name,
          color: mine.player.color,
          x: 640,
          y: 620,
          direction: mine.presence.direction,
          isMe: true,
        },
      ];
    }
    return [];
  };

  const syncOverworld = (scene: any) => {
    try {
      const mapped = getMappedOverworldPlayers();
      if (mapped.length) scene.syncPlayers(mapped);
      const n = npcsRef.current ?? [];
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

  const syncDojo = (scene: any) => {
    try {
      const mapped = getMappedDojoPlayers();
      if (mapped.length) scene.syncPlayers(mapped);
    } catch {}
  };

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
      scene: [OverworldScene, DojoRoomScene],
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

    const startInitial = () => {
      const target = activeMapRef.current === "dojo" ? "DojoRoomScene" : "OverworldScene";
      const scene = game.scene.getScene(target) as any;
      if (!scene) return false;
      if (!scene.scene.isActive()) {
        if (target === "DojoRoomScene") {
          game.scene.start("DojoRoomScene", {
            myId: myPlayerId,
            callbacks: mapDojoCallbacks(),
          });
        } else {
          game.scene.start("OverworldScene", {
            myId: myPlayerId,
            callbacks: mapOverworldCallbacks(),
          });
        }
      } else {
        scene.setMyId(myPlayerId);
        if (target === "DojoRoomScene") scene.setCallbacks(mapDojoCallbacks());
        else scene.setCallbacks(mapOverworldCallbacks());
      }
      const readyScene = game.scene.getScene(target) as any;
      sceneRef.current = readyScene;
      if (readyScene) {
        const trySync = () => {
          if ((readyScene as any).playerGroup) {
            if (target === "DojoRoomScene") syncDojo(readyScene);
            else syncOverworld(readyScene);
          } else {
            readyScene.events.once("ready", () => {
              if (target === "DojoRoomScene") syncDojo(readyScene);
              else syncOverworld(readyScene);
            });
          }
        };
        if (readyScene.scene.isActive()) trySync();
        else readyScene.events.once("ready", trySync);
      }
      return true;
    };

    game.events.once("ready", startInitial);
    const iv = setInterval(() => {
      if (sceneRef.current) {
        clearInterval(iv);
        return;
      }
      if (startInitial()) clearInterval(iv);
    }, 80);
    setTimeout(() => clearInterval(iv), 3000);

    const handleFocus = () => {
      try {
        (game.canvas as any)?.focus?.();
        containerRef.current?.focus();
      } catch {}
    };
    containerRef.current?.addEventListener("click", handleFocus);
    setTimeout(() => handleFocus(), 300);

    return () => {
      clearInterval(iv);
      containerRef.current?.removeEventListener("click", handleFocus);
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, [myPlayerId]);

  // Keep callbacks fresh for current active scene
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    const active = activeMapRef.current;
    const target = active === "dojo" ? "DojoRoomScene" : "OverworldScene";
    const s: any = sceneRef.current ?? game.scene.getScene(target);
    if (!s) return;
    if (target === "DojoRoomScene") {
      s.setCallbacks?.(mapDojoCallbacks());
      s.setMyId?.(myPlayerId);
    } else {
      s.setCallbacks?.(mapOverworldCallbacks());
      s.setMyId?.(myPlayerId);
    }
  }, [onMove, onInteractNpc, onEnterFeynmanTower, onTalkSensei, onTalkDojoNpc, onExitDojo, myPlayerId, activeMap]);

  // Handle activeMap transitions
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    // wait a tick for game ready
    const target: "DojoRoomScene" | "OverworldScene" = activeMap === "dojo" ? "DojoRoomScene" : "OverworldScene";
    const other: "DojoRoomScene" | "OverworldScene" = target === "DojoRoomScene" ? "OverworldScene" : "DojoRoomScene";
    const isTargetActive = game.scene.isActive(target);
    const isOtherActive = game.scene.isActive(other);
    if (isTargetActive) {
      const s: any = game.scene.getScene(target);
      sceneRef.current = s;
      // refresh cbs
      if (target === "DojoRoomScene") s.setCallbacks?.(mapDojoCallbacks());
      else s.setCallbacks?.(mapOverworldCallbacks());
      s.setMyId?.(myPlayerId);
      return;
    }
    if (!isOtherActive && !isTargetActive) {
      // neither active yet (boot) — start target directly
      if (target === "DojoRoomScene") {
        game.scene.start("DojoRoomScene", { myId: myPlayerId, callbacks: mapDojoCallbacks() });
      } else {
        game.scene.start("OverworldScene", { myId: myPlayerId, callbacks: mapOverworldCallbacks() });
      }
      const ns: any = game.scene.getScene(target);
      sceneRef.current = ns;
      if (ns) {
        const trySync = () => {
          if ((ns as any).playerGroup) {
            if (target === "DojoRoomScene") syncDojo(ns);
            else syncOverworld(ns);
          } else ns.events.once("ready", () => {
            if (target === "DojoRoomScene") syncDojo(ns);
            else syncOverworld(ns);
          });
        };
        if (ns.scene.isActive()) trySync();
        else ns.events.once("ready", trySync);
      }
      return;
    }
    // switch: instant (previous fadeOut caused black screen flash/dark lock)
    const doSwitch = () => {
      try {
        if (game.scene.isActive(other)) game.scene.stop(other);
        else if (game.scene.isSleeping(other)) game.scene.stop(other);
      } catch {}
      try {
        if (target === "DojoRoomScene") {
          game.scene.start("DojoRoomScene", { myId: myPlayerId, callbacks: mapDojoCallbacks() });
        } else {
          game.scene.start("OverworldScene", { myId: myPlayerId, callbacks: mapOverworldCallbacks() });
        }
      } catch {}
      const ns: any = game.scene.getScene(target);
      sceneRef.current = ns;
      const trySync = () => {
        if ((ns as any).playerGroup) {
          if (target === "DojoRoomScene") syncDojo(ns);
          else syncOverworld(ns);
        } else ns.events.once("ready", () => {
          if (target === "DojoRoomScene") syncDojo(ns);
          else syncOverworld(ns);
        });
      };
      // slight delay to let create run
      setTimeout(() => {
        if (ns.scene.isActive()) trySync();
        else ns.events.once("ready", trySync);
      }, 30);
      // focus after switch
      setTimeout(() => {
        try {
          (game.canvas as any)?.focus?.();
          containerRef.current?.focus();
        } catch {}
      }, 80);
    };
    doSwitch();
  }, [activeMap, myPlayerId]);

  // sync players overworld
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (activeMap !== "overworld") return;
    const s: any = sceneRef.current ?? game.scene.getScene("OverworldScene");
    if (!s) return;
    sceneRef.current = s;
    const mapped = players.map((p) => ({
      id: p.player._id,
      name: p.player.name,
      color: p.player.color,
      x: p.presence.x,
      y: p.presence.y,
      direction: p.presence.direction,
      isMe: p.player._id === myPlayerId,
    }));
    const meVal: any = me as any;
    let finalMapped = mapped;
    if (meVal?.player && !mapped.some((m) => m.id === myPlayerId)) {
      finalMapped = [
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
    if (finalMapped.length) s.syncPlayers(finalMapped);
  }, [players, me, myPlayerId, activeMap]);

  // sync dojo players (only when in dojo)
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (activeMap !== "dojo") return;
    const s: any = sceneRef.current ?? game.scene.getScene("DojoRoomScene");
    if (!s || !s.syncPlayers) return;
    sceneRef.current = s;
    const mapped = getMappedDojoPlayers();
    if (mapped.length) s.syncPlayers(mapped);
  }, [players, me, myPlayerId, activeMap]);

  useEffect(() => {
    if (activeMap !== "overworld") return;
    const game = gameRef.current;
    if (!game) return;
    const s: any = sceneRef.current ?? game.scene.getScene("OverworldScene");
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
  }, [npcs, activeMap]);

  const lastChatRef = useRef<number | null>(null);
  useEffect(() => {
    if (!latestChat) return;
    const game = gameRef.current;
    if (!game) return;
    const target = activeMap === "dojo" ? "DojoRoomScene" : "OverworldScene";
    const s: any = sceneRef.current ?? game.scene.getScene(target);
    if (!s || !s.showChatBubble) return;
    if (lastChatRef.current === latestChat._creationTime) return;
    lastChatRef.current = latestChat._creationTime;
    s.showChatBubble(latestChat.authorId, latestChat.body);
  }, [latestChat, activeMap]);

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
        background: activeMap === "dojo" ? "#8B5A2B" : "#a7d0a0",
        outline: "none",
        imageRendering: "pixelated" as any,
        borderRadius: "16px",
      }}
    />
  );
}
