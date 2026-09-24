import { RESOURCES } from "../data/balance";
import type { ResourceBundle } from "../types/game";
export const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
export const rate = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}`;
export const time = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const dateTime = (at: number) =>
  new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const duration = (ms: number) => {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}m`;
};
export const costLabel = (cost: ResourceBundle, level = 1) =>
  RESOURCES.filter((resource) => cost[resource] > 0)
    .map((resource) => `${number(cost[resource] * level)} ${resource}`)
    .join(" · ");
