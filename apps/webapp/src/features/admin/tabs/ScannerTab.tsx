import { useState, useRef, useCallback, useEffect } from "react";
import {
  FaCamera,
  FaCloudUploadAlt,
  FaTimes,
  FaCheck,
  FaExclamationTriangle,
  FaRedo,
  FaDownload,
  FaChevronUp,
  FaChevronDown,
  FaClock,
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
  fingerprint: string;
};

type ScanPhase = "idle" | "scanning" | "done";

type WeekOption = "this_week" | "last_week";

type AnomalyEntry = {
  name: string;
  score: number;
  previousScore?: number;
  reason?: string;
};

type AggregatedResult = {
  success: ScanResultEntry[];
  notFound: { name: string }[];
  nanScores: { name: string }[];
  zeroScores: { name: string }[];
  totalSuccess: number;
  totalFailure: number;
  totalScanned: number;
  week: string;
  anomalies: AnomalyEntry[];
};

type TableSort = { field: "name" | "score" | "status"; dir: "asc" | "desc" } | null;

type WeekRecord = {
  week: string;
  finalized: boolean;
  override: boolean;
  submitted: number;
  total: number;
};

type WeekDetailData = WeekRecord & {
  scores: { name: string; score: number }[];
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/**
 * Compute a fast fingerprint from the first 2 KB of a file to detect duplicates.
 * Uses file size as a seed so two different files with the same initial bytes still differ.
 */
async function computeFingerprint(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arr = new Uint8Array(e.target!.result as ArrayBuffer);
      let hash = file.size;
      for (let i = 0; i < arr.length; i++) hash = ((hash << 5) - hash + arr[i]) | 0;
      resolve(`${hash >>> 0}-${file.size}`);
    };
    reader.readAsArrayBuffer(file.slice(0, 2048));
  });
}

/** Convert a File to { data: base64, mimeType } for the Gemini API. */
function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ data: result.split(",")[1], mimeType: file.type || "image/png" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Numeric rank for status-based sorting (lower = higher priority / "worse" status). */
function statusRank(entry: ScanResultEntry, isAnomaly: boolean): number {
  if (entry.isNaN) return 0;
  if (isAnomaly) return 1;
  if (entry.sandbag) return 2;
  if (entry.score === 0) return 3;
  return 4;
}

const UPLOAD_PAGE_SIZE = 8;

/** Small floating tooltip that follows our panel design. */
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => (
  <div className="relative group/tt inline-block">
    {children}
    <div className={cn(
      "absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50",
      "px-2.5 py-1.5 rounded-lg text-xs text-white/90 whitespace-nowrap shadow-xl",
      "bg-[#16171b] border border-tertiary/20",
      "pointer-events-none select-none",
      "opacity-0 translate-y-1 group-hover/tt:opacity-100 group-hover/tt:translate-y-0",
      "transition-all duration-150 ease-out",
    )}>
      {text}
      {/* caret */}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#16171b] -mt-px" />
    </div>
  </div>
);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const ScannerTab = () => {
  const { refreshUsers, refreshActionLog, openCharDetail, liveCharacters } = useAdminContext();
  const { notify } = useNotifications();

  const [images, setImages] = useState<ImageFile[]>([]);
  const [week, setWeek] = useState<WeekOption>("last_week");
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0, message: "", imageName: "" });
  const [results, setResults] = useState<AggregatedResult | null>(null);
  const [failedImages, setFailedImages] = useState<ImageFile[]>([]);
  const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [removeConfirmIdx, setRemoveConfirmIdx] = useState<number | null>(null);
  const [scanDuration, setScanDuration] = useState<number | null>(null);
  const [tableSort, setTableSort] = useState<TableSort>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [rescanningSingle, setRescanningSingle] = useState<Set<string>>(new Set());
  const [imageHasNotFound, setImageHasNotFound] = useState<Set<string>>(new Set());
  const [correctModal, setCorrectModal] = useState<{ name: string; week: string; currentScore: number } | null>(null);
  const [correctInput, setCorrectInput] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [weeks, setWeeks] = useState<WeekRecord[]>([]);
  const [weeksLoading, setWeeksLoading] = useState(true);
  const [weekDetail, setWeekDetail] = useState<WeekDetailData | null>(null);
  const [exceptionModal, setExceptionModal] = useState<{ exception: string } | null>(null);
  const [exceptionCharInput, setExceptionCharInput] = useState("");
  const [exceptionSaving, setExceptionSaving] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [uploadPage, setUploadPage] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const scanStartRef = useRef<number>(0);
  const fingerprintsRef = useRef<Set<string>>(new Set());

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Image handling

  const addImages = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const duplicateNames: string[] = [];
    const toAdd: ImageFile[] = [];

    for (const file of imageFiles) {
      const fp = await computeFingerprint(file);
      if (fingerprintsRef.current.has(fp)) {
        duplicateNames.push(file.name || "pasted image");
      } else {
        fingerprintsRef.current.add(fp);
        toAdd.push({ file, preview: URL.createObjectURL(file), fingerprint: fp });
      }
    }

    if (duplicateNames.length > 0) {
      for (const name of duplicateNames) {
        notify("error", `Duplicate image — ${name}`);
      }
    }

    if (toAdd.length > 0) setImages((prev) => [...prev, ...toAdd]);
  }, []);

  const removeImage = (index: number) => {
    setImages((prev) => {
      fingerprintsRef.current.delete(prev[index].fingerprint);
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

  const openLightbox = (src: string) => {
    setLightboxSrc(src);
    setLightboxVisible(false);
    requestAnimationFrame(() => setLightboxVisible(true));
  };

  const closeLightbox = () => {
    setLightboxVisible(false);
    setTimeout(() => { setLightboxSrc(null); }, 220);
  };

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeLightbox(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxSrc]);

  // Load week history on mount
  useEffect(() => {
    const loadWeeks = async () => {
      setWeeksLoading(true);
      try {
        const { data } = await axios.get<{ weeks: WeekRecord[] }>(`${BOT_API}/bot/api/admin/weeks`, { withCredentials: true });
        setWeeks(data.weeks);
      } catch {
        // non-critical
      } finally {
        setWeeksLoading(false);
      }
    };
    loadWeeks();
  }, []);

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Scan

  const startScan = async () => {
    if (images.length === 0) return;
    setPhase("scanning");
    setResults(null);
    setFailedImages([]);
    setFinalizeResult(null);
    setScanDuration(null);
    scanStartRef.current = Date.now();
    setProgress({ current: 0, total: images.length, message: "Starting scan...", imageName: "" });

    const aggregated: AggregatedResult = {
      success: [],
      notFound: [],
      nanScores: [],
      zeroScores: [],
      totalSuccess: 0,
      totalFailure: 0,
      totalScanned: 0,
      week: "",
      anomalies: [],
    };
    const failed: ImageFile[] = [];
    const notFoundFps = new Set<string>();

    for (let i = 0; i < images.length; i++) {
      const imageName = images[i].file.name || `Image ${i + 1}`;
      setProgress({
        current: i + 1,
        total: images.length,
        message: `Analyzing image ${i + 1} of ${images.length}`,
        imageName,
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
        if (data.notFound.length > 0) notFoundFps.add(images[i].fingerprint);
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

    // Detect score-order anomalies — culvert screenshots should be submitted in descending order,
    // so each score should be ≤ the previous non-zero, non-NaN, non-sandbag score. A score that
    // goes UP is a likely OCR misread (added/removed digit, misread number).
    // Sandbag entries are excluded from tracking so they don't cause false positives for
    // legitimate scores that come after them.
    let prevScore: number | null = null;
    for (const entry of aggregated.success) {
      if (!entry.isNaN && entry.score > 0 && !entry.sandbag) {
        if (prevScore !== null && entry.score > prevScore) {
          aggregated.anomalies.push({ name: entry.name, score: entry.score, previousScore: prevScore });
        }
        prevScore = entry.score;
      }
    }

    // Detect very short names (≤ 2 chars) — likely OCR failures
    for (const entry of aggregated.success) {
      if (entry.name.trim().length <= 2) {
        aggregated.anomalies.push({ name: entry.name, score: entry.score, reason: "Name too short, likely misread" });
      }
    }

    // Detect unrealistically high or low scores (excluding zero/NaN which are already tracked)
    for (const entry of aggregated.success) {
      if (!entry.isNaN && entry.score > 0) {
        if (entry.score >= 1_000_000 || entry.score <= 9999) {
          aggregated.anomalies.push({ name: entry.name, score: entry.score, reason: "Unusual score value" });
        }
      }
    }

    // Detect zero scores sandwiched between two non-zero scores — the OCR likely missed the
    // actual value and wrote 0, rather than the character genuinely scoring zero that week.
    for (let i = 1; i < aggregated.success.length - 1; i++) {
      const entry = aggregated.success[i];
      if (!entry.isNaN && entry.score === 0) {
        const prev = aggregated.success[i - 1];
        const next = aggregated.success[i + 1];
        if (prev.score > 0 && !prev.isNaN && next.score > 0 && !next.isNaN) {
          aggregated.anomalies.push({ name: entry.name, score: 0, reason: "Zero score, likely misread" });
        }
      }
    }

    const elapsed = parseFloat(((Date.now() - scanStartRef.current) / 1000).toFixed(2));
    setScanDuration(elapsed);

    const weekLabel =
      week === "this_week"
        ? `This Week (${aggregated.week})`
        : `Last Week (${aggregated.week})`;

    // Log the aggregate scan with full detail payload for the action log
    if (aggregated.totalScanned > 0) {
      try {
        await axios.post(
          `${BOT_API}/bot/api/admin/scanner/log`,
          {
            weekLabel,
            imageCount: images.length - failed.length,
            matched: aggregated.success,
            notFound: aggregated.notFound,
            nanScores: aggregated.nanScores,
            zeroScores: aggregated.zeroScores,
            anomalies: aggregated.anomalies,
          },
          { withCredentials: true }
        );
      } catch {
        // Non-critical — log silently
      }
    }

    setResults(aggregated);
    setFailedImages(failed);
    setImageHasNotFound(notFoundFps);
    setPhase("done");
    setProgress({ current: images.length, total: images.length, message: "Scan complete", imageName: "" });
    refreshUsers();
    refreshActionLog();

    if (failed.length > 0) {
      notify("info", `${failed.length} image${failed.length > 1 ? "s" : ""} failed to process`);
    } else {
      notify("success", `Scanned ${aggregated.totalScanned} entries across ${images.length} image${images.length !== 1 ? "s" : ""}`);
    }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Rescan (individual or all failed)

  const rescanSingle = async (img: ImageFile) => {
    setRescanningSingle((prev) => new Set(prev).add(img.fingerprint));
    try {
      const payload = await fileToBase64(img.file);
      const { data } = await axios.post<ScanImageResult>(
        `${BOT_API}/bot/api/admin/scanner/scan`,
        { image: payload, week },
        { withCredentials: true, timeout: 120_000 }
      );
      setResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          success: [...prev.success, ...data.success],
          notFound: [...prev.notFound, ...data.notFound],
          nanScores: [...prev.nanScores, ...data.nanScores],
          zeroScores: [...prev.zeroScores, ...data.zeroScores],
          totalSuccess: prev.totalSuccess + data.totalSuccess,
          totalFailure: prev.totalFailure + data.totalFailure,
          totalScanned: prev.totalScanned + data.totalScanned,
        };
      });
      setFailedImages((prev) => prev.filter((f) => f.fingerprint !== img.fingerprint));
      setImageHasNotFound((prev) => { const n = new Set(prev); if (data.notFound.length === 0) n.delete(img.fingerprint); return n; });
      notify("success", `${img.file.name || "Image"} rescanned successfully`);
      refreshUsers();
      refreshActionLog();
    } catch {
      notify("error", `Failed to rescan ${img.file.name || "image"}`);
    } finally {
      setRescanningSingle((prev) => { const n = new Set(prev); n.delete(img.fingerprint); return n; });
    }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Create exception from Not Found entry

  const handleCreateException = async () => {
    if (!exceptionModal || !exceptionCharInput.trim()) return;
    setExceptionSaving(true);
    try {
      await axios.post(
        `${BOT_API}/bot/api/admin/exceptions`,
        { name: exceptionCharInput.trim(), exception: exceptionModal.exception },
        { withCredentials: true }
      );
      notify("success", `Exception created: "${exceptionModal.exception}" → ${exceptionCharInput.trim()}`);
      refreshActionLog();
      setExceptionModal(null);
      setExceptionCharInput("");
    } catch {
      notify("error", "Failed to create exception");
    } finally {
      setExceptionSaving(false);
    }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Correct anomaly score inline

  const handleCorrect = async () => {
    if (!correctModal) return;
    const newScore = Number(correctInput);
    if (!Number.isFinite(newScore) || newScore < 0) return;
    setCorrecting(true);
    try {
      await axios.patch(
        `${BOT_API}/bot/api/admin/scores/${encodeURIComponent(correctModal.name)}/${correctModal.week}`,
        { score: newScore },
        { withCredentials: true }
      );
      setResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          success: prev.success.map((e) => e.name === correctModal.name ? { ...e, score: newScore } : e),
          anomalies: prev.anomalies.filter((a) => a.name !== correctModal.name),
        };
      });
      notify("success", `${correctModal.name} score corrected to ${newScore.toLocaleString()}`);
      refreshUsers();
      setCorrectModal(null);
      setCorrectInput("");
    } catch {
      notify("error", "Failed to correct score");
    } finally {
      setCorrecting(false);
    }
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Week detail

  const openWeekDetail = async (w: WeekRecord) => {
    try {
      const { data } = await axios.get<WeekDetailData>(`${BOT_API}/bot/api/admin/weeks/${w.week}`, { withCredentials: true });
      setWeekDetail(data);
    } catch {
      notify("error", "Failed to load week details");
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

      if (data.success) {
        notify("success", `Finalized — ${data.submitted}/${data.total} scores submitted`);
        refreshActionLog();
        // Refresh week history list then go back to home
        try {
          const r = await axios.get<{ weeks: WeekRecord[] }>(`${BOT_API}/bot/api/admin/weeks`, { withCredentials: true });
          setWeeks(r.data.weeks);
        } catch { /* non-critical */ }
        resetAll();
        return;
      } else {
        setFinalizeResult(data);
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
    fingerprintsRef.current.clear();
    setImages([]);
    setPhase("idle");
    setResults(null);
    setFailedImages([]);
    setFinalizeResult(null);
    setScanDuration(null);
    setTableSort(null);
    setRescanningSingle(new Set());
    setImageHasNotFound(new Set());
    setCorrectModal(null);
    setCorrectInput("");
    setExceptionModal(null);
    setExceptionCharInput("");
    setRemoveConfirmIdx(null);
    setLightboxVisible(false);
    setUploadPage(0);
    setProgress({ current: 0, total: 0, message: "", imageName: "" });
  };

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Table sort

  const toggleTableSort = (field: "name" | "score" | "status") => {
    setTableSort((prev) => {
      if (prev?.field === field) {
        if (prev.dir === "asc") return { field, dir: "desc" };
        return null;
      }
      return { field, dir: "asc" };
    });
  };

  const anomalyNames = new Set((results?.anomalies ?? []).map((a) => a.name));

  const sortedSuccess = results
    ? (() => {
        if (!tableSort) return results.success;
        const dir = tableSort.dir === "asc" ? 1 : -1;
        return [...results.success].sort((a, b) => {
          if (tableSort.field === "name") return dir * a.name.localeCompare(b.name);
          if (tableSort.field === "score") return dir * (a.score - b.score);
          if (tableSort.field === "status") return dir * (statusRank(a, anomalyNames.has(a.name)) - statusRank(b, anomalyNames.has(b.name)));
          return 0;
        });
      })()
    : [];

  const TableSortHead = ({ label, field }: { label: string; field: "name" | "score" | "status" }) => (
    <button
      type="button"
      onClick={() => toggleTableSort(field)}
      className="inline-flex items-center gap-1.5 hover:text-white/80 transition-colors"
    >
      {label}
      <span
        className={cn(
          "inline-flex items-center text-accent transition-opacity duration-150",
          tableSort?.field === field ? "opacity-100" : "opacity-0"
        )}
      >
        {tableSort?.field === field && tableSort.dir === "asc"
          ? <FaChevronUp size={9} />
          : <FaChevronDown size={9} />}
      </span>
    </button>
  );

  // ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
  // Render

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5">
        <h2 className="text-2xl font-medium">Scanner</h2>
        {phase === "done" && scanDuration !== null && (
          <span className="text-xs text-tertiary/50 flex items-center gap-1.5">
            <FaClock size={10} className="-mt-px" />
            Done in {scanDuration.toFixed(2)}s
          </span>
        )}
      </div>
      <div className="bg-tertiary/20 h-px mb-5" />

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Week selector — hidden once scan results are shown */}
        {phase !== "done" && (
          <div className="flex items-center gap-3 mb-5">
            <div className="flex rounded-lg overflow-hidden border border-tertiary/20">
              <button
                onClick={() => setWeek("last_week")}
                className={cn(
                  "px-4 py-1.5 text-sm transition-colors",
                  week === "last_week"
                    ? "bg-accent/15 text-accent border-r border-accent/30"
                    : "bg-background/60 text-tertiary hover:text-white border-r border-tertiary/20"
                )}
              >
                Last Week
              </button>
              <button
                onClick={() => setWeek("this_week")}
                className={cn(
                  "px-4 py-1.5 text-sm transition-colors",
                  week === "this_week"
                    ? "bg-accent/15 text-accent"
                    : "bg-background/60 text-tertiary hover:text-white"
                )}
              >
                This Week
              </button>
            </div>
          </div>
        )}

        {/* Upload area — hidden once scan is done */}
        {phase !== "done" && (
          <>
            {/* Shared hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addImages(e.target.files)}
            />

            {images.length === 0 ? (
              /* Empty state — big drop zone */
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
              </div>
            ) : (
              /* Images added — paginated grid + add-more square */
              <div
                ref={dropRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="mb-4"
              >
                {(() => {
                  const pageCount = Math.ceil(images.length / UPLOAD_PAGE_SIZE);
                  const safePage = Math.min(uploadPage, Math.max(0, pageCount - 1));
                  const pageSlice = images.slice(safePage * UPLOAD_PAGE_SIZE, (safePage + 1) * UPLOAD_PAGE_SIZE);
                  return (
                    <>
                      <div className="flex flex-wrap gap-3">
                        {pageSlice.map((img, localIdx) => {
                          const globalIdx = safePage * UPLOAD_PAGE_SIZE + localIdx;
                          return (
                            <div key={globalIdx} className="relative group">
                              <Tooltip text={img.file.name || `Screenshot ${globalIdx + 1}`}>
                                <img
                                  src={img.preview}
                                  alt={img.file.name || `Screenshot ${globalIdx + 1}`}
                                  onClick={() => openLightbox(img.preview)}
                                  className="w-40 h-28 object-cover rounded-lg border border-tertiary/20 cursor-zoom-in hover:border-accent/40 transition-colors"
                                />
                              </Tooltip>
                              {/* X badge — top-right, inside image */}
                              {phase === "idle" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setRemoveConfirmIdx(globalIdx); }}
                                  className="absolute top-1.5 right-1.5 w-[22px] h-[22px] flex items-center justify-center bg-[#C87070]/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/90"
                                >
                                  <FaTimes size={8} className="text-white hover:text-[#C87070]" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {/* Add-more box — same size as thumbnails, on last page only */}
                        {phase === "idle" && safePage === pageCount - 1 && (
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-40 h-28 border-2 border-dashed border-tertiary/20 rounded-lg flex flex-col items-center justify-center gap-2 text-tertiary/40 hover:text-accent hover:border-accent/40 transition-colors flex-shrink-0"
                          >
                            <FaCloudUploadAlt size={30} />
                            <span className="text-sm font-medium leading-none text-center">Add more</span>
                            <span className="text-xs leading-none text-tertiary/45">or Ctrl+V to paste</span>
                          </button>
                        )}
                      </div>
                      {/* Pagination controls */}
                      {pageCount > 1 && (
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => setUploadPage((p) => Math.max(0, p - 1))}
                            disabled={safePage === 0}
                            className="text-xs text-tertiary/60 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors px-2 py-1 rounded border border-tertiary/[10%] hover:border-tertiary/30"
                          >
                            ← Prev
                          </button>
                          <span className="text-xs text-tertiary/50 tabular-nums">
                            {safePage + 1} / {pageCount}
                          </span>
                          <button
                            onClick={() => setUploadPage((p) => Math.min(pageCount - 1, p + 1))}
                            disabled={safePage === pageCount - 1}
                            className="text-xs text-tertiary/60 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors px-2 py-1 rounded border border-tertiary/[10%] hover:border-tertiary/30"
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
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
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse flex-shrink-0" />
                    <span className="text-sm text-white/70 flex-shrink-0">
                      Scanning image {progress.current} of {progress.total}
                    </span>
                    {progress.imageName && (
                      <span className="text-xs text-tertiary/40 font-mono truncate">
                        — {progress.imageName}
                      </span>
                    )}
                  </div>
                </div>
                {/* Segmented progress: one segment per image */}
                <div className="flex gap-1 h-1.5">
                  {Array.from({ length: progress.total }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 rounded-full transition-colors duration-300",
                        i < progress.current - 1
                          ? "bg-accent/70"
                          : i === progress.current - 1
                            ? "bg-accent/40 animate-pulse"
                            : "bg-tertiary/[15%]"
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Week History — only shown when idle */}
            {phase === "idle" && (
              <div className="mt-8">
                <p className="text-xs font-medium text-tertiary/60 uppercase tracking-wider mb-3">Week History</p>
                {weeksLoading ? (
                  <p className="text-xs text-tertiary/40">Loading...</p>
                ) : weeks.length === 0 ? (
                  <p className="text-xs text-tertiary/40">No finalized weeks yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {weeks.map((w) => (
                      <button
                        key={w.week}
                        onClick={() => openWeekDetail(w)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-tertiary/[8%] hover:border-tertiary/20 bg-panel hover:bg-background/40 transition-colors text-left"
                      >
                        <span className="text-sm text-white font-mono">{w.week}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-tertiary/50">{w.submitted}/{w.total} scores</span>
                          {w.override && (
                            <span className="text-[10px] text-[#D4915E] border border-[#D4915E]/30 rounded px-1.5 py-0.5">Override</span>
                          )}
                          {w.finalized ? (
                            <span className="flex items-center gap-1 text-[10px] text-[#669A68] border border-[#669A68]/30 rounded-md px-1.5 py-0.5">
                              <FaCheck size={8} />
                              Finalized
                            </span>
                          ) : (
                            <span className="text-[10px] text-tertiary/40">Pending</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Results */}
        {phase === "done" && results && (
          <div className="space-y-5">

            {/* Main result area: table (left half) + stats panel (right half) */}
            <div className="flex gap-5 items-stretch">

              {/* Left — Matched Scores table with action buttons + images strip */}
              {results.success.length > 0 && (
                <div className="w-1/2 flex-shrink-0">
                  <h3 className="text-xs font-medium text-tertiary/60 uppercase tracking-wider mb-2">
                    Matched Scores
                  </h3>

                  <div className="rounded-xl border border-tertiary/[8%] overflow-hidden">
                    {/* Column headers — scrollbar does not overlap */}
                    <div className="bg-panel border-b border-tertiary/[6%]">
                      <table className="w-full text-sm table-fixed">
                        <thead>
                          <tr>
                            <th className="text-left text-xs text-tertiary font-medium uppercase tracking-wide px-4 py-3 select-none">
                              <TableSortHead label="CHARACTER" field="name" />
                            </th>
                            <th className="text-left text-xs text-tertiary font-medium uppercase tracking-wide px-4 py-3 select-none w-36">
                              <TableSortHead label="SCORE" field="score" />
                            </th>
                            <th className="text-center text-xs text-tertiary font-medium uppercase tracking-wide px-4 py-3 select-none w-20">
                              <TableSortHead label="STATUS" field="status" />
                            </th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                    {/* Scrollable body — scrollbar stays within this section only */}
                    <div className="overflow-y-auto max-h-[525px] bg-panel">
                      <table className="w-full text-sm table-fixed">
                        <colgroup><col /><col className="w-36" /><col className="w-20" /></colgroup>
                        <tbody>
                          {sortedSuccess.map((entry, i) => (
                            <tr key={i} className="border-t border-tertiary/[6%] hover:bg-background/40 transition-colors">
                              <td className="px-4 py-3 text-sm">
                                <button
                                  className="text-accent hover:text-white transition-colors text-left"
                                  onClick={() => {
                                    const c = liveCharacters.find((x) => x.name === entry.name);
                                    if (c) openCharDetail(c);
                                  }}
                                >
                                  {entry.name}
                                </button>
                              </td>
                              <td className={cn("px-4 py-3 text-left text-sm tabular-nums", entry.score === 0 && !entry.isNaN ? "text-[#C87070]" : "text-white")}>
                                {isNaN(entry.score) ? "—" : entry.score.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {entry.isNaN ? (
                                  <span className="text-xs text-[#D4915E]">NaN</span>
                                ) : anomalyNames.has(entry.name) ? (
                                  <span className="text-xs text-[#D4915E]">Anomaly</span>
                                ) : entry.sandbag ? (
                                  <span className="text-xs text-[#C8A855]">Sandbag</span>
                                ) : entry.score === 0 ? (
                                  <span className="text-xs text-tertiary/50">Zero</span>
                                ) : (
                                  <FaCheck size={11} className="inline text-[#669A68]" />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Scanned images strip — inside card, below divider */}
                    {images.length > 0 && (
                      <div className="border-t border-tertiary/[8%] p-3 bg-black/20">
                        <div className="flex flex-wrap gap-2">
                          {images.map((img, i) => {
                            const isFailed = failedImages.some((f) => f.fingerprint === img.fingerprint);
                            const hasNotFound = imageHasNotFound.has(img.fingerprint);
                            const isRetrying = rescanningSingle.has(img.fingerprint);
                            const needsRetry = isFailed || hasNotFound;
                            return (
                              <div key={i} className="relative group flex-shrink-0">
                                <img
                                  src={img.preview}
                                  alt={`Image ${i + 1}`}
                                  onClick={() => !needsRetry && openLightbox(img.preview)}
                                  className={cn(
                                    "w-14 h-14 object-cover rounded-lg border-2 transition-colors",
                                    isFailed
                                      ? "border-[#C87070] ring-2 ring-[#C87070]/30 opacity-60 cursor-default"
                                      : hasNotFound
                                        ? "border-[#D4915E] ring-2 ring-[#D4915E]/20 opacity-70 cursor-default"
                                        : "border-tertiary/20 cursor-zoom-in hover:border-accent/40"
                                  )}
                                />
                                {needsRetry && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); rescanSingle(img); }}
                                    disabled={isRetrying}
                                    title={isFailed ? "Image failed — retry" : "Had unmatched names — retry"}
                                    className="absolute inset-0 rounded-lg flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                                  >
                                    {isRetrying
                                      ? <div className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                                      : <FaRedo size={11} className={isFailed ? "text-[#C87070]" : "text-[#D4915E]"} />}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Missed characters warning */}
                  {finalizeResult && !finalizeResult.success && finalizeResult.missedCharacters.length > 0 && (
                    <div className="mt-3 bg-yellow-900/10 border border-yellow-800/30 rounded-lg p-4 space-y-3">
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
                </div>
              )}

              {/* Right — Stats + anomalies + not found */}
              <div className="flex-1 flex flex-col gap-3 min-w-0">

                {/* Summary grid */}
                <h3 className="text-xs font-medium text-tertiary/60 uppercase tracking-wider">
                  Scan Overview
                </h3>
                <div className="flex gap-2.5">
                  <SummaryCard label="Total Scanned" value={results.totalScanned} color="text-white" className="flex-1" />
                  <SummaryCard label="Matched" value={results.totalSuccess} color="text-[#669A68]" className="flex-1" />
                  <SummaryCard label="Not Found" value={results.totalFailure} color="text-[#C87070]" className="flex-1" />
                  <SummaryCard label="Zero Scores" value={results.zeroScores.length} color="text-[#C8A855]" className="flex-1" />
                </div>

                {/* Score order anomalies */}
                {results.anomalies.length > 0 && (
                  <div className="bg-orange-900/10 border border-orange-800/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FaExclamationTriangle className="text-[#D4915E] flex-shrink-0" size={11} />
                      <span className="text-xs font-medium text-[#D4915E] uppercase tracking-wider">
                        Score Anomalies ({results.anomalies.length})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {results.anomalies.map((a, i) => (
                        <div key={i} className="flex items-center justify-between gap-3">
                          <p className="text-xs text-[#D4915E]/80 flex-1 min-w-0">
                            <span className="text-white/80">{a.name}</span>
                            {a.reason
                              ? <>: {a.score > 0 ? a.score.toLocaleString() : "0"} &mdash; {a.reason}</>
                              : <>: {a.score.toLocaleString()} &mdash; expected &le; {a.previousScore!.toLocaleString()}</>}
                          </p>
                          <button
                            onClick={() => { setCorrectModal({ name: a.name, week: results.week, currentScore: a.score }); setCorrectInput(String(a.score)); }}
                            className="flex-shrink-0 text-[10px] text-accent hover:text-white border border-accent/30 hover:border-white/20 rounded px-1.5 py-0.5 transition-colors"
                          >
                            Correct
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sandbags */}
                {results.success.filter((e) => e.sandbag).length > 0 && (
                  <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FaExclamationTriangle className="text-[#C8A855] flex-shrink-0" size={11} />
                      <span className="text-xs font-medium text-[#C8A855] uppercase tracking-wider">
                        Score Sandbags ({results.success.filter((e) => e.sandbag).length})
                      </span>
                    </div>
                    <div className="space-y-1">
                      {results.success.filter((e) => e.sandbag).map((e, i) => {
                        const pct = e.personalBest && e.personalBest > 0
                          ? Math.round((e.score / e.personalBest) * 100)
                          : null;
                        return (
                          <p key={i} className="text-xs text-[#C8A855]/80">
                            <span className="text-white/80">{e.name}</span>
                            {`: ${e.score.toLocaleString()}`}
                            {pct !== null && (
                              <span className="text-[#C8A855]/60"> ({pct}% of personal best)</span>
                            )}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Not found */}
                {results.notFound.length > 0 && (
                  <div className="bg-red-900/10 border border-red-800/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FaExclamationTriangle className="text-[#C87070] flex-shrink-0" size={11} />
                      <span className="text-xs font-medium text-[#C87070] uppercase tracking-wider">
                        Not Found ({results.notFound.length})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {results.notFound.map((nf, i) => (
                        <div key={i} className="flex items-center justify-between gap-3">
                          <span className="text-xs text-white/80">{nf.name}</span>
                          <button
                            onClick={() => { setExceptionModal({ exception: nf.name }); setExceptionCharInput(""); }}
                            className="flex-shrink-0 text-[10px] text-accent hover:text-white border border-accent/30 hover:border-white/20 rounded px-1.5 py-0.5 transition-colors"
                          >
                            Add Exception
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions — float to bottom-right */}
                <div className="mt-auto pt-2 flex items-center justify-between gap-3">
                  <span className={cn(
                    "text-xs",
                    results.success.length >= liveCharacters.length
                      ? "text-[#669A68]"
                      : "text-[#C87070]"
                  )}>
                    {results.success.length}
                    <span className="opacity-50"> / </span>
                    {liveCharacters.length} scores submitted
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={resetAll}
                      className="flex items-center gap-1.5 text-sm text-tertiary hover:text-white border border-tertiary/[10%] hover:border-tertiary/30 rounded-lg px-4 py-2 transition-colors"
                    >
                      <FaRedo size={10} />
                      New Scan
                    </button>
                    <button
                      onClick={() => handleFinalize(false)}
                      disabled={finalizing}
                      className={cn(
                        "flex items-center gap-1.5 text-sm rounded-lg px-4 py-2 transition-colors",
                        finalizing
                          ? "bg-tertiary/10 text-tertiary/40 cursor-not-allowed"
                          : "bg-[#669A68]/10 hover:bg-[#669A68]/15 border border-[#669A68]/40 text-[#669A68]"
                      )}
                    >
                      <FaDownload size={10} />
                      {finalizing ? "Finalizing..." : "Finalize"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Add Exception modal */}
      {exceptionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => { setExceptionModal(null); setExceptionCharInput(""); }}
        >
          <div
            className="bg-panel border border-tertiary/[10%] rounded-xl p-6 w-80 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-medium text-white">Add Exception</h3>
              <p className="text-xs text-tertiary/60 mt-0.5">Map an OCR misread to the correct character</p>
            </div>
            <div>
              <label className="text-xs text-tertiary/60 mb-1.5 block uppercase tracking-wide">Exception (misread name)</label>
              <input
                type="text"
                value={exceptionModal.exception}
                onChange={(e) => setExceptionModal({ exception: e.target.value })}
                className="w-full bg-background border border-tertiary/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40"
              />
            </div>
            <div>
              <label className="text-xs text-tertiary/60 mb-1.5 block uppercase tracking-wide">Character Name (correct)</label>
              <input
                type="text"
                list="exc-char-list"
                value={exceptionCharInput}
                onChange={(e) => setExceptionCharInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateException()}
                autoFocus
                placeholder="e.g. Dánnis"
                className="w-full bg-background border border-tertiary/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40"
              />
              <datalist id="exc-char-list">
                {liveCharacters.map((c) => <option key={c.name} value={c.name} />)}
              </datalist>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setExceptionModal(null); setExceptionCharInput(""); }}
                className="text-sm text-tertiary hover:text-white transition-colors px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateException}
                disabled={exceptionSaving || !exceptionCharInput.trim()}
                className={cn(
                  "flex items-center gap-2 text-sm rounded-lg px-4 py-1.5 transition-colors",
                  exceptionSaving || !exceptionCharInput.trim()
                    ? "bg-tertiary/10 text-tertiary/40 cursor-not-allowed"
                    : "bg-accent/10 hover:bg-accent/15 border border-accent/40 text-accent"
                )}
              >
                {exceptionSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Correct score modal */}
      {correctModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => { setCorrectModal(null); setCorrectInput(""); }}
        >
          <div
            className="bg-panel border border-tertiary/[10%] rounded-xl p-6 w-80 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-medium text-white">Correct Score</h3>
              <p className="text-xs text-tertiary/60 mt-0.5">{correctModal.name}</p>
            </div>
            <div>
              <label className="text-xs text-tertiary/60 mb-1.5 block uppercase tracking-wide">New Score</label>
              <input
                type="number"
                min={0}
                value={correctInput}
                onChange={(e) => setCorrectInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCorrect()}
                autoFocus
                className="w-full bg-background border border-tertiary/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setCorrectModal(null); setCorrectInput(""); }}
                className="text-sm text-tertiary hover:text-white transition-colors px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={handleCorrect}
                disabled={correcting || correctInput === ""}
                className={cn(
                  "flex items-center gap-2 text-sm rounded-lg px-4 py-1.5 transition-colors",
                  correcting || correctInput === ""
                    ? "bg-tertiary/10 text-tertiary/40 cursor-not-allowed"
                    : "bg-accent/10 hover:bg-accent/15 border border-accent/40 text-accent"
                )}
              >
                {correcting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Week Detail Modal */}
      {weekDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setWeekDetail(null)}
        >
          <div
            className="bg-panel border border-tertiary/[10%] rounded-xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-tertiary/[8%]">
              <div>
                <h3 className="text-base font-medium text-white font-mono">{weekDetail.week}</h3>
                <p className="text-xs text-tertiary/50 mt-0.5">
                  {weekDetail.submitted}/{weekDetail.total} scores submitted
                  {weekDetail.override && " · Override used"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {weekDetail.finalized ? (
                  <span className="flex items-center gap-1.5 text-xs text-[#669A68] border border-[#669A68]/30 rounded-md px-2 py-1">
                    <FaCheck size={9} />
                    Finalized
                  </span>
                ) : (
                  <span className="text-xs text-tertiary/50">Not finalized</span>
                )}
                <button
                  onClick={() => setWeekDetail(null)}
                  className="text-tertiary hover:text-white transition-colors p-1"
                >
                  <FaTimes size={14} />
                </button>
              </div>
            </div>
            {weekDetail.scores.length > 0 ? (
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-panel border-b border-tertiary/[6%]">
                    <tr>
                      <th className="text-left text-xs text-tertiary font-medium uppercase tracking-wide px-5 py-2.5 w-10">#</th>
                      <th className="text-left text-xs text-tertiary font-medium uppercase tracking-wide px-4 py-2.5">Character</th>
                      <th className="text-left text-xs text-tertiary font-medium uppercase tracking-wide px-4 py-2.5">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekDetail.scores.map((s, i) => (
                      <tr key={i} className="border-t border-tertiary/[6%] hover:bg-background/30 transition-colors">
                        <td className="px-5 py-2.5 text-xs text-tertiary/50 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-2.5 text-sm text-white">{s.name}</td>
                        <td className="px-4 py-2.5 text-sm text-white tabular-nums">{s.score.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-8 text-sm text-tertiary/50 text-center">No scores recorded for this week</p>
            )}
          </div>
        </div>
      )}

      {/* Remove image confirmation modal */}
      {removeConfirmIdx !== null && images[removeConfirmIdx] !== undefined && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setRemoveConfirmIdx(null)}
        >
          <div
            className="bg-panel border border-tertiary/[10%] rounded-xl p-6 w-80 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-medium text-white">Remove Image?</h3>
              <p className="text-xs text-tertiary/60 mt-1 break-all">
                {images[removeConfirmIdx]?.file.name || `Image ${removeConfirmIdx + 1}`}
              </p>
            </div>
            <p className="text-sm text-tertiary/70">This image will be removed from the upload queue.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRemoveConfirmIdx(null)}
                className="text-sm text-tertiary hover:text-white transition-colors px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={() => { removeImage(removeConfirmIdx!); setRemoveConfirmIdx(null); }}
                className="flex items-center gap-2 text-sm bg-[#C87070]/10 hover:bg-[#C87070]/15 border border-[#C87070]/40 text-[#C87070] rounded-lg px-4 py-1.5 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop — fades independently */}
          <div
            className={cn(
              "absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-200",
              lightboxVisible ? "opacity-100" : "opacity-0"
            )}
            onClick={closeLightbox}
          />
          {/* Content — scales + fades */}
          <div
            className={cn(
              "relative transition-all duration-200 ease-out",
              lightboxVisible
                ? "opacity-100 scale-100"
                : "opacity-0 scale-95"
            )}
          >
            <img
              src={lightboxSrc}
              alt="Screenshot preview"
              className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl block"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const SummaryCard = ({ label, value, color, className }: { label: string; value: number; color: string; className?: string }) => (
  <div className={cn("bg-panel rounded-lg border border-tertiary/[6%] p-4 text-center", className)}>
    <p className={cn("text-2xl font-semibold tabular-nums", color)}>{value}</p>
    <p className="text-xs text-tertiary/50 mt-1">{label}</p>
  </div>
);
