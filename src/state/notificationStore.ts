import { create } from "zustand";
import { EMPTY_INBOX, updateInbox, type Inbox } from "../notifications/inbox";
import type { GameEvent, GameState } from "../types/game";

const STORAGE_KEY = "atlas-notifications-v1";
export function createNotificationStore(
  storage?: Pick<Storage, "getItem" | "setItem">,
) {
  let saved: { inbox: Inbox; enabled: boolean } = {
    inbox: EMPTY_INBOX,
    enabled: false,
  };
  try {
    const value = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null");
    if (
      value &&
      typeof value.enabled === "boolean" &&
      typeof value.inbox?.scope === "string" &&
      Number.isSafeInteger(value.inbox.cursor) &&
      value.inbox.cursor >= 0 &&
      Array.isArray(value.inbox.notices) &&
      value.inbox.notices.every(
        (notice: unknown) =>
          notice &&
          typeof notice === "object" &&
          "id" in notice &&
          "message" in notice &&
          "read" in notice,
      )
    )
      saved = value;
  } catch {
    /* Notification preferences never prevent a campaign from loading. */
  }
  const persist = (data: typeof saved) => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* Session-only alerts still work without storage. */
    }
  };
  return create<{
    inbox: Inbox;
    enabled: boolean;
    ingest: (game: GameState) => GameEvent[];
    markRead: (id?: string) => void;
    setEnabled: (enabled: boolean) => void;
  }>((set, get) => ({
    ...saved,
    ingest: (game) => {
      const { inbox, added } = updateInbox(get().inbox, game);
      set({ inbox });
      persist({ inbox, enabled: get().enabled });
      return added;
    },
    markRead: (id) => {
      const inbox = {
        ...get().inbox,
        notices: get().inbox.notices.map((notice) =>
          !id || notice.id === id ? { ...notice, read: true } : notice,
        ),
      };
      set({ inbox });
      persist({ inbox, enabled: get().enabled });
    },
    setEnabled: (enabled) => {
      set({ enabled });
      persist({ inbox: get().inbox, enabled });
    },
  }));
}
function browserStorage() {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
export const useNotificationStore = createNotificationStore(browserStorage());
