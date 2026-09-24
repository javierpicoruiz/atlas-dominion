import { useEffect, useRef, useState } from "react";
import type { GameState } from "../types/game";
import { useNotificationStore } from "../state/notificationStore";
import { useUiStore } from "../state/uiStore";
import {
  deviceNotificationProblem,
  enableDeviceNotifications,
  showDeviceNotifications,
} from "../notifications/device";
import { dateTime } from "../app/format";

export function Notifications({ game }: { game: GameState }) {
  const { inbox, enabled, ingest, markRead, setEnabled } =
    useNotificationStore();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const { setTab, selectCity } = useUiStore();
  useEffect(() => {
    const events = ingest(game);
    if (enabled)
      void showDeviceNotifications(events).catch(() =>
        setError("Device notification failed. Your updates are saved here."),
      );
  }, [game, ingest, enabled]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    const openCity = (id: unknown) => {
      if (
        typeof id === "string" &&
        game.cities.some((city) => city.id === id)
      ) {
        setTab("World");
        selectCity(id);
      }
    };
    const url = new URL(window.location.href);
    if (url.searchParams.has("city")) {
      openCity(url.searchParams.get("city"));
      url.searchParams.delete("city");
      history.replaceState(null, "", url);
    }
    const listener = (event: MessageEvent) => {
      if (event.data?.type === "OPEN_CITY") openCity(event.data.cityId);
    };
    navigator.serviceWorker?.addEventListener("message", listener);
    return () =>
      navigator.serviceWorker?.removeEventListener("message", listener);
  }, [game.cities, setTab, selectCity]);
  const unread = inbox.notices.filter((notice) => !notice.read).length;
  const problem = deviceNotificationProblem();
  return (
    <>
      <button
        className="notification-bell"
        aria-label={`Notifications (${unread} unread)`}
        onClick={() => setOpen(true)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
          <path d="M10 21h4" />
        </svg>
        {unread > 0 && <span>{unread}</span>}
      </button>
      <dialog
        ref={dialog}
        className="city-sheet notification-sheet"
        aria-label="Notifications"
        onCancel={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <div className="sheet-inner">
          <div className="sheet-handle" />
          <header className="sheet-header">
            <h2>Notifications</h2>
            <button
              className="icon-button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>
          <p className="muted">
            Arrivals, recruitment, construction and threats to your faction.
            Missed events appear when you return.
          </p>
          <div className="action-row">
            <button
              className="secondary"
              disabled={!unread}
              onClick={() => markRead()}
            >
              Mark all read
            </button>
            <button
              className="secondary"
              disabled={busy || (!enabled && !!problem)}
              onClick={async () => {
                if (enabled) {
                  setEnabled(false);
                  return;
                }
                setBusy(true);
                setError(null);
                try {
                  await enableDeviceNotifications();
                  setEnabled(true);
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Unable to enable notifications.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {enabled
                ? "Disable device notifications"
                : "Enable device notifications"}
            </button>
          </div>
          <p className="notification-help">
            {problem ??
              "Device alerts are delivered while the app is running. Delivery can pause in the background; closed-app push is not enabled."}
          </p>
          {error && (
            <p role="status" className="warning">
              {error}
            </p>
          )}
          <div className="notification-list" aria-label="Notification history">
            {inbox.notices.length ? (
              [...inbox.notices].reverse().map((notice) => (
                <button
                  key={notice.id}
                  className={`secondary ${notice.read ? "" : "unread"}`}
                  onClick={() => {
                    markRead(notice.id);
                    if (notice.cityId) {
                      setOpen(false);
                      setTab("World");
                      selectCity(notice.cityId);
                    }
                  }}
                >
                  <time>{dateTime(notice.at)}</time>
                  <span>{notice.message}</span>
                  {!notice.read && <small>Unread</small>}
                </button>
              ))
            ) : (
              <p>
                No notifications yet. Completed orders and important events will
                appear here.
              </p>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
