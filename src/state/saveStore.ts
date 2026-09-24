import Dexie, { type EntityTable } from "dexie";
import type { GameState } from "../types/game";
import { parseSaveState } from "./saveSchema";

interface SaveRecord {
  id: "latest";
  revision: number;
  state: GameState;
}
export interface SavedCampaign {
  state: GameState;
  revision: number;
}
export interface SaveRepository {
  load: () => Promise<SavedCampaign | null>;
  save: (state: GameState, expectedRevision: number) => Promise<number>;
}
export class SaveConflictError extends Error {
  constructor() {
    super(
      "This campaign changed in another tab. Reload to restore its latest save.",
    );
    this.name = "SaveConflictError";
  }
}
export class SaveDatabase extends Dexie implements SaveRepository {
  campaigns!: EntityTable<SaveRecord, "id">;
  constructor(name = "atlas-dominion") {
    super(name);
    this.version(1).stores({ campaigns: "id" });
  }
  async load(): Promise<SavedCampaign | null> {
    const record = await this.campaigns.get("latest");
    if (!record) return null;
    if (!Number.isSafeInteger(record.revision) || record.revision < 1)
      throw new Error("Invalid save revision. Your save has been preserved.");
    return { state: parseSaveState(record.state), revision: record.revision };
  }
  async save(state: GameState, expectedRevision: number): Promise<number> {
    const valid = parseSaveState(state);
    return this.transaction("rw", this.campaigns, async () => {
      const existing = await this.campaigns.get("latest");
      if ((existing?.revision ?? 0) !== expectedRevision)
        throw new SaveConflictError();
      const revision = expectedRevision + 1;
      await this.campaigns.put({ id: "latest", revision, state: valid });
      return revision;
    });
  }
}
