import { useState, useEffect, useCallback } from "react";
import { FaArchive, FaEye, FaTimes, FaSpinner } from "react-icons/fa";
import axios from "axios";
import { cn } from "../../../lib/utils";
import { BOT_API } from "../constants";
import { useNotifications } from "../../../context/NotificationContext";
import type { BackupEntry } from "../types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const BackupsTab = () => {
  const { notify } = useNotifications();

  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalAnimating, setModalAnimating] = useState(false);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [modalContent, setModalContent] = useState<object | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<{ backups: BackupEntry[] }>(
        `${BOT_API}/bot/api/admin/backups`,
        { withCredentials: true }
      );
      setBackups(data.backups);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : null;
      notify("error", msg ?? "Failed to load backups");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const openModal = async (filename: string) => {
    setSelectedFilename(filename);
    setModalContent(null);
    setModalVisible(true);
    setLoadingContent(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setModalAnimating(true)));

    try {
      const { data } = await axios.get<{ filename: string; content: object }>(
        `${BOT_API}/bot/api/admin/backups/${encodeURIComponent(filename)}`,
        { withCredentials: true }
      );
      setModalContent(data.content);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : null;
      notify("error", msg ?? "Failed to load backup content");
      closeModal();
    } finally {
      setLoadingContent(false);
    }
  };

  const closeModal = () => {
    setModalAnimating(false);
    setTimeout(() => {
      setModalVisible(false);
      setSelectedFilename(null);
      setModalContent(null);
    }, 220);
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FaArchive size={16} className="text-tertiary/70" />
          <h2 className="text-lg">Backups</h2>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-tertiary/[8%] overflow-hidden">

        {loading ? (
          <div className="px-6 py-16 flex flex-col items-center gap-3 text-tertiary/50">
            <FaSpinner size={20} className="animate-spin" />
            <p className="text-sm">Loading backups…</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center gap-3 text-tertiary/50">
            <FaArchive size={20} />
            <p className="text-sm">No backups found</p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-panel border-b border-tertiary/[8%]">
              <span className="text-xs text-tertiary/50 font-medium uppercase tracking-wider">Filename</span>
              <span className="text-xs text-tertiary/50 font-medium uppercase tracking-wider">Date</span>
              <span className="text-xs text-tertiary/50 font-medium uppercase tracking-wider">Size</span>
              <span className="text-xs text-tertiary/50 font-medium uppercase tracking-wider">View</span>
            </div>

            <div className="divide-y divide-tertiary/[8%]">
              {backups.map((backup) => (
                <div
                  key={backup.filename}
                  className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-6 py-3.5 items-center hover:bg-white/[2%] transition-colors"
                >
                  <span className="text-sm font-mono text-white/90 truncate">{backup.filename}</span>
                  <span className="text-sm text-tertiary tabular-nums">{formatDate(backup.createdAt)}</span>
                  <span className="text-sm text-tertiary tabular-nums">{formatSize(backup.size)}</span>
                  <button
                    onClick={() => openModal(backup.filename)}
                    className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
                  >
                    <FaEye size={12} />
                    View
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* JSON viewer modal */}
      {modalVisible && (
        <>
          <div
            className={cn(
              "fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[80] transition-opacity duration-200",
              modalAnimating ? "opacity-100" : "opacity-0"
            )}
            onClick={closeModal}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[90] pointer-events-none">
            <div
              className={cn(
                "bg-panel border border-tertiary/[8%] rounded-2xl p-6 w-[720px] max-w-[94vw] max-h-[80vh] flex flex-col pointer-events-auto drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)] transition-all duration-200",
                modalAnimating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-1"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-start justify-between gap-4 mb-4 flex-shrink-0">
                <div>
                  <h3 className="text-lg">Backup Contents</h3>
                  <p className="text-sm text-tertiary mt-0.5 font-mono">{selectedFilename}</p>
                </div>
                <button
                  onClick={closeModal}
                  className="text-tertiary/50 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <FaTimes size={13} />
                </button>
              </div>

              {/* JSON content */}
              <div className="flex-1 min-h-0 rounded-xl border border-tertiary/[8%] overflow-hidden bg-background/60">
                {loadingContent ? (
                  <div className="flex items-center justify-center h-full py-16 text-tertiary/50 gap-3">
                    <FaSpinner size={16} className="animate-spin" />
                    <span className="text-sm">Loading…</span>
                  </div>
                ) : (
                  <pre className="text-xs text-white/80 font-mono leading-relaxed p-4 overflow-auto h-full whitespace-pre-wrap break-words">
                    {modalContent != null ? JSON.stringify(modalContent, null, 2) : ""}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
