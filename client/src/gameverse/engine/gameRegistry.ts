import React from "react";
import JarvisCommand from "../games/JarvisCommand";
import NeuralRush from "../games/NeuralRush";
import CyberHeist from "../games/CyberHeist";
import AIArena from "../games/AIArena";
import Codebreak from "../games/Codebreak";
import VoidRunner from "../games/VoidRunner";
import JarvisTactics from "../games/JarvisTactics";
import BossProtocol from "../games/BossProtocol";
import { DifficultyLevel } from "./AIGameDirector";

export interface GameProps {
  difficulty: DifficultyLevel;
  onBack: () => void;
  onScoreSubmit: (gameId: string, score: number, difficulty: string, stats: Record<string, unknown>) => void;
}

export type GameDefinition = {
  id: string;
  title: string;
  category: "Defense" | "Runner" | "Stealth" | "Shooter" | "Puzzle" | "Strategy" | "Boss";
  description: string;
  icon: string;
  badge?: string;
  controls: string;
  component: React.ComponentType<GameProps>;
};

export const GAME_REGISTRY: Record<string, GameDefinition> = {
  "jarvis-command": {
    id: "jarvis-command",
    title: "JARVIS Command",
    category: "Defense",
    description: "Top-down tactical defense with turret upgrades and orbital strikes.",
    icon: "🛡️",
    controls: "Mouse Click: Build Turrets | Space: Orbital Laser",
    component: JarvisCommand
  },
  "neural-rush": {
    id: "neural-rush",
    title: "Neural Rush",
    category: "Runner",
    description: "Fast reaction cyber runner dodging firewalls and stacking combos.",
    icon: "⚡",
    controls: "WASD / Arrows / Mouse: Steer Data Core",
    component: NeuralRush
  },
  "cyber-heist": {
    id: "cyber-heist",
    title: "Cyber Heist",
    category: "Stealth",
    description: "Top-down stealth sneaking past drone FOV cones to hack vault terminals.",
    icon: "🕵️",
    controls: "WASD: Move Agent | E: Hack Security Terminals",
    component: CyberHeist
  },
  "ai-arena": {
    id: "ai-arena",
    title: "AI Arena",
    category: "Shooter",
    description: "WASD + Mouse 360° twin-stick shooter against drone swarms.",
    icon: "⚔️",
    controls: "WASD: Move | Mouse: Aim & Shoot | Space: Dash | 1-3: Weapons",
    component: AIArena
  },
  "codebreak": {
    id: "codebreak",
    title: "Codebreak",
    category: "Puzzle",
    description: "Interactive node circuit logic decoder under time pressure.",
    icon: "🧩",
    controls: "Mouse Click: Rotate Circuit Tiles",
    component: Codebreak
  },
  "void-runner": {
    id: "void-runner",
    title: "Void Runner",
    category: "Runner",
    description: "Endless space starship flight dodging asteroids and plasma gates.",
    icon: "🚀",
    controls: "WASD / Arrows: Steer Ship | Space: Boost",
    component: VoidRunner
  },
  "jarvis-tactics": {
    id: "jarvis-tactics",
    title: "JARVIS Tactics",
    category: "Strategy",
    description: "Turn-based 8x8 tactical grid strategy against a smart AI solver.",
    icon: "♟️",
    controls: "Mouse Click: Select Unit & Target Cell | End Turn",
    component: JarvisTactics
  },
  "boss-protocol": {
    id: "boss-protocol",
    title: "Boss Protocol",
    category: "Boss",
    description: "Showcase Multi-Phase Boss Battle vs Ultra-JARVIS Corrupted Core.",
    icon: "👾",
    badge: "FLAGSHIP SHOWCASE",
    controls: "WASD: Move | Mouse: Aim & Shoot | Space: Dash",
    component: BossProtocol
  }
};

export const REGISTERED_GAME_LIST: GameDefinition[] = Object.values(GAME_REGISTRY);

export function getGameById(id: string): GameDefinition | undefined {
  return GAME_REGISTRY[id];
}
