import { useEffect } from "react";
import { FaUnlink } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import WarningModal from "../../../components/WarningModal";
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

  const count =
    batchUnlinkModal.target === "user-detail"
      ? selUserDetailChars.size
      : selChars.size;

  // Reset delete-source checkbox each time the modal opens
  useEffect(() => {
    if (batchUnlinkModal.isOpen) setBatchUnlinkDeleteSource(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchUnlinkModal.isOpen]);

  return (
    <WarningModal
      isOpen={batchUnlinkModal.isOpen}
      colorVariant="red"
      icon={<FaUnlink size={13} className="text-[#A46666]" />}
      title={
        <span>
          Unlink <span className="text-[#A46666]">{count} character{count !== 1 ? "s" : ""}</span>?
        </span>
      }
      description="This will permanently remove the selected characters and all of their scores."
      variant="sensitive"
      confirmWord="unlink"
      confirmLabel="Unlink"
      onConfirm={confirmBatchUnlink}
      onCancel={closeBatchUnlinkModal}
    >
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <Checkbox
          checked={batchUnlinkDeleteSource}
          onChange={() => setBatchUnlinkDeleteSource((v) => !v)}
        />
        <span className="text-sm text-tertiary">Also delete the source user from database</span>
      </label>
    </WarningModal>
  );
};

