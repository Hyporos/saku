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

  // ⎯⎯ Rename modal ⎯⎯ //
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; char: CharDetail | null }>({
    isOpen: false,
    char: null,
  });

  // ⎯⎯ Unlink modal ⎯⎯ //
  const [unlinkModal, setUnlinkModal] = useState<{ isOpen: boolean; char: CharDetail | null }>({
    isOpen: false,
    char: null,
  });
  const [unlinkDeleteSource, setUnlinkDeleteSource] = useState(false);

  // ⎯⎯ Batch unlink modal ⎯⎯ //
  const [batchUnlinkModal, setBatchUnlinkModal] = useState<{
    isOpen: boolean;
    target: "user-detail" | "characters-tab";
  }>({ isOpen: false, target: "user-detail" });
  const [batchUnlinkDeleteSource, setBatchUnlinkDeleteSource] = useState(false);

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

  const closeRenameModal = () => setRenameModal({ isOpen: false, char: null });

  const closeUnlinkModal = () => {
    setUnlinkModal({ isOpen: false, char: null });
    setUnlinkDeleteSource(false);
  };

  const openBatchUnlinkModal = (target: "user-detail" | "characters-tab") => {
    setBatchUnlinkDeleteSource(false);
    setBatchUnlinkModal({ isOpen: true, target });
  };

  const closeBatchUnlinkModal = () => {
    setBatchUnlinkModal((prev) => ({ ...prev, isOpen: false }));
    setBatchUnlinkDeleteSource(false);
  };

  return {
    drawer, setDrawer,
    modal, closeModal, confirm,
    openCreate, closeDrawer, updateField,
    transferModal, setTransferModal,
    transferToInput, setTransferToInput,
    transferDeleteSource, setTransferDeleteSource,
    closeTransferModal,
    renameModal, setRenameModal, closeRenameModal,
    unlinkModal, setUnlinkModal,
    unlinkDeleteSource, setUnlinkDeleteSource,
    closeUnlinkModal,
    batchUnlinkModal, batchUnlinkDeleteSource, setBatchUnlinkDeleteSource,
    openBatchUnlinkModal, closeBatchUnlinkModal,
  };
}
