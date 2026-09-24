import type { GameEvent } from "../types/game";
import { notificationSummary } from "./inbox";

export function deviceNotificationProblem(): string | null {
  if (!window.isSecureContext)
    return "Device notifications need HTTPS. In-game notifications work here.";
  if (!("Notification" in window) || !("serviceWorker" in navigator))
    return "Device notifications are unavailable in this browser. On iPhone, use the installed app over HTTPS.";
  if (Notification.permission === "denied")
    return "Notifications are blocked in your browser settings. In-game notifications remain available.";
  return null;
}
export async function enableDeviceNotifications(): Promise<void> {
  const problem = deviceNotificationProblem();
  if (problem) throw new Error(problem);
  // Permission requests must originate from the user's explicit button press.
  if ((await Notification.requestPermission()) !== "granted")
    throw new Error(
      "Permission was not granted. In-game notifications remain available.",
    );
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration)
    throw new Error(
      "Finish loading the installed app before enabling device notifications.",
    );
}
export async function showDeviceNotifications(
  events: GameEvent[],
): Promise<void> {
  if (
    !events.length ||
    deviceNotificationProblem() ||
    Notification.permission !== "granted"
  )
    return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  const summary = notificationSummary(events);
  await registration.showNotification(summary.title, {
    body: summary.body,
    icon: new URL("icons/soldier-cucumber-192.png", document.baseURI).href,
    tag: "atlas-campaign-updates",
    data: { cityId: summary.cityId },
  });
}
