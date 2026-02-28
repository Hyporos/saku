import { useState, useRef, useCallback, useEffect } from "react";
import {
  FaCamera,
  FaCloudUploadAlt,
  FaCheck,
  FaExclamationTriangle,
  FaRedo,
  FaDownload,
  FaChevronUp,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
} from "react-icons/fa";
import axios from "axios";
import { cn } from "../../../lib/utils";
import { BOT_API } from "../constants";
import { useAdminContext } from "../context";
import { useNotifications } from "../../../context/NotificationContext";
import AutocompleteInput from "../../../components/AutocompleteInput";
import Divider from "../../../components/Divider";
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

/** Small floating tooltip that follows our panel design. */
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => (
  <div className="relative group/tt inline-block">
    {children}
    <div className={cn(
      "fixed z-[9999]",
      "px-2.5 py-1.5 rounded-lg text-xs text-white/90 whitespace-nowrap shadow-xl",
      "bg-[#16171b] border border-tertiary/20",
      "pointer-events-none select-none",
      "opacity-0 translate-y-1 group-hover/tt:opacity-100 group-hover/tt:translate-y-0",
      "transition-all duration-150 ease-out",
      // Position above the element using CSS anchor-like approach via group
      "bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2",
    )}
    style={{ position: "absolute" }}>
      {text}
      {/* caret */}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#16171b] -mt-px" />
    </div>
  </div>
);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const ScannerTab = () => {
  const { refreshUsers, refreshActionLog, openCharDetail, liveCharacters, liveScores, activeToolSection } = useAdminContext();
  const { notify } = useNotifications();

  const [images, setImages] = useState<ImageFile[]>([]);
  const [week, setWeek] = useState<WeekOption>("last_week");
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0, message: "", imageName: "" });
  const [results, setResults] = useState<AggregatedResult | null>(null);
  const [failedImages, setFailedImages] = useState<ImageFile[]>([]);
  const [, setFinalizeResult] = useState<FinalizeResult | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [removeConfirmIdx, setRemoveConfirmIdx] = useState<number | null>(null);
  const [scanDuration, setScanDuration] = useState<number | null>(null);
  const [tableSort, setTableSort] = useState<TableSort>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [rescanningSingle, setRescanningSingle] = useState<Set<string>>(new Set());
  const [imageHasNotFound, setImageHasNotFound] = useState<Set<string>>(new Set());
  const [correctModal, setCorrectModal] = useState<{ name: string; week: string; currentScore: number } | null>(null);
  const [correctInput, setCorrectInput] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [exceptionModal, setExceptionModal] = useState<{ exception: string; fingerprint?: string } | null>(null);
  const [exceptionCharInput, setExceptionCharInput] = useState("");
  const [exceptionSaving, setExceptionSaving] = useState(false);
  const [finalizeWarnModal, setFinalizeWarnModal] = useState<{ notFound: string[]; anomalies: string[]; missing: string[] } | null>(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const scanStartRef = useRef<number>(0);
  const fingerprintsRef = useRef<Set<string>>(new Set());
  // Tracks whether the last mousedown on a modal backdrop originated ON the backdrop itself.
  // Prevents drag-out-to-close: click started inside modal, released outside = should NOT close.
  const backdropDownRef = useRef(false);
  // Maps image fingerprint → OCR-read notFound names for that image.
  // Required because after an exception is created the rescan returns the correct DB name in
  // data.success, but prev.notFound still holds the original OCR name — they don't match.
  const imageNotFoundNamesRef = useRef<Map<string, string[]>>(new Map());
  // Tracks character names whose scores were manually corrected during this scan session
  // so that subsequent rescans don't overwrite the corrected score with the original bad OCR score.
  const manuallyCorrectedRef = useRef<Set<string>>(new Set());

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

  const openLightbox = (idx: number) => {
    setLightboxIdx(idx);
    setLightboxVisible(false);
    requestAnimationFrame(() => setLightboxVisible(true));
  };

  const closeLightbox = () => {
    setLightboxVisible(false);
    setTimeout(() => { setLightboxIdx(null); }, 220);
  };

  const lightboxPrev = () => {
    if (lightboxIdx === null || images.length === 0) return;
    const next = lightboxIdx <= 0 ? images.length - 1 : lightboxIdx - 1;
    setLightboxIdx(next);
  };

  const lightboxNext = () => {
    if (lightboxIdx === null || images.length === 0) return;
    const next = lightboxIdx >= images.length - 1 ? 0 : lightboxIdx + 1;
    setLightboxIdx(next);
  };

  // Close lightbox on Escape, arrow key nav
  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") lightboxPrev();
      else if (e.key === "ArrowRight") lightboxNext();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxIdx, images.length]);

  // Reset week selector to default when returning to scanner while idle
  useEffect(() => {
    if (activeToolSection === "scanner" && phase === "idle") {
      setWeek("last_week");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToolSection]);

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

    // Dispatch all images in parallel — each image fires its own scan request concurrently
    // instead of waiting for the previous one to finish. Progress updates as each resolves.
    let completedCount = 0;
    const scanResults = await Promise.allSettled(
      images.map(async (img, i) => {
        const payload = await fileToBase64(img.file);
        const { data } = await axios.post<ScanImageResult>(
          `${BOT_API}/bot/api/admin/scanner/scan`,
          { image: payload, week },
          { withCredentials: true, timeout: 120_000 }
        );
        setProgress({
          current: ++completedCount,
          total: images.length,
          message: `Analyzed ${completedCount} of ${images.length} images`,
          imageName: img.file.name || `Image ${i + 1}`,
        });
        return { img, data };
      })
    );

    for (let i = 0; i < scanResults.length; i++) {
      const result = scanResults[i];
      if (result.status === "fulfilled") {
        const { img, data } = result.value;
        aggregated.week = data.week;
        aggregated.success.push(...data.success);
        aggregated.notFound.push(...data.notFound);
        if (data.notFound.length > 0) {
          notFoundFps.add(img.fingerprint);
          // Store OCR-read names so rescan can resolve them even when after an exception
          // the backend returns the corrected DB name (which differs from the OCR name).
          imageNotFoundNamesRef.current.set(img.fingerprint, data.notFound.map((nf: { name: string }) => nf.name));
        }
        aggregated.nanScores.push(...data.nanScores);
        aggregated.zeroScores.push(...data.zeroScores);
        aggregated.totalSuccess += data.totalSuccess;
        aggregated.totalFailure += data.totalFailure;
        aggregated.totalScanned += data.totalScanned;
      } else {
        console.error("Scan failed for image", i, result.reason);
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

    // If absolutely no data was retrieved, show an error and reset instead of going to results
    if (aggregated.totalScanned === 0 && failed.length === images.length) {
      notify("error", "No data could be retrieved from the uploaded images");
      resetAll();
      return;
    }

    setResults(aggregated);
    setFailedImages(failed);
    setImageHasNotFound(notFoundFps);
    setPhase("done");
    setProgress({ current: images.length, total: images.length, message: "Scan complete", imageName: "" });
    refreshUsers();
    refreshActionLog();
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

        // Merge matched scores: update existing entries by name, add new ones
        const newSuccessNames = new Set(data.success.map((e: ScanResultEntry) => e.name));
        const mergedSuccess = prev.success.map((e) =>
          newSuccessNames.has(e.name) && !manuallyCorrectedRef.current.has(e.name)
            ? data.success.find((n: ScanResultEntry) => n.name === e.name)!
            : e
        );
        // Insert newly found entries at their correct position relative to scan neighbors,
        // rather than always appending at the end.
        for (const entry of data.success) {
          if (prev.success.some((e) => e.name === entry.name)) continue;
          const entryIdx = data.success.findIndex((e) => e.name === entry.name);
          let insertIdx = mergedSuccess.length;
          for (let j = entryIdx - 1; j >= 0; j--) {
            const neighborName = data.success[j].name;
            const pos = mergedSuccess.findIndex((e) => e.name === neighborName);
            if (pos !== -1) { insertIdx = pos + 1; break; }
          }
          if (insertIdx === mergedSuccess.length) {
            for (let j = entryIdx + 1; j < data.success.length; j++) {
              const neighborName = data.success[j].name;
              const pos = mergedSuccess.findIndex((e) => e.name === neighborName);
              if (pos !== -1) { insertIdx = pos; break; }
            }
          }
          mergedSuccess.splice(insertIdx, 0, entry);
        }

        // Resolve not-found entries by comparing OCR names between the previous and new scan
        // for this specific image. data.success uses DB names while prev.notFound holds OCR
        // names — direct comparison would miss exception-matched entries (e.g. "Antolla" → "Dánnis").
        const prevNotFoundForImage = imageNotFoundNamesRef.current.get(img.fingerprint) ?? [];
        const newNotFoundForImage = new Set(data.notFound.map((nf: { name: string }) => nf.name));
        // OCR names that were notFound before but aren't anymore = resolved (via exception or direct match)
        const resolvedOcrNames = new Set(prevNotFoundForImage.filter((n) => !newNotFoundForImage.has(n)));
        // Also cover the rare case where OCR name === DB name (direct match without exception)
        const foundNames = new Set(data.success.map((e: ScanResultEntry) => e.name));
        const mergedNotFound = prev.notFound.filter((nf) => !resolvedOcrNames.has(nf.name) && !foundNames.has(nf.name));
        // Add new not-found entries only if they don't already exist
        for (const nf of data.notFound) {
          if (!mergedNotFound.some((existing) => existing.name === nf.name)) {
            mergedNotFound.push(nf);
          }
        }
        // Update per-image OCR name map for future rescans of this image
        imageNotFoundNamesRef.current = new Map(imageNotFoundNamesRef.current);
        if (newNotFoundForImage.size > 0) {
          imageNotFoundNamesRef.current.set(img.fingerprint, [...newNotFoundForImage]);
        } else {
          imageNotFoundNamesRef.current.delete(img.fingerprint);
        }

        // Dedup nanScores and zeroScores by name
        const mergedNan = [...prev.nanScores];
        for (const n of data.nanScores) {
          if (!mergedNan.some((x) => x.name === n.name)) mergedNan.push(n);
        }
        const mergedZero = [...prev.zeroScores];
        for (const z of data.zeroScores) {
          if (!mergedZero.some((x) => x.name === z.name)) mergedZero.push(z);
        }

        // Recompute totals from the merged arrays rather than accumulating,
        // so rescanning an image never inflates the displayed counts.
        return {
          ...prev,
          success: mergedSuccess,
          notFound: mergedNotFound,
          nanScores: mergedNan,
          zeroScores: mergedZero,
          totalSuccess: mergedSuccess.length,
          totalFailure: mergedNotFound.length,
          totalScanned: mergedSuccess.length + mergedNotFound.length,
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

      // Immediately remove the resolved name from the Not Found card
      const resolvedOcrName = exceptionModal.exception;
      setResults((prev) => {
        if (!prev) return prev;
        const updatedNotFound = prev.notFound.filter((nf) => nf.name !== resolvedOcrName);
        return {
          ...prev,
          notFound: updatedNotFound,
          totalFailure: updatedNotFound.length,
          totalScanned: prev.success.length + updatedNotFound.length,
        };
      });

      setExceptionModal(null);
      setExceptionCharInput("");

      // Give the backend cache and db a tiny moment to cleanly flip
      await new Promise(r => setTimeout(r, 600));

      // Auto-rescan all images that had not-found entries so the exception is applied immediately
      const imagesToRescan = images.filter((img) => imageHasNotFound.has(img.fingerprint));
      for (const img of imagesToRescan) {
        rescanSingle(img);
      }
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
        manuallyCorrectedRef.current.add(correctModal.name);
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
  // Finalize

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      const { data } = await axios.post<FinalizeResult>(
        `${BOT_API}/bot/api/admin/scanner/finalize`,
        { week, override: true },
        { withCredentials: true }
      );

      setFinalizeResult(data);

      if (data.success) {
        notify("success", `Finalized — ${data.submitted}/${data.total} scores submitted`);
        refreshActionLog();
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
    setFinalizeWarnModal(null);
    setLightboxIdx(null);
    setLightboxVisible(false);
    setProgress({ current: 0, total: 0, message: "", imageName: "" });
    imageNotFoundNamesRef.current = new Map();
    manuallyCorrectedRef.current = new Set();
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
      <div className="flex items-center px-6 py-5 gap-5">
        <h2 className="text-2xl font-medium">Culvert Scanner</h2>
        {phase === "done" && scanDuration !== null && (
          <span className="text-xs text-tertiary/50 flex items-center gap-1.5 mt-1.5">
            <FaClock size={10} className="-mt-px" />
            Done in {scanDuration.toFixed(2)}s
          </span>
        )}
      </div>

      <div className="flex-1 px-6 pb-6">
        {/* Upload area — hidden once scan is done */}
        {phase !== "done" && (
          <div className="bg-panel/70 border border-tertiary/[8%] rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium text-white">New Scan</h3>
              <div className="flex rounded-lg overflow-hidden border border-tertiary/20">
                <button
                  onClick={() => setWeek("last_week")}
                  className={cn(
                    "px-4 py-1.5 text-xs transition-colors",
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
                    "px-4 py-1.5 text-xs transition-colors",
                    week === "this_week"
                      ? "bg-accent/15 text-accent"
                      : "bg-background/60 text-tertiary hover:text-white"
                  )}
                >
                  This Week
                </button>
              </div>
            </div>

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
                className="group border-2 border-dashed border-tertiary/20 rounded-xl p-8 text-center cursor-pointer hover:border-accent/40 bg-background/30 transition-colors mb-4"
              >
                <FaCloudUploadAlt size={36} className="mx-auto text-tertiary/40 mb-3 group-hover:text-accent/70 transition-colors" />
                <p className="text-sm text-tertiary group-hover:text-accent transition-colors">
                  Drop culvert screenshots here or browse
                </p>
                <p className="text-xs text-tertiary/50 mt-1">PNG, JPG, WEBP — or paste with Ctrl+V</p>
              </div>
            ) : (
              /* Images added — grid + add-more square */
              <div
                ref={dropRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="mb-4"
              >
                <div className="flex flex-wrap gap-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative group">
                      <Tooltip text={img.file.name || `Screenshot ${i + 1}`}>
                        <img
                          src={img.preview}
                          alt={img.file.name || `Screenshot ${i + 1}`}
                          onClick={() => openLightbox(i)}
                          className="w-40 h-28 object-cover rounded-lg border border-tertiary/20 cursor-zoom-in hover:border-accent/40 transition-colors"
                        />
                      </Tooltip>
                      {/* X badge — top-right, inside image */}
                      {phase === "idle" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setRemoveConfirmIdx(i); }}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150"
                        >
                          <svg viewBox="0 0 16 16" className="w-5 h-5 text-[#C87070] hover:text-white transition-colors duration-150" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="3" y1="3" x2="13" y2="13" />
                            <line x1="13" y1="3" x2="3" y2="13" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {/* Add-more box — same size as thumbnails */}
                  {phase === "idle" && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-40 h-28 border-2 border-dashed border-tertiary/20 rounded-lg flex flex-col items-center justify-center gap-2 text-tertiary/40 hover:text-accent hover:border-accent/40 bg-background/30 transition-colors flex-shrink-0"
                    >
                      <FaCloudUploadAlt size={30} />
                      <span className="text-sm font-medium leading-none text-center">Add more</span>
                      <span className="text-xs leading-none text-tertiary/45">or Ctrl+V to paste</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Scan button + progress */}
            {images.length > 0 && phase === "idle" && (
              <div className="flex border-t border-tertiary/[8%] pt-4 mt-6">
                <button
                  onClick={startScan}
                  className="flex items-center gap-2 bg-accent/10 hover:bg-accent/15 border border-accent/40 text-accent text-sm rounded-lg px-5 py-2 transition-colors ml-auto"
                >
                  <FaCamera size={13} />
                  Scan {images.length} Image{images.length !== 1 ? "s" : ""}
                </button>
              </div>
            )}

            {phase === "scanning" && (
              <div className="mt-2 border-t border-tertiary/[8%] pt-4">
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
          </div>
        )}

        {/* Results */}
        {phase === "done" && results && (
          <div className="space-y-5">

            {/* Main result area: table (left half) + stats panel (right half) */}
            <div className="flex gap-5 items-stretch">

              {/* Left — Matched Scores unified panel */}
              {results.success.length > 0 && (
                <div className="flex-1 flex flex-col min-w-0 bg-panel rounded-xl border border-tertiary/[8%] overflow-hidden" style={{ height: "calc(525px + 3rem + 38px + 56px)" }}>

                  {/* Fixed top: header + column headers */}
                  <div className="flex flex-col px-4 pt-4 pb-0 flex-shrink-0">
                    <h3 className="text-xs font-medium text-tertiary/60 uppercase tracking-wider mb-3">
                      Matched Scores
                    </h3>
                    <div className="border-b border-tertiary/[6%] -mx-4">
                      <table className="w-full text-sm table-fixed px-4">
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
                  </div>

                  {/* Scrollable body */}
                  <div className="flex-1 overflow-y-auto bg-panel min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-panel [&::-webkit-scrollbar-thumb]:bg-tertiary/20 [&::-webkit-scrollbar-thumb]:rounded-full">
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

                  {/* Fixed bottom: scanned images section */}
                  {images.length > 0 && (
                    <div className="border-t border-tertiary/[8%] p-3 flex-shrink-0">
                      <p className="text-xs font-medium text-tertiary/60 uppercase tracking-wider mb-2">Scanned Images</p>
                      <div className="flex gap-2 overflow-x-auto">
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
                                onClick={() => !needsRetry && openLightbox(i)}
                                className={cn(
                                  "w-[55px] h-[55px] object-cover rounded-lg border-2 transition-colors",
                                  isFailed
                                    ? "border-[#C87070] ring-2 ring-[#C87070]/30 opacity-60 cursor-default"
                                    : hasNotFound
                                      ? "border-[#C87070] ring-2 ring-[#C87070]/20 opacity-70 cursor-default"
                                      : "border-tertiary/20 cursor-zoom-in hover:border-accent/40"
                                )}
                              />
                              {needsRetry && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); rescanSingle(img); }}
                                  disabled={isRetrying}
                                  className="absolute inset-0 rounded-lg flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                                >
                                  {isRetrying
                                    ? <div className="w-3.5 h-3.5 rounded-full border-2 border-[#C87070] border-t-transparent animate-spin" />
                                    : <FaRedo size={11} className="text-[#C87070]" />}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Right — Stats + anomalies + not found in a formatted panel */}
              <div className="flex-1 flex flex-col min-w-0 bg-panel rounded-xl border border-tertiary/[8%] overflow-hidden" style={{ height: "calc(525px + 3rem + 38px + 56px)" }}>

                {/* Fixed top: Scan Overview summary cards */}
                <div className="flex flex-col gap-3 p-4 pb-3 flex-shrink-0">
                  <h3 className="text-xs font-medium text-tertiary/60 uppercase tracking-wider">
                    Scan Overview
                  </h3>
                  <div className="flex gap-2.5">
                    <SummaryCard label="Total Scanned" value={results.totalScanned} color="text-white" className="flex-1" />
                    <SummaryCard label="Matched" value={results.totalSuccess} color="text-[#669A68]" className="flex-1" />
                    <SummaryCard label="Not Found" value={results.totalFailure} color="text-[#C87070]" className="flex-1" />
                    <SummaryCard label="Zero Scores" value={results.zeroScores.length} color="text-[#C8A855]" className="flex-1" />
                  </div>
                </div>

                {/* Scrollable middle: anomaly / sandbag / not found cards */}
                <div className="flex-1 overflow-y-auto px-4 space-y-3 min-h-0 py-2">

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
                            onClick={() => { setCorrectModal({ name: a.name, week: results.week, currentScore: a.score }); setCorrectInput(""); }}
                            className="flex-shrink-0 text-[10px] text-[#D4915E] hover:text-white border border-[#D4915E]/30 hover:border-white/20 rounded px-1.5 py-0.5 transition-colors"
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

                {/* No-alerts empty state */}
                {results.anomalies.length === 0 && results.success.filter(e => e.sandbag).length === 0 && results.notFound.length === 0 && (
                  <div className="flex flex-col items-center justify-center flex-1 h-full gap-3 text-tertiary/40 py-8">
                    <p className="text-sm mb-4">No issues — scanned successfully!</p>
                  </div>
                )}

                </div>{/* end scrollable middle */}

                {/* Fixed bottom: actions bar */}
                {(() => {
                  const scoredThisWeek = new Set(liveScores.filter(s => s.date === results.week).map(s => s.character));
                  const submittedCount = scoredThisWeek.size;
                  return (
                <div className="border-t border-tertiary/[8%] px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0">
                  <span className={cn(
                    "text-xs",
                    submittedCount >= liveCharacters.length ? "text-[#669A68]" : "text-[#C87070]"
                  )}>
                    {submittedCount}
                    <span className="opacity-50"> / </span>
                    {liveCharacters.length} scores submitted
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={resetAll}
                      className="flex items-center gap-1.5 text-sm text-tertiary hover:text-white border border-tertiary/[10%] hover:border-tertiary/30 rounded-lg px-4 py-2 transition-colors"
                    >
                      <FaRedo size={10} />
                      New Scan
                    </button>
                    <button
                      onClick={() => {
                        const unresolvedNotFound = results.notFound.map(nf => nf.name);
                        const unresolvedAnomalies = results.anomalies.map(a => a.name);
                        const missing = liveCharacters.filter(c => !scoredThisWeek.has(c.name)).map(c => c.name);
                        if (unresolvedNotFound.length > 0 || unresolvedAnomalies.length > 0 || missing.length > 0) {
                          setFinalizeWarnModal({ notFound: unresolvedNotFound, anomalies: unresolvedAnomalies, missing });
                        } else {
                          handleFinalize();
                        }
                      }}
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
                  );
                })()}

              </div>
            </div>

          </div>
        )}
      </div>

      {/* Add Exception modal */}
      {exceptionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) backdropDownRef.current = true; }}
          onClick={(e) => { if (e.target !== e.currentTarget || !backdropDownRef.current) return; backdropDownRef.current = false; setExceptionModal(null); setExceptionCharInput(""); }}
        >
          <div
            className="bg-panel border border-tertiary/[10%] rounded-xl p-6 w-[340px] space-y-4 shadow-2xl"
            onMouseDown={(e) => { backdropDownRef.current = false; e.stopPropagation(); }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-medium text-white">Add Exception</h3>
              <p className="text-xs text-tertiary/60 mt-0.5">Create an exception for the misread character name</p>
            </div>
            <div>
              <label className="text-xs text-tertiary/60 mb-1.5 block uppercase tracking-wide">Exception (misread name)</label>
              <input
                type="text"
                value={exceptionModal.exception}
                readOnly
                className="w-full bg-background border border-tertiary/20 rounded-lg px-3 py-2 text-sm text-white/60 focus:outline-none cursor-default"
              />
            </div>
            <div>
              <label className="text-xs text-tertiary/60 mb-1.5 block uppercase tracking-wide">Character (correct name)</label>
              <AutocompleteInput
                value={exceptionCharInput}
                onChange={(v) => setExceptionCharInput(v)}
                suggestions={liveCharacters.map((c) => c.name)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateException()}
                autoFocus
                placeholder="e.g. Dánnis"
                inputClassName="w-full bg-background border border-tertiary/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateException}
                disabled={exceptionSaving || !exceptionCharInput.trim()}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 text-sm rounded-lg py-2 transition-colors",
                  exceptionSaving || !exceptionCharInput.trim()
                    ? "bg-tertiary/10 text-tertiary/40 cursor-not-allowed"
                    : "bg-accent/10 hover:bg-accent/15 border border-accent/40 text-accent"
                )}
              >
                {exceptionSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => { setExceptionModal(null); setExceptionCharInput(""); }}
                className="flex-1 text-sm text-tertiary hover:text-white border border-tertiary/20 hover:border-tertiary/40 rounded-lg py-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Correct score modal */}
      {correctModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) backdropDownRef.current = true; }}
          onClick={(e) => { if (e.target !== e.currentTarget || !backdropDownRef.current) return; backdropDownRef.current = false; setCorrectModal(null); setCorrectInput(""); }}
        >
          <div
            className="bg-panel border border-tertiary/[10%] rounded-xl p-6 w-[340px] space-y-4 shadow-2xl"
            onMouseDown={(e) => { backdropDownRef.current = false; e.stopPropagation(); }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-medium text-white">Correct Score</h3>
              <p className="text-xs text-tertiary/60 mt-0.5">Correct misread score for the character</p>
            </div>
            <div>
              <label className="text-xs text-tertiary/60 mb-1.5 block uppercase tracking-wide">Character</label>
              <input
                type="text"
                value={correctModal.name}
                readOnly
                className="w-full bg-background border border-tertiary/20 rounded-lg px-3 py-2 text-sm text-white/60 focus:outline-none cursor-default"
              />
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
                className="w-full bg-background border border-tertiary/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCorrect}
                disabled={correcting || correctInput === ""}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 text-sm rounded-lg py-2 transition-colors",
                  correcting || correctInput === ""
                    ? "bg-tertiary/10 text-tertiary/40 cursor-not-allowed"
                    : "bg-accent/10 hover:bg-accent/15 border border-accent/40 text-accent"
                )}
              >
                {correcting ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => { setCorrectModal(null); setCorrectInput(""); }}
                className="flex-1 text-sm text-tertiary hover:text-white border border-tertiary/20 hover:border-tertiary/40 rounded-lg py-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Warning Modal */}
      {finalizeWarnModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) backdropDownRef.current = true; }}
          onClick={(e) => { if (e.target !== e.currentTarget || !backdropDownRef.current) return; backdropDownRef.current = false; setFinalizeWarnModal(null); }}
        >
          <div
            className="bg-panel border border-tertiary/[10%] rounded-xl w-[380px] shadow-2xl flex flex-col max-h-[70vh]"
            onMouseDown={(e) => { backdropDownRef.current = false; e.stopPropagation(); }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 pb-3 border-b border-tertiary/[8%]">
              <h3 className="text-base font-medium text-white">Unresolved Issues</h3>
              <p className="text-xs text-tertiary/60 mt-0.5">Some issues need attention. Finalize anyway?</p>
            </div>
            {/* Scrollable sections */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {finalizeWarnModal.notFound.length > 0 && (
                <div className="py-1">
                  <p className="text-[10px] text-[#C87070] uppercase tracking-wider font-medium mb-1.5">Not Found ({finalizeWarnModal.notFound.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {finalizeWarnModal.notFound.map((name, i) => (
                      <span key={i} className="bg-red-900/20 text-[#C87070] border border-red-800/20 rounded-md px-2 py-0.5 text-xs">{name}</span>
                    ))}
                  </div>
                </div>
              )}
              {finalizeWarnModal.notFound.length > 0 && finalizeWarnModal.anomalies.length > 0 && <Divider className="my-4" />}
              {finalizeWarnModal.anomalies.length > 0 && (
                <div className="py-1">
                  <p className="text-[10px] text-[#D4915E] uppercase tracking-wider font-medium mb-1.5">Score Anomalies ({finalizeWarnModal.anomalies.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {finalizeWarnModal.anomalies.map((name, i) => (
                      <span key={i} className="bg-orange-900/20 text-[#D4915E] border border-orange-800/20 rounded-md px-2 py-0.5 text-xs">{name}</span>
                    ))}
                  </div>
                </div>
              )}
              {(finalizeWarnModal.notFound.length > 0 || finalizeWarnModal.anomalies.length > 0) && finalizeWarnModal.missing.length > 0 && <Divider className="my-4" />}
              {finalizeWarnModal.missing.length > 0 && (
                <div className="py-1">
                  <p className="text-[10px] text-[#C8A855] uppercase tracking-wider font-medium mb-1.5">Missing Scores ({finalizeWarnModal.missing.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {finalizeWarnModal.missing.map((name, i) => (
                      <span key={i} className="bg-yellow-900/20 text-[#C8A855] border border-yellow-800/20 rounded-md px-2 py-0.5 text-xs">{name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Buttons */}
            <div className="flex gap-2 p-5 pt-3 border-t border-tertiary/[8%]">
              <button
                onClick={() => { setFinalizeWarnModal(null); handleFinalize(); }}
                disabled={finalizing}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 text-sm rounded-lg py-2 transition-colors",
                  finalizing
                    ? "bg-tertiary/10 text-tertiary/40 cursor-not-allowed"
                    : "bg-[#669A68]/10 hover:bg-[#669A68]/15 border border-[#669A68]/40 text-[#669A68]"
                )}
              >
                <FaDownload size={10} />
                {finalizing ? "Finalizing..." : "Finalize Anyway"}
              </button>
              <button
                onClick={() => setFinalizeWarnModal(null)}
                className="flex-1 text-sm text-tertiary hover:text-white border border-tertiary/20 hover:border-tertiary/40 rounded-lg py-2 transition-colors"
              >
                Cancel
              </button>
            </div>
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
      {lightboxIdx !== null && images[lightboxIdx] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop — fades independently */}
          <div
            className={cn(
              "absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-200",
              lightboxVisible ? "opacity-100" : "opacity-0"
            )}
            onClick={closeLightbox}
          />
          {/* Content, counter, and arrows — all scale + fade together */}
          <div
            className={cn(
              "flex items-center gap-8 transition-all duration-200 ease-out",
              lightboxVisible
                ? "opacity-100 scale-100"
                : "opacity-0 scale-95"
            )}
          >
            {/* Prev arrow */}
            {images.length > 1 ? (
              <button
                onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-panel/80 border border-accent/30 hover:border-accent/70 hover:bg-panel text-accent hover:text-white transition-all shadow-lg"
              >
                <FaChevronLeft size={16} className="mr-0.5"/>
              </button>
            ) : <div className="w-10 flex-shrink-0" />}

            {/* Image + counter */}
            <div className="flex flex-col items-center gap-3">
              <img
                src={images[lightboxIdx].preview}
                alt="Screenshot preview"
                className="max-w-[80vw] max-h-[85vh] rounded-lg shadow-2xl block"
                onClick={(e) => e.stopPropagation()}
              />
              {images.length > 1 && (
                <span className="text-xs text-white/70 bg-black/60 rounded-full px-3 py-1 tabular-nums select-none">
                  {lightboxIdx + 1} / {images.length}
                </span>
              )}
            </div>

            {/* Next arrow */}
            {images.length > 1 ? (
              <button
                onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-panel/80 border border-accent/30 hover:border-accent/70 hover:bg-panel text-accent hover:text-white transition-all shadow-lg"
              >
                <FaChevronRight size={16} className="ml-0.5"/>
              </button>
            ) : <div className="w-10 flex-shrink-0" />}
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
