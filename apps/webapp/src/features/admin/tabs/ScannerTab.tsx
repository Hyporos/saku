import { useState, useRef, useCallback, useEffect } from "react";
import {
  FaCamera,
  FaCloudUploadAlt,
  FaTimes,
  FaCheck,
  FaExclamationTriangle,
  FaRedo,
  FaDownload,
  FaFlag,
} from "react-icons/fa";
import axios from "axios";
import { cn } from "../../../lib/utils";
import { BOT_API } from "../constants";
import { useAdminContext } from "../context";
import { useNotifications } from "../../../context/NotificationContext";
import type { ScanResultEntry, ScanImageResult, FinalizeResult } from "../types";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

type ImageFile = {
  file: File;
  preview: string;
};

type ScanPhase = "idle" | "scanning" | "done";

type WeekOption = "this_week" | "last_week";

type AggregatedResult = {
  success: ScanResultEntry[];
  notFound: { name: string }[];
  nanScores: { name: string }[];
  zeroScores: { name: string }[];
  totalSuccess: number;
  totalFailure: number;
  totalScanned: number;
  week: string;
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/** Convert a File to { data: base64, mimeType } for the API. */
function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip `data:image/png;base64,` prefix
      const base64 = result.split(",")[1];
      resolve({ data: base64, mimeType: file.type || "image/png" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const ScannerTab = () => {
  const { refreshUsers, refreshActionLog } = useAdminContext();
  const { notify } = useNotifications();

  // State
  const [images, setImages] = useState<ImageFile[]>([]);
  const [week, setWeek] = useState<WeekOption>("this_week");
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0, message: "" });
  const [results, setResults] = useState<AggregatedResult | null>(null);
  const [failedImages, setFailedImages] = useState<ImageFile[]>([]);
  const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Image handling

  const addImages = useCallback((files: FileList | File[]) => {
    const newImages: ImageFile[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }));
    setImages((prev) => [...prev, ...newImages]);
  }, []);

  const removeImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files.length) addImages(e.dataTransfer.files);
    },
    [addImages]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Paste anywhere on the page to add an image
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept paste inside text inputs / textareas
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      // Don't accept paste once scan is in progress or done
      if (phase !== "idle") return;

      const items = Array.from(e.clipboardData?.items ?? []);
      const imageFiles = items
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);

      if (imageFiles.length > 0) {
        addImages(imageFiles);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [phase, addImages]);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxSrc(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxSrc]);

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Scan

  const startScan = async () => {
    if (images.length === 0) return;
    setPhase("scanning");
    setResults(null);
    setFailedImages([]);
    setFinalizeResult(null);
    setProgress({ current: 0, total: images.length, message: "Starting scan..." });

    const aggregated: AggregatedResult = {
      success: [],
      notFound: [],
      nanScores: [],
      zeroScores: [],
      totalSuccess: 0,
      totalFailure: 0,
      totalScanned: 0,
      week: "",
    };
    const failed: ImageFile[] = [];

    for (let i = 0; i < images.length; i++) {
      setProgress({
        current: i + 1,
        total: images.length,
        message: `Analyzing image ${i + 1} of ${images.length}...`,
      });

      try {
        const payload = await fileToBase64(images[i].file);
        const { data } = await axios.post<ScanImageResult>(
          `${BOT_API}/bot/api/admin/scanner/scan`,
          { image: payload, week },
          { withCredentials: true, timeout: 120_000 }
        );

        aggregated.week = data.week;
        aggregated.success.push(...data.success);
        aggregated.notFound.push(...data.notFound);
        aggregated.nanScores.push(...data.nanScores);
        aggregated.zeroScores.push(...data.zeroScores);
        aggregated.totalSuccess += data.totalSuccess;
        aggregated.totalFailure += data.totalFailure;
        aggregated.totalScanned += data.totalScanned;
      } catch (err) {
        console.error("Scan failed for image", i, err);
        failed.push(images[i]);
      }
    }

    // Log the aggregate scan
    if (aggregated.totalScanned > 0) {
      try {
        await axios.post(
          `${BOT_API}/bot/api/admin/scanner/log`,
          {
            week: aggregated.week,
            imageCount: images.length - failed.length,
            totalSuccess: aggregated.totalSuccess,
            totalFailure: aggregated.totalFailure,
          },
          { withCredentials: true }
        );
      } catch {
        // Non-critical — log silently
      }
    }

    setResults(aggregated);
    setFailedImages(failed);
    setPhase("done");
    setProgress({ current: images.length, total: images.length, message: "Scan complete" });
    refreshUsers();
    refreshActionLog();

    if (failed.length > 0) {
      notify("info", `${failed.length} image${failed.length > 1 ? "s" : ""} failed to process`);
    } else {
      notify("success", `Scanned ${aggregated.totalScanned} entries across ${images.length} image${images.length > 1 ? "s" : ""}`);
    }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Rescan failed images

  const rescan = async () => {
    if (failedImages.length === 0) return;
    setPhase("scanning");
    setProgress({ current: 0, total: failedImages.length, message: "Rescanning failed images..." });
    const prevResults = results;

    const failed: ImageFile[] = [];

    for (let i = 0; i < failedImages.length; i++) {
      setProgress({
        current: i + 1,
        total: failedImages.length,
        message: `Rescanning image ${i + 1} of ${failedImages.length}...`,
      });

      try {
        const payload = await fileToBase64(failedImages[i].file);
        const { data } = await axios.post<ScanImageResult>(
          `${BOT_API}/bot/api/admin/scanner/scan`,
          { image: payload, week },
          { withCredentials: true, timeout: 120_000 }
        );

        if (prevResults) {
          prevResults.success.push(...data.success);
          prevResults.notFound.push(...data.notFound);
          prevResults.nanScores.push(...data.nanScores);
          prevResults.zeroScores.push(...data.zeroScores);
          prevResults.totalSuccess += data.totalSuccess;
          prevResults.totalFailure += data.totalFailure;
          prevResults.totalScanned += data.totalScanned;
        }
      } catch {
        failed.push(failedImages[i]);
      }
    }

    setResults(prevResults ? { ...prevResults } : null);
    setFailedImages(failed);
    setPhase("done");
    refreshUsers();
    refreshActionLog();

    if (failed.length > 0) {
      notify("info", `${failed.length} image${failed.length > 1 ? "s" : ""} still failing`);
    } else {
      notify("success", "All failed images rescanned successfully");
    }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Finalize

  const handleFinalize = async (override = false) => {
    setFinalizing(true);
    try {
      const { data } = await axios.post<FinalizeResult>(
        `${BOT_API}/bot/api/admin/scanner/finalize`,
        { week, override },
        { withCredentials: true }
      );

      setFinalizeResult(data);

      if (data.success && data.backup) {
        // Download backup
        const blob = new Blob([atob(data.backup)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.backupFilename || `culvert-backup.json`;
        a.click();
        URL.revokeObjectURL(url);
        notify("success", `Finalized — ${data.submitted}/${data.total} scores submitted`);
        refreshActionLog();
      } else if (!data.success) {
        notify("info", `${data.missedCharacters.length} characters still missing scores`);
      }
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Finalize failed";
      notify("error", msg ?? "Finalize failed");
    } finally {
      setFinalizing(false);
    }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Reset

  const resetAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setPhase("idle");
    setResults(null);
    setFailedImages([]);
    setFinalizeResult(null);
    setProgress({ current: 0, total: 0, message: "" });
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Render

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-5">
        <div className="flex items-center gap-3">
          <h2 className="text-xl">Scanner</h2>
          <span className="bg-background text-tertiary text-xs rounded-full px-2.5 py-0.5 border border-tertiary/20">
            <FaCamera size={10} className="inline mr-1.5 -mt-px" />
            Culvert OCR
          </span>
        </div>
        {phase === "done" && (
          <button
            onClick={resetAll}
            className="flex items-center gap-2 text-sm text-tertiary hover:text-white transition-colors"
          >
            <FaRedo size={11} />
            New Scan
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Week selector */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-sm text-tertiary">Week:</span>
          <div className="flex rounded-lg overflow-hidden border border-tertiary/20">
            <button
              onClick={() => setWeek("this_week")}
              className={cn(
                "px-4 py-1.5 text-sm transition-colors",
                week === "this_week"
                  ? "bg-accent/15 text-accent border-r border-accent/30"
                  : "bg-background/60 text-tertiary hover:text-white border-r border-tertiary/20"
              )}
            >
              This Week
            </button>
            <button
              onClick={() => setWeek("last_week")}
              className={cn(
                "px-4 py-1.5 text-sm transition-colors",
                week === "last_week"
                  ? "bg-accent/15 text-accent"
                  : "bg-background/60 text-tertiary hover:text-white"
              )}
            >
              Last Week
            </button>
          </div>
        </div>

        {/* Upload area — hidden once scan is done */}
        {phase !== "done" && (
          <>
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-tertiary/20 rounded-xl p-8 text-center cursor-pointer hover:border-accent/40 transition-colors mb-4"
            >
              <FaCloudUploadAlt size={36} className="mx-auto text-tertiary/40 mb-3" />
              <p className="text-sm text-tertiary">
                Drop culvert screenshots here or <span className="text-accent">browse</span>
              </p>
              <p className="text-xs text-tertiary/50 mt-1">PNG, JPG, WEBP — or paste with Ctrl+V</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addImages(e.target.files)}
              />
            </div>

            {/* Image thumbnails */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-5">
                {images.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={img.preview}
                      alt={`Screenshot ${i + 1}`}
                      onClick={() => setLightboxSrc(img.preview)}
                      className="w-24 h-24 object-cover rounded-lg border border-tertiary/20 cursor-zoom-in hover:border-accent/40 transition-colors"
                    />
                    {phase === "idle" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                        className="absolute -top-1.5 -right-1.5 bg-background border border-tertiary/20 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:border-[#C87070]/40"
                      >
                        <FaTimes size={10} className="text-tertiary hover:text-[#C87070]" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Scan button + progress */}
            {images.length > 0 && phase === "idle" && (
              <button
                onClick={startScan}
                className="flex items-center gap-2 bg-accent/10 hover:bg-accent/15 border border-accent/40 text-accent text-sm rounded-lg px-5 py-2 transition-colors"
              >
                <FaCamera size={13} />
                Scan {images.length} Image{images.length !== 1 ? "s" : ""}
              </button>
            )}

            {phase === "scanning" && (
              <div className="mt-2">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
                  <span className="text-sm text-tertiary">{progress.message}</span>
                </div>
                <div className="w-full bg-background/80 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-accent/60 rounded-full transition-all duration-500"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-tertiary/50 mt-1">
                  {progress.current} / {progress.total} images processed
                </p>
              </div>
            )}
          </>
        )}

        {/* Results */}
        {phase === "done" && results && (
          <div className="space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
              <SummaryCard label="Total Scanned" value={results.totalScanned} color="text-white" />
              <SummaryCard label="Matched" value={results.totalSuccess} color="text-[#669A68]" />
              <SummaryCard label="Not Found" value={results.totalFailure} color="text-[#C87070]" />
              <SummaryCard label="Zero Scores" value={results.zeroScores.length} color="text-[#C8A855]" />
            </div>

            {/* Failed images — rescan */}
            {failedImages.length > 0 && (
              <div className="bg-red-900/10 border border-red-800/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FaExclamationTriangle className="text-[#C87070]" size={14} />
                    <span className="text-sm text-[#C87070]">
                      {failedImages.length} image{failedImages.length !== 1 ? "s" : ""} failed to process
                    </span>
                  </div>
                  <button
                    onClick={rescan}
                    className="flex items-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors"
                  >
                    <FaRedo size={11} />
                    Rescan
                  </button>
                </div>
              </div>
            )}

            {/* Successful entries */}
            {results.success.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-tertiary/70 uppercase tracking-wider mb-2">
                  Matched Scores
                </h3>
                <div className="bg-panel rounded-lg border border-tertiary/[6%] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-tertiary/10 text-tertiary/60 text-xs uppercase tracking-wider">
                        <th className="text-left px-4 py-2.5 font-medium">Character</th>
                        <th className="text-right px-4 py-2.5 font-medium">Score</th>
                        <th className="text-center px-4 py-2.5 font-medium w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.success.map((entry, i) => (
                        <tr key={i} className="border-b border-tertiary/[4%] last:border-0">
                          <td className="px-4 py-2 text-white">{entry.name}</td>
                          <td className="px-4 py-2 text-right text-white tabular-nums">
                            {isNaN(entry.score) ? "—" : entry.score.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {entry.sandbag ? (
                              <span className="inline-flex items-center gap-1 text-xs text-[#C8A855]">
                                <FaFlag size={9} />
                                Sandbag
                              </span>
                            ) : entry.isNaN ? (
                              <span className="text-xs text-[#D4915E]">NaN</span>
                            ) : (
                              <FaCheck size={11} className="inline text-[#669A68]" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Not found characters */}
            {results.notFound.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-tertiary/70 uppercase tracking-wider mb-2">
                  Not Found
                </h3>
                <div className="bg-panel rounded-lg border border-tertiary/[6%] p-4">
                  <div className="flex flex-wrap gap-2">
                    {results.notFound.map((nf, i) => (
                      <span
                        key={i}
                        className="bg-red-900/20 text-[#C87070] border border-red-800/30 rounded-md px-2.5 py-1 text-xs"
                      >
                        {nf.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Finalize section */}
            <div className="mt-6 pt-5 border-t border-tertiary/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-white mb-1">Finalize Week</h3>
                  <p className="text-xs text-tertiary/50">
                    Check for missing scores, create a backup, and mark the week as complete.
                  </p>
                </div>
                <button
                  onClick={() => handleFinalize(false)}
                  disabled={finalizing}
                  className={cn(
                    "flex items-center gap-2 text-sm rounded-lg px-5 py-2 transition-colors",
                    finalizing
                      ? "bg-tertiary/10 text-tertiary/40 cursor-not-allowed"
                      : "bg-[#669A68]/10 hover:bg-[#669A68]/15 border border-[#669A68]/40 text-[#669A68]"
                  )}
                >
                  <FaDownload size={12} />
                  {finalizing ? "Finalizing..." : "Finalize"}
                </button>
              </div>

              {/* Finalize result — missed characters */}
              {finalizeResult && !finalizeResult.success && finalizeResult.missedCharacters.length > 0 && (
                <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FaExclamationTriangle className="text-[#C8A855]" size={13} />
                    <span className="text-sm text-[#C8A855]">
                      {finalizeResult.missedCharacters.length} characters have no score for this week
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {finalizeResult.missedCharacters.map((name, i) => (
                      <span
                        key={i}
                        className="bg-yellow-900/20 text-[#C8A855] border border-yellow-800/20 rounded-md px-2 py-0.5 text-xs"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => handleFinalize(true)}
                    disabled={finalizing}
                    className="flex items-center gap-2 text-sm text-[#D4915E] hover:text-[#D4915E]/80 transition-colors"
                  >
                    <FaDownload size={11} />
                    {finalizing ? "Finalizing..." : "Finalize Anyway"}
                  </button>
                </div>
              )}

              {/* Finalize success message */}
              {finalizeResult?.success && (
                <div className="bg-[#669A68]/10 border border-[#669A68]/30 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <FaCheck className="text-[#669A68]" size={13} />
                    <span className="text-sm text-[#669A68]">
                      Week finalized — {finalizeResult.submitted}/{finalizeResult.total} scores submitted. Backup downloaded.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 bg-background/80 border border-tertiary/20 rounded-full p-2 text-tertiary hover:text-white transition-colors"
          >
            <FaTimes size={14} />
          </button>
          <img
            src={lightboxSrc}
            alt="Screenshot preview"
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const SummaryCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="bg-panel rounded-lg border border-tertiary/[6%] p-4 text-center">
    <p className={cn("text-2xl font-semibold tabular-nums", color)}>{value}</p>
    <p className="text-xs text-tertiary/50 mt-1">{label}</p>
  </div>
);
