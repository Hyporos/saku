import { useState, useEffect, useCallback, useRef } from "react";
import { FaArchive, FaSpinner, FaPlus, FaUpload, FaChevronUp, FaChevronDown, FaDownload } from "react-icons/fa";
import axios from "axios";
import { cn } from "../../../lib/utils";
import { BOT_API } from "../constants";
import { useNotifications } from "../../../context/NotificationContext";
import useAuth from "../../../hooks/useAuth";
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

const getBackupCategory = (filename: string): string => {
  if (filename.startsWith("saku_culvert_")) return "Culvert";
  return "Unknown";
};

type SortField = "filename" | "category" | "date" | "size";
type BackupSort = { field: SortField; dir: "asc" | "desc" } | null;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const BackupsTab = () => {
  const { notify } = useNotifications();
  const { user } = useAuth();
  const ownerId = import.meta.env.VITE_OWNER_ID as string | undefined;
  const isOwner = user?.id === ownerId;

  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [sort, setSort] = useState<BackupSort>({ field: "date", dir: "desc" });
  const importInputRef = useRef<HTMLInputElement>(null);

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

  const toggleSort = (field: SortField) => {
    setSort((prev) => {
      if (prev?.field === field) {
        if (prev.dir === "asc") return { field, dir: "desc" };
        return null;
      }
      return { field, dir: "asc" };
    });
  };

  const sortedBackups = [...backups].sort((a, b) => {
    if (!sort) return 0;
    const dir = sort.dir === "asc" ? 1 : -1;
    if (sort.field === "filename") return dir * a.filename.localeCompare(b.filename);
    if (sort.field === "category") return dir * getBackupCategory(a.filename).localeCompare(getBackupCategory(b.filename));
    if (sort.field === "size") return dir * (a.size - b.size);
    return dir * (new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf());
  });

  const handleDownload = async (filename: string) => {
    setDownloading(filename);
    try {
      const { data } = await axios.get<{ filename: string; content: object }>(
        `${BOT_API}/bot/api/admin/backups/${encodeURIComponent(filename)}`,
        { withCredentials: true }
      );
      const blob = new Blob([JSON.stringify(data.content, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : null;
      notify("error", msg ?? "Failed to download backup");
    } finally {
      setDownloading(null);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const { data } = await axios.post<{ success: boolean; filename: string; createdAt: string; size: number }>(
        `${BOT_API}/bot/api/admin/backups`,
        {},
        { withCredentials: true }
      );
      notify("success", `Backup created: ${data.filename}`);
      setBackups((prev) => [{ filename: data.filename, createdAt: data.createdAt, size: data.size }, ...prev]);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : null;
      notify("error", msg ?? "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const text = await file.text();
      const content = JSON.parse(text);
      const { data } = await axios.post<{ success: boolean; filename: string; createdAt: string; size: number }>(
        `${BOT_API}/bot/api/admin/backups/import`,
        { content },
        { withCredentials: true }
      );
      notify("success", `Backup imported: ${data.filename}`);
      setBackups((prev) => [{ filename: data.filename, createdAt: data.createdAt, size: data.size }, ...prev]);
    } catch (err) {
      if (err instanceof SyntaxError) {
        notify("error", "Invalid JSON file");
      } else {
        const msg = axios.isAxiosError(err) ? err.response?.data?.error : null;
        notify("error", msg ?? "Failed to import backup");
      }
    } finally {
      setImporting(false);
    }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Render

  const TableSortHead = ({ label, field }: { label: string; field: SortField }) => (
    <span
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
    >
      {label}
      <span
        className={cn(
          "inline-flex items-center text-accent transition-opacity duration-150",
          sort?.field === field ? "opacity-100" : "opacity-0"
        )}
      >
        {sort?.field === field && sort.dir === "asc" ? (
          <FaChevronUp size={9} />
        ) : (
          <FaChevronDown size={9} />
        )}
      </span>
    </span>
  );

  return (
    <div className="bg-panel rounded-xl overflow-visible flex-shrink-0">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5">
        <h2 className="text-xl">Backups</h2>
        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateBackup}
              disabled={creating}
              className="flex items-center gap-2 text-sm bg-accent/10 hover:bg-accent/15 border border-accent/40 text-accent rounded-lg px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? <FaSpinner size={11} className="animate-spin" /> : <FaPlus size={11} />}
              Create Backup
            </button>
            <button
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 text-sm text-tertiary hover:text-white border border-tertiary/20 hover:border-tertiary/40 rounded-lg px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importing ? <FaSpinner size={11} className="animate-spin" /> : <FaUpload size={11} />}
              Import
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportChange}
            />
          </div>
        )}
      </div>

      <div className="bg-tertiary/20 h-px" />

      {/* Body */}
      {loading ? (
        <div className="px-6 py-16 flex flex-col items-center gap-3 text-tertiary/50">
          <FaSpinner size={20} className="animate-spin" />
          <p className="text-sm">Loading backups...</p>
        </div>
      ) : backups.length === 0 ? (
        <div className="px-6 py-16 flex flex-col items-center gap-3 text-tertiary/50">
          <FaArchive size={24} />
          <p className="text-sm">No backups found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-b-xl">
          <table className={cn("w-full table-fixed", !isOwner && "opacity-100")}>
            <thead>
              <tr className="border-b border-tertiary/[8%]">
                <th className="text-left text-xs text-tertiary font-medium uppercase tracking-wider px-4 py-3 select-none">
                  <TableSortHead label="Filename" field="filename" />
                </th>
                <th className="text-left text-xs text-tertiary font-medium uppercase tracking-wider px-4 py-3 select-none w-[180px]">
                  <TableSortHead label="Category" field="category" />
                </th>
                <th className="text-left text-xs text-tertiary font-medium uppercase tracking-wider px-4 py-3 select-none w-[250px]">
                  <TableSortHead label="Date" field="date" />
                </th>
                <th className="text-left text-xs text-tertiary font-medium uppercase tracking-wider px-4 py-3 select-none w-[150px]">
                  <TableSortHead label="Size" field="size" />
                </th>
                <th className="text-left text-xs text-tertiary font-medium uppercase tracking-wider px-4 py-3 select-none w-[160px]">
                  Download
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedBackups.map((backup) => (
                <tr key={backup.filename} className="border-t border-tertiary/[6%] hover:bg-background/40 transition-colors">
                  <td className="px-4 py-3 overflow-hidden">
                    <span className="text-sm font-mono text-white truncate block">{backup.filename}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-accent/10 border border-accent/30 text-accent rounded-full px-2 py-0.5">
                      {getBackupCategory(backup.filename)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-tertiary tabular-nums">{formatDate(backup.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-tertiary tabular-nums">{formatSize(backup.size)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDownload(backup.filename)}
                      disabled={downloading === backup.filename}
                      className="flex items-center gap-1.5 text-xs bg-background/70 border border-tertiary/20 hover:border-accent/40 text-tertiary hover:text-white rounded-lg px-2.5 py-1 transition-colors disabled:opacity-40"
                    >
                      {downloading === backup.filename
                        ? <FaSpinner size={10} className="animate-spin" />
                        : <FaDownload size={10} />}
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
