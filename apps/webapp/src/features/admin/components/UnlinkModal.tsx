import { useEffect, useState } from "react";
import { FaUnlink } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import WarningModal from "../../../components/WarningModal";
import { useAdminContext } from "../context";
import type { CharDetail } from "../types";

export const UnlinkModal = () => {
  const {
    unlinkModal,
    closeUnlinkModal,
    unlinkDeleteSource,
    setUnlinkDeleteSource,
    unlinkCharacter,
  } = useAdminContext();

  // Latch char so title stays populated during the exit animation
  const [char, setChar] = useState<CharDetail | null>(unlinkModal.char);
  useEffect(() => {
    if (unlinkModal.char) setChar(unlinkModal.char);
  }, [unlinkModal.char]);

  // Reset checkbox each time the modal opens
  useEffect(() => {
    if (unlinkModal.isOpen) setUnlinkDeleteSource(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlinkModal.isOpen]);

  return (
    <WarningModal
      isOpen={unlinkModal.isOpen}
      colorVariant="red"
      icon={<FaUnlink size={13} className="text-[#A46666]" />}
      title={char ? <span>Unlink <span className="text-[#A46666]">{char.name}</span>?</span> : "Unlink?"}
      description="This will permanently remove the character and all of their scores."
      variant="sensitive"
      confirmWord="unlink"
      confirmLabel="Unlink"
      onConfirm={unlinkCharacter}
      onCancel={closeUnlinkModal}
    >
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <Checkbox
          checked={unlinkDeleteSource}
          onChange={() => setUnlinkDeleteSource((v) => !v)}
        />
        <span className="text-sm text-tertiary">Also delete the source user from database</span>
      </label>
    </WarningModal>
  );
};

