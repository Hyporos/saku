import { useState, useEffect } from "react";
import { FaExchangeAlt } from "react-icons/fa";
import { cn } from "../../../lib/utils";
import AutocompleteInput from "../../../components/AutocompleteInput";
import Checkbox from "../../../components/Checkbox";
import WarningModal from "../../../components/WarningModal";
import { useAdminContext } from "../context";
import { inputCls } from "../constants";
import type { CharDetail } from "../types";

export const TransferModal = () => {
  const {
    transferModal,
    closeTransferModal,
    transferToInput,
    setTransferToInput,
    transferDeleteSource,
    setTransferDeleteSource,
    transferCharacter,
    liveUsers,
  } = useAdminContext();

  // Latch char so title stays populated during the exit animation
  const [char, setChar] = useState<CharDetail | null>(transferModal.char);
  useEffect(() => {
    if (transferModal.char) setChar(transferModal.char);
  }, [transferModal.char]);

  const transferToUser = liveUsers.find((u) => u.username === transferToInput);
  const isSelf = transferToUser?.id === char?.userId;
  const canTransfer = !!transferToUser && !isSelf;

  return (
    <WarningModal
      isOpen={transferModal.isOpen}
      colorVariant="primary"
      icon={<FaExchangeAlt size={14} className="text-accent" />}
      title={char ? <span>Transfer <span className="text-accent">{char.name}</span>?</span> : "Transfer?"}
      description="Select a Discord user to transfer this character to."
      confirmLabel="Transfer"
      confirmDisabled={!canTransfer}
      onConfirm={transferCharacter}
      onCancel={closeTransferModal}
    >
      <AutocompleteInput
        value={transferToInput}
        onChange={setTransferToInput}
        suggestions={
          liveUsers
            .filter((u) => u.id !== char?.userId)
            .map((u) => u.username ?? u.id)
            .filter(Boolean) as string[]
        }
        placeholder="Search Discord username..."
        autoFocus
        inputClassName={cn(inputCls)}
      />
      {isSelf && (
        <p className="text-xs text-[#C87070] -mt-2">Cannot transfer to the same user.</p>
      )}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <Checkbox
          checked={transferDeleteSource}
          onChange={() => setTransferDeleteSource((v) => !v)}
        />
        <span className="text-sm text-tertiary">Also delete the source user from database</span>
      </label>
    </WarningModal>
  );
};

