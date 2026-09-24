import type { GameEvent, GameState } from "../types/game";

export interface Notice extends GameEvent {
  read: boolean;
}
export interface Inbox {
  scope: string;
  cursor: number;
  notices: Notice[];
}
export const EMPTY_INBOX: Inbox = { scope: "", cursor: 0, notices: [] };
export const NOTICE_LIMIT = 50;
export const campaignScope = (game: GameState) =>
  `${game.seed}:${game.startedAt}`;
export function updateInbox(
  previous: Inbox,
  game: GameState,
): { inbox: Inbox; added: GameEvent[] } {
  const scope = campaignScope(game);
  const current =
    previous.scope === scope ? previous : { ...EMPTY_INBOX, scope };
  const added = game.events.filter((event) => {
    const sequence = Number(event.id.split("-").at(-1));
    const audience =
      event.factionIds ??
      (event.cityId
        ? [game.cities.find((city) => city.id === event.cityId)?.ownerId]
        : []);
    return (
      sequence > current.cursor &&
      event.kind !== "order" &&
      audience.includes(game.playerFactionId)
    );
  });
  return {
    inbox: {
      scope,
      cursor: Math.max(current.cursor, game.nextId - 1),
      notices: [
        ...current.notices,
        ...added.map((event) => ({ ...event, read: false })),
      ].slice(-NOTICE_LIMIT),
    },
    added,
  };
}
export function notificationSummary(events: GameEvent[]): {
  title: string;
  body: string;
  cityId: string | null;
} {
  const priority: Partial<Record<GameEvent["kind"], number>> = {
    rebellion: 5,
    unrest: 4,
    "battle-start": 3,
    bombardment: 3,
    capture: 2,
    "battle-end": 2,
  };
  const important = [...events].sort(
    (a, b) => (priority[b.kind] ?? 0) - (priority[a.kind] ?? 0),
  )[0];
  return {
    title:
      events.length > 1
        ? `Atlas Dominion · ${events.length} updates`
        : "Atlas Dominion",
    body:
      important.message +
      (events.length > 1
        ? ` (+${events.length - 1} more in Notifications)`
        : ""),
    cityId: important.cityId,
  };
}
