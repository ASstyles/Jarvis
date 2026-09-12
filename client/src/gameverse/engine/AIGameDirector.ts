export type DifficultyLevel = "EASY" | "MEDIUM" | "HARD" | "NIGHTMARE";

export interface GameTelemetry {
  score: number;
  kills: number;
  damageTaken: number;
  timeElapsed: number;
  accuracy: number;
}

export class AIGameDirector {
  public difficulty: DifficultyLevel = "MEDIUM";
  public commentary: string = "JARVIS AI Game Director Online. Systems operational.";
  private lastCommentTime: number = 0;

  constructor(initialDifficulty: DifficultyLevel = "MEDIUM") {
    this.difficulty = initialDifficulty;
  }

  public getDifficultyMultiplier(): number {
    switch (this.difficulty) {
      case "EASY": return 0.75;
      case "MEDIUM": return 1.0;
      case "HARD": return 1.4;
      case "NIGHTMARE": return 2.0;
      default: return 1.0;
    }
  }

  public evaluateTelemetry(telemetry: GameTelemetry, currentTime: number): void {
    if (currentTime - this.lastCommentTime < 10000) return; // Comment throttle 10s
    this.lastCommentTime = currentTime;

    const { kills, damageTaken, timeElapsed } = telemetry;

    if (damageTaken > 80) {
      this.commentary = "WARNING: Critical damage sustained! Reposition immediately, Sir!";
    } else if (kills > 25 && timeElapsed < 60) {
      this.commentary = "EXCELLENT REFLEXES: Target destruction rate exceeding normal parameters!";
    } else if (timeElapsed > 120 && damageTaken < 20) {
      this.commentary = "DOMINANT RUN: Tactical execution flawless. Increasing threat intensity.";
    } else if (kills > 10) {
      this.commentary = "COMBAT ANALYTICS: Target tracking optimal. Maintain defensive posture.";
    }
  }

  public setDifficulty(level: DifficultyLevel): void {
    this.difficulty = level;
    this.commentary = `Difficulty adjusted to [${level}]. Modifying enemy behavior algorithms.`;
  }
}
