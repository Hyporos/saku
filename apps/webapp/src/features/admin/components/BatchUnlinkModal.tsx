import { useEffect, useState } from "react";
import { cn } from "../../../lib/utils";
import { FaUnlink } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import { useAdminContext } from "../context";

export const BatchUnlinkModal = () => {
  const {
    batchUnlinkModal,
    closeBatchUnlinkModal,
    batchUnlinkDeleteSource,
    setBatchUnlinkDeleteSource,
    confirmBatchUnlink,
    selUserDetailChars,
    selChars,
  } = useAdminContext();

  const [confirmInput, setConfirmInput] = useState("");

  // Reset state whenever the modal opens
  useEffect(() => {
    if (batchUnlinkModal.isOpen) {
      setConfirmInput("");
      setBatchUnlinkDeleteSource(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchUnlinkModal.isOpen]);

  if (!batchUnlinkModal.isOpen) return null;

  const count =
    batchUnlinkModal.target === "user-detail"
      ? selUserDetailChars.size
      : selChars.size;

  const canConfirm = confirmInput.trim().toLowerCase() === "unlink";

  const handleConfirm = () => {
    if (!canConfirm) return;
    confirmBatchUnlink();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60]"
        onClick={closeBatchUnlinkModal}
      />
      <div className="fixed inset-0 flex items-center justify-center z-[70] pointer-events-none">
        <div
          className="bg-panel border border-tertiary/[8%] rounded-2xl p-8 w-[440px] pointer-events-auto drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#A46666]/10 flex items-center justify-center mt-0.5">
              <FaUnlink size={14} className="text-[#A46666]" />
            </div>
            <div>
              <h3 className="text-lg">
                Unlink{" "}
                <span className="text-[#A46666]">
                  {count} character{count !== 1 ? "s" : ""}
                </span>
                ?
              </h3>
              <p className="text-sm text-tertiary mt-1 leading-relaxed">
                This will permanently remove the selected characters and all of
                their scores. This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-tertiary uppercase tracking-wide font-medium">
              Type <span className="text-white font-semibold">unlink</span> to confirm
            </label>
            <input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              className="bg-background border border-tertiary/20 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40 transition-colors w-full"
              placeholder="unlink"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <Checkbox
              checked={batchUnlinkDeleteSource}
              onChange={() => setBatchUnlinkDeleteSource((v) => !v)}
            />
            <span className="text-sm text-tertiary">
              Also delete the source user from database
            </span>
          </label>

          <div className="flex gap-3 mt-1">
            <button
              disabled={!canConfirm}
              onClick={handleConfirm}
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm transition-colors",
                canConfirm
                  ? "bg-[#A46666]/15 hover:bg-[#A46666]/20 text-[#A46666]"
                  : "bg-background/60 text-tertiary/30 cursor-default"
              )}
            >
              Unlink
            </button>
            <button
              onClick={closeBatchUnlinkModal}
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
