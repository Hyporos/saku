import { useState, useEffect } from "react";
import axios from "axios";
import { cn } from "../../../lib/utils";
import { FaPencilAlt } from "react-icons/fa";
import WarningModal from "../../../components/WarningModal";
import { useAdminContext } from "../context";
import { inputCls, BOT_API } from "../constants";
import type { CharDetail } from "../types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

type VerifyState = "idle" | "loading" | "found" | "error";

export const RenameModal = () => {
  const { renameModal, closeRenameModal, renameCharacter, liveCharacters } = useAdminContext();

  // Latch char so title stays populated during the exit animation
  const [char, setChar] = useState<CharDetail | null>(renameModal.char);
  const [renameInput, setRenameInput] = useState("");
  const [verifyState, setVerifyState] = useState<VerifyState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (renameModal.char) setChar(renameModal.char);
  }, [renameModal.char]);

  // Reset verify state whenever the input changes
  useEffect(() => {
    setVerifyState("idle");
    setErrorMsg("");
  }, [renameInput]);

  // Clear form when modal closes
  useEffect(() => {
    if (!renameModal.isOpen) {
      setRenameInput("");
      setVerifyState("idle");
      setErrorMsg("");
    }
  }, [renameModal.isOpen]);

  const handleVerify = async () => {
    const nextName = renameInput.trim();
    if (!nextName) return;

    const duplicate = liveCharacters.some(
      (c) =>
        c.name.trim().toLowerCase() === nextName.toLowerCase() &&
        !(
          c.userId === char?.userId &&
          c.name.trim().toLowerCase() === char?.name.trim().toLowerCase()
        )
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

  const canVerify = renameInput.trim().length > 0 && verifyState !== "loading";
  const isVerified = verifyState === "found";

  return (
    <WarningModal
      isOpen={renameModal.isOpen}
      colorVariant="primary"
      icon={<FaPencilAlt size={13} className="text-accent" />}
      title={char ? <span>Rename <span className="text-accent">{char.name}</span>?</span> : "Rename?"}
      description="Enter the new character name and verify it exists on the MapleStory rankings."
      confirmLabel={isVerified ? "Rename" : "Verify Name"}
      confirmDisabled={isVerified ? false : !canVerify}
      confirmLoading={verifyState === "loading"}
      onConfirm={isVerified ? handleRename : handleVerify}
      onCancel={closeRenameModal}
    >
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
          <p className="text-xs text-[#C87070]">{errorMsg}</p>
        )}
        {verifyState === "found" && (
          <p className="text-xs text-[#669A68]">Character found — click Rename to confirm.</p>
        )}
      </div>
    </WarningModal>
  );
};

