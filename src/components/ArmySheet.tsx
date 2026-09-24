import { useEffect, useRef } from "react";
import type { GameState } from "../types/game";
import { useUiStore } from "../state/uiStore";
import { ArmyCard } from "./ArmyCard";
import { useGameStore } from "../state/gameStore";
export function ArmySheet({ game }: { game: GameState }) {
  const { selectedArmyId, selectArmy } = useUiStore();
  const error = useGameStore((state) => state.error);
  const dialog = useRef<HTMLDialogElement>(null);
  const army = game.armies.find((entry) => entry.id === selectedArmyId);
  useEffect(() => {
    if (army && !dialog.current?.open) dialog.current?.showModal();
    else if (!army) dialog.current?.close();
  }, [army]);
  if (!army) return null;
  return (
    <dialog
      ref={dialog}
      className="city-sheet"
      aria-label="Army orders"
      onCancel={() => selectArmy(null)}
      onClick={(event) => {
        if (event.target === event.currentTarget) selectArmy(null);
      }}
    >
      <div className="sheet-inner">
        <div className="sheet-handle" />
        <header className="sheet-header">
          <h2>Army orders</h2>
          <button
            className="icon-button"
            onClick={() => selectArmy(null)}
            aria-label="Close army orders"
          >
            ×
          </button>
        </header>
        {error && <p role="alert">{error}</p>}
        <ArmyCard key={army.id} game={game} army={army} />
      </div>
    </dialog>
  );
}
