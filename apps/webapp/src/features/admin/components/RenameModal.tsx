import { useState, useEffect } from "react";
import axios from "axios";
import { cn } from "../../../lib/utils";
import { FaPencilAlt } from "react-icons/fa";
import { useAdminContext } from "../context";
import { inputCls, BOT_API } from "../constants";

type VerifyState = "idle" | "loading" | "found" | "error";

export const RenameModal = () => {
  const { renameModal, closeRenameModal, renameCharacter, liveCharacters } = useAdminContext();

  const [renameInput, setRenameInput]   = useState("");
  const [verifyState, setVerifyState]   = useState<VerifyState>("idle");
  const [errorMsg, setErrorMsg]         = useState("");

  // Reset verify state whenever the input changes
  useEffect(() => {
    setVerifyState("idle");
    setErrorMsg("");
  }, [renameInput]);

  // Clear input when the modal closes / re-opens
  useEffect(() => {
    if (!renameModal.isOpen) {
      setRenameInput("");
      setVerifyState("idle");
      setErrorMsg("");
    }
  }, [renameModal.isOpen]);

  if (!renameModal.isOpen || !renameModal.char) return null;

  const { char } = renameModal;

  const handleVerify = async () => {
    const nextName = renameInput.trim();
    if (!nextName) return;

    const duplicate = liveCharacters.some(
      (c) => c.name.trim().toLowerCase() === nextName.toLowerCase() && !(c.userId === char.userId && c.name.trim().toLowerCase() === char.name.trim().toLowerCase())
    );
    if (duplicate) {
      setVerifyState("error");
      setErrorMsg("A character with this name already exists.");
      return;
    }

    setVerifyState("loading");
    try {
      await axios.get(`${BOT_API}/bot/api/rankings/${encodeURIComponent(nextName)}`);
      setVerifyState("found");
    } catch {
      setVerifyState("error");
      setErrorMsg("Character not found on MapleStory rankings.");
    }
  };

  const handleRename = async () => {
    try {
      await renameCharacter(renameInput.trim());
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setVerifyState("error");
        setErrorMsg("A character with this name already exists.");
        return;
      }
      setVerifyState("error");
      setErrorMsg("Rename failed. Please try again.");
    }
  };

  const canVerify  = renameInput.trim().length > 0 && verifyState !== "loading";
  const isVerified = verifyState === "found";

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60]"
        onClick={closeRenameModal}
      />
      <div className="fixed inset-0 flex items-center justify-center z-[70] pointer-events-none">
        <div
          className="bg-panel border border-tertiary/[8%] rounded-2xl p-8 w-[440px] pointer-events-auto drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon + title */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mt-0.5">
              <FaPencilAlt size={14} className="text-accent" />
            </div>
            <div>
              <h3 className="text-lg">
                Rename <span className="text-accent">{char.name}</span>?
              </h3>
              <p className="text-sm text-tertiary mt-1 leading-relaxed">
                Enter the new character name and verify it exists on the MapleStory rankings.
              </p>
            </div>
          </div>

          {/* Name input */}
          <div className="flex flex-col gap-1.5">
            <input
              className={cn(inputCls)}
              placeholder="New character name..."
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (isVerified) handleRename();
                  else if (canVerify) handleVerify();
                }
              }}
              autoFocus
            />
            {verifyState === "error" && (
              <p className="text-xs text-red-400">{errorMsg}</p>
            )}
            {verifyState === "found" && (
              <p className="text-xs text-green-400">Character found - click Rename to confirm.</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-1">
            <button
              disabled={isVerified ? false : !canVerify}
              onClick={isVerified ? handleRename : handleVerify}
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm transition-colors",
                (isVerified || canVerify)
                  ? "bg-accent/15 hover:bg-accent/20 text-accent"
                  : "bg-background/60 text-tertiary/30 cursor-default"
              )}
            >
              {verifyState === "loading"
                ? "Verifying..."
                : isVerified
                  ? "Rename"
                  : "Verify Name"}
            </button>
            <button
              onClick={closeRenameModal}
              className="flex-1 bg-background hover:bg-background/60 text-tertiary rounded-lg py-2.5 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
