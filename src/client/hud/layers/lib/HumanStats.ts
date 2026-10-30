import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import type { AllPlayersStats } from "@openfront/engine-api/Schemas";
import type { PlayerStats } from "@openfront/engine-api/StatsSchemas";
import type { GameView, PlayerView } from "../../../view";

/**
 * The latest copy of the engine's per-player stats record, for leaderboard
 * columns that have no live PlayerView field (bombs launched, warships
 * destroyed). The engine keeps that record per clientID, so only humans have
 * one: nations and bots read as unavailable, never as zero.
 *
 * The copy comes from the worker's read-only human_stats request (the same
 * one the provisional XP uses), so it trails the live view by one refresh.
 */
export class HumanStats {
  private game: GameView | null = null;
  private stats: AllPlayersStats | null = null;
  private inFlight = false;

  /**
   * Ask the worker for a fresh copy unless one is already on its way.
   * Resolves true when this answer is the game's first, so the caller can
   * re-render instead of showing "—" until its next refresh.
   */
  async request(game: GameView): Promise<boolean> {
    if (game !== this.game) {
      this.game = game;
      this.stats = null;
      this.inFlight = false;
    }
    if (this.inFlight) return false;
    this.inFlight = true;
    try {
      const snapshot = await game.worker.humanStats();
      if (this.game !== game) return false;
      const first = this.stats === null;
      this.stats = snapshot.stats;
      return first;
    } catch {
      // Timed out or the worker is gone: keep the last copy.
      return false;
    } finally {
      if (this.game === game) this.inFlight = false;
    }
  }

  /**
   * The value `read` picks out of the player's record, or null when the
   * player has no record to read: not a human, or no copy has arrived yet.
   * A human the engine has nothing on yet counts as zero.
   */
  value(
    player: PlayerView,
    read: (stats: NonNullable<PlayerStats>) => bigint | undefined,
  ): number | null {
    const clientID = player.clientID();
    if (
      this.stats === null ||
      player.type() !== PlayerType.Human ||
      clientID === null
    ) {
      return null;
    }
    const stats = this.stats[clientID];
    return stats === undefined ? 0 : Number(read(stats) ?? 0n);
  }
}

export const humanStats = new HumanStats();
