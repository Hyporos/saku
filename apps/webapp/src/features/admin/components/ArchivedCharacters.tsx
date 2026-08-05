import { useState, useEffect } from "react";
import axios from "axios";
import { FaBoxArchive } from "react-icons/fa6";
import { BOT_API } from "../constants";
import type { ArchivedCharacter } from "../types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Characters that `/character unlink` removed. The unlink stores a full snapshot in the action log and
// the log expires after 90 days, so this is a countdown: while a character is listed here it can still
// be brought back with `/character restore`, and once it drops off the list it is gone for good.
//
// Read-only on purpose. Restoring is a bee action with a confirmation step behind it, so it belongs in
// Discord rather than being a button here.

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export const ArchivedCharacters = () => {
  const [archived, setArchived] = useState<ArchivedCharacter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    axios
      .get<ArchivedCharacter[]>(`${BOT_API}/bot/api/admin/archived-characters`)
      .then((res) => {
        if (!cancelled) setArchived(Array.isArray(res.data) ? res.data : []);
      })
      .catch((error) => console.error("Failed to fetch archived characters:", error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing archived is the normal state, so it stays out of the way rather than showing an empty box.
  if (loading || archived.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-tertiary/10 bg-panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <FaBoxArchive className="text-tertiary/50" size={13} />
        <h3 className="text-sm font-semibold text-tertiary">Archived</h3>
        <span className="text-xs text-tertiary/50">
          {archived.length} unlinked {archived.length === 1 ? "character" : "characters"} still restorable
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {archived.map((character) => (
          <li
            key={character.id}
            className="flex items-center justify-between gap-3 rounded-md bg-background/40 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <span className="font-medium text-tertiary">{character.name}</span>
              <span className="ml-2 text-xs text-tertiary/50">
                {character.scoreCount} {character.scoreCount === 1 ? "score" : "scores"} · unlinked{" "}
                {dateLabel(character.unlinkedAt)}
              </span>
            </div>

            {/* The last week or so is the point at which somebody actually needs to act on it. */}
            <span className={character.daysLeft <= 7 ? "shrink-0 text-xs text-accent" : "shrink-0 text-xs text-tertiary/50"}>
              {character.daysLeft} {character.daysLeft === 1 ? "day" : "days"} left
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-tertiary/40">
        Restore one with <code className="text-tertiary/60">/character restore</code> in Discord. After the countdown
        the snapshot is deleted and the character cannot be recovered.
      </p>
    </div>
  );
};
