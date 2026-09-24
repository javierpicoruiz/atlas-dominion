import { create } from "zustand";
import { BALANCE } from "../data/balance";
import { createTestCampaign } from "../data/testCampaign";
import { advanceGameState } from "../simulation/advanceTime";
import { applyCommand } from "../simulation/commands";
import { resumeTime, systemClock, type Clock } from "../simulation/clock";
import type { GameCommand, GameState } from "../types/game";
import {
  SaveConflictError,
  SaveDatabase,
  type SaveRepository,
} from "./saveStore";

interface CampaignStore {
  game: GameState | null;
  status: "loading" | "ready" | "error";
  busy: boolean;
  error: string | null;
  revision: number;
  resumedMs: number;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  dispatch: (command: GameCommand) => Promise<void>;
  clearError: () => void;
}
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Unable to access the saved campaign.";
export function createGameStore(
  repository: SaveRepository,
  clock: Clock = systemClock,
) {
  return create<CampaignStore>((set, get) => {
    async function persist(command?: GameCommand) {
      const current = get();
      if (!current.game || current.busy || current.status !== "ready") return;
      set({ busy: true });
      let next: GameState;
      try {
        next = advanceGameState(
          current.game,
          current.game.lastUpdatedAt,
          resumeTime(current.game, clock),
        );
        if (command) next = applyCommand(next, command);
      } catch (error) {
        set({ busy: false, error: errorMessage(error) });
        return;
      }
      try {
        const revision = await repository.save(next, current.revision);
        // Publish only durable commands. Storage failures never pretend an order succeeded.
        set({ game: next, revision, busy: false, error: null });
      } catch (error) {
        set({
          busy: false,
          error: `Save failed: ${errorMessage(error)}`,
          ...(error instanceof SaveConflictError
            ? { status: "error" as const }
            : {}),
        });
      }
    }
    return {
      game: null,
      status: "loading",
      busy: false,
      error: null,
      revision: 0,
      resumedMs: 0,
      initialize: async () => {
        if (get().busy || get().game) return;
        set({ busy: true, error: null });
        try {
          const loaded = await repository.load();
          const previous =
            loaded?.state ?? createTestCampaign(BALANCE.seed, clock.now());
          const now = resumeTime(previous, clock);
          const game = advanceGameState(previous, previous.lastUpdatedAt, now);
          const revision = await repository.save(game, loaded?.revision ?? 0);
          set({
            game,
            revision,
            status: "ready",
            busy: false,
            resumedMs: loaded ? now - previous.lastUpdatedAt : 0,
          });
        } catch (error) {
          set({ status: "error", busy: false, error: errorMessage(error) });
        }
      },
      refresh: () => persist(),
      dispatch: (command) => persist(command),
      clearError: () => set({ error: null }),
    };
  });
}
export const useGameStore = createGameStore(new SaveDatabase());
