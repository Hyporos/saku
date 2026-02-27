import { useState } from "react";
import type { CharDetail, DrawerState, ModalPayload, Section } from "../types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/**
 * Owns the slide-in drawer, the warning/confirmation modal, and the transfer
 * character modal — all the UI overlays that sit above the main panel content.
 */
export function useModals() {
  // ⎯⎯ Drawer ⎯⎯ //
  const [drawer, setDrawer] = useState<DrawerState>({
    isOpen: false,
    mode: "edit",
    section: "users",
    data: {},
  });

  // ⎯⎯ Warning modal ⎯⎯ //
  const [modal, setModal] = useState<(ModalPayload & { isOpen: boolean }) | null>(null);

  // ⎯⎯ Transfer modal ⎯⎯ //
  const [transferModal, setTransferModal] = useState<{ isOpen: boolean; char: CharDetail | null }>({
    isOpen: false,
    char: null,
  });
  const [transferToInput, setTransferToInput] = useState("");
  const [transferDeleteSource, setTransferDeleteSource] = useState(false);

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Helpers

  const openCreate = (section: Section) =>
    setDrawer({ isOpen: true, mode: "create", section, data: {} });

  const closeDrawer = () => setDrawer((prev) => ({ ...prev, isOpen: false }));

  const updateField = (field: string, value: unknown) =>
    setDrawer((prev) => ({ ...prev, data: { ...prev.data, [field]: value } }));

  const closeModal = () => {
    setModal((prev) => (prev ? { ...prev, isOpen: false } : null));
    setTimeout(() => setModal(null), 260);
  };

  const confirm = (payload: ModalPayload) => setModal({ ...payload, isOpen: true });

  const closeTransferModal = () => {
    setTransferModal({ isOpen: false, char: null });
    setTransferToInput("");
    setTransferDeleteSource(false);
  };

  return {
    drawer, setDrawer,
    modal, closeModal, confirm,
    openCreate, closeDrawer, updateField,
    transferModal, setTransferModal,
    transferToInput, setTransferToInput,
    transferDeleteSource, setTransferDeleteSource,
    closeTransferModal,
  };
}
