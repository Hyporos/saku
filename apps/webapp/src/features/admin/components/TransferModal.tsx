import { cn } from "../../../lib/utils";
import { FaExchangeAlt } from "react-icons/fa";
import AutocompleteInput from "../../../components/AutocompleteInput";
import Checkbox from "../../../components/Checkbox";
import { useAdminContext } from "../context";
import { inputCls } from "../constants";

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

  if (!transferModal.isOpen || !transferModal.char) return null;

  const { char } = transferModal;
  const transferToUser = liveUsers.find((u) => u.username === transferToInput);
  const isSelf = transferToUser?.id === char.userId;
  const canTransfer = !!transferToUser && !isSelf;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60]"
        onClick={closeTransferModal}
      />
      <div className="fixed inset-0 flex items-center justify-center z-[70] pointer-events-none">
        <div
          className="bg-panel border border-tertiary/[8%] rounded-2xl p-8 w-[440px] pointer-events-auto drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon + title */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mt-0.5">
              <FaExchangeAlt size={15} className="text-accent" />
            </div>
            <div>
              <h3 className="text-lg">
                Transfer <span className="text-accent">{char.name}</span>?
              </h3>
              <p className="text-sm text-tertiary mt-1 leading-relaxed">
                Select a Discord user to transfer this character to.
              </p>
            </div>
          </div>

          {/* Destination input */}
          <AutocompleteInput
            value={transferToInput}
            onChange={setTransferToInput}
            suggestions={
              liveUsers
                .filter((u) => u.id !== char.userId)
                .map((u) => u.username ?? u.id)
                .filter(Boolean) as string[]
            }
            placeholder="Search Discord username..."
            autoFocus
            inputClassName={cn(inputCls)}
          />
          {isSelf && (
            <p className="text-xs text-red-400 -mt-3">Cannot transfer to the same user.</p>
          )}

          {/* Delete source checkbox */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <Checkbox
              checked={transferDeleteSource}
              onChange={() => setTransferDeleteSource((v) => !v)}
            />
            <span className="text-sm text-tertiary">
              Also delete the source user from database
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 mt-1">
            <button
              disabled={!canTransfer}
              onClick={transferCharacter}
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm transition-colors",
                canTransfer
                  ? "bg-accent/15 hover:bg-accent/20 text-accent"
                  : "bg-background/60 text-tertiary/30 cursor-not-allowed"
              )}
            >
              Transfer
            </button>
            <button
              onClick={closeTransferModal}
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
