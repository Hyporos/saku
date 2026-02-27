import { useState, useRef, useEffect } from "react";
import dayjs from "dayjs";
import { cn } from "../lib/utils";
import { FaChevronLeft, FaChevronRight, FaRegCalendarAlt, FaArrowRight, FaTimes } from "react-icons/fa";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Single-date mode — the default
interface DatePickerSingleProps {
  mode?: "single";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  // "right" flips the dropdown so it opens leftward — use when the picker is near the right edge
  align?: "left" | "right";
  // "subtle" renders the trigger in muted gray instead of accent-pink — use for low-emphasis fields
  subtle?: boolean;
  // "compact" reduces vertical padding (py-1 instead of py-2) for tight layouts
  compact?: boolean;
  // "wednesdayOnly" disables all non-Wednesday days — for culvert score dates
  wednesdayOnly?: boolean;
  // "disabledDates" grays out specific ISO dates (e.g. dates that already have a score)
  disabledDates?: string[];
  // "dropUp" opens the calendar above the trigger instead of below — use when near bottom of viewport
  dropUp?: boolean;
  // show clear X inside trigger (intended for filter usage)
  clearable?: boolean;
}

// Range mode — supply from/to and an onRangeChange handler
interface DatePickerRangeProps {
  mode: "range";
  from: string;
  to: string;
  onRangeChange: (from: string, to: string) => void;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
  subtle?: boolean;
  compact?: boolean;
  wednesdayOnly?: boolean;
  disabledDates?: string[];
  dropUp?: boolean;
  clearable?: boolean;
}

type DatePickerProps = DatePickerSingleProps | DatePickerRangeProps;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DatePicker = (props: DatePickerProps) => {
  const isRange = props.mode === "range";

  // Derive active value for viewing month initialisation
  const activeValue = isRange
    ? (props as DatePickerRangeProps).from
    : (props as DatePickerSingleProps).value;

  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [viewing, setViewing] = useState(activeValue ? dayjs(activeValue) : dayjs());
  // In range mode, track which end is being picked next
  const [picking, setPicking] = useState<"from" | "to">("from");
  const [hoverDate, setHoverDate] = useState("");
  const [popupSideX, setPopupSideX] = useState<"left" | "right">(props.align ?? "left");
  const [popupSideY, setPopupSideY] = useState<"down" | "up">(props.dropUp ? "up" : "down");
  const ref = useRef<HTMLDivElement>(null);

  const adjustPopupPlacement = () => {
    if (!ref.current) return;
    const trigger = ref.current.querySelector("button");
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const popupW = Math.min(264, viewportW - 16);
    const popupH = 330;

    const rightOverflow = rect.left + popupW > viewportW - 8;
    const leftFits = rect.right - popupW >= 8;
    const leftOverflow = rect.right - popupW < 8;
    const rightFits = rect.left + popupW <= viewportW - 8;

    let nextX: "left" | "right" = props.align ?? "left";
    if (nextX === "left" && rightOverflow && leftFits) nextX = "right";
    if (nextX === "right" && leftOverflow && rightFits) nextX = "left";

    const below = viewportH - rect.bottom;
    const above = rect.top;
    let nextY: "down" | "up" = props.dropUp ? "up" : "down";
    if (nextY === "down" && below < popupH && above > below) nextY = "up";
    if (nextY === "up" && above < popupH && below > above) nextY = "down";

    setPopupSideX(nextX);
    setPopupSideY(nextY);
  };

  // Sync viewing month when the controlled value changes externally
  useEffect(() => {
    const anchor = isRange
      ? (props as DatePickerRangeProps).from
      : (props as DatePickerSingleProps).value;
    if (anchor) setViewing(dayjs(anchor));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRange ? (props as DatePickerRangeProps).from : (props as DatePickerSingleProps).value]);

  // Open/close animation lifecycle — same pattern as WarningModal
  useEffect(() => {
    if (open) {
      setVisible(true);
      adjustPopupPlacement();
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 180);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = () => adjustPopupPlacement();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, props.align, props.dropUp]);

  // Reset picking side when calendar opens
  useEffect(() => {
    if (open && isRange) setPicking("from");
  }, [open, isRange]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Build cell array: nulls for leading empty days, then 1..daysInMonth
  const startDow = viewing.startOf("month").day();
  const daysInMonth = viewing.daysInMonth();
  const cells: (number | null)[] = [
    ...Array<null>(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Compute trigger label
  const displayValue = (() => {
    if (isRange) {
      const { from, to } = props as DatePickerRangeProps;
      if (!from && !to) return props.placeholder ?? "Select range";
      const fromFmt = from ? dayjs(from).format("MMM DD, YYYY") : "—";
      const toFmt   = to   ? dayjs(to).format("MMM DD, YYYY") : "—";
      return `${fromFmt} → ${toFmt}`;
    } else {
      const { value, placeholder } = props as DatePickerSingleProps;
      return value ? dayjs(value).format("MMM DD, YYYY") : (placeholder ?? "—");
    }
  })();

  const hasValue = isRange
    ? !!((props as DatePickerRangeProps).from || (props as DatePickerRangeProps).to)
    : !!(props as DatePickerSingleProps).value;

  const handleDayClick = (iso: string) => {
    // Wednesday-only mode — silently ignore non-Wednesday picks
    if (props.wednesdayOnly && dayjs(iso).day() !== 3) return;
    if (!isRange) {
      (props as DatePickerSingleProps).onChange(iso);
      setOpen(false);
      return;
    }
    const rangeProps = props as DatePickerRangeProps;
    if (picking === "from") {
      rangeProps.onRangeChange(iso, "");
      setPicking("to");
    } else {
      // If picked end is before start, swap to a new "from" instead
      if (iso < rangeProps.from) {
        rangeProps.onRangeChange(iso, "");
        setPicking("to");
      } else {
        rangeProps.onRangeChange(rangeProps.from, iso);
        setOpen(false);
        setPicking("from");
      }
    }
  };

  const getDayState = (iso: string) => {
    if (!isRange) {
      const { value } = props as DatePickerSingleProps;
      return {
        isSelected: iso === value,
        isInRange: false,
        isRangeStart: false,
        isRangeEnd: false,
        isToday: iso === dayjs().format("YYYY-MM-DD"),
      };
    }
    const { from, to } = props as DatePickerRangeProps;
    // Show hover preview when picking the end date
    const effectiveTo = to || (picking === "to" && hoverDate && hoverDate >= from ? hoverDate : "");
    return {
      isSelected: iso === from || (!!to && iso === to),
      isInRange: !!(from && effectiveTo && iso > from && iso < effectiveTo),
      isRangeStart: iso === from,
      isRangeEnd: !!to && iso === to,
      isToday: iso === dayjs().format("YYYY-MM-DD"),
    };
  };

  return (
    <div ref={ref} className={cn("relative inline-block", props.className)}>
      {/* Trigger — accent-pink by default; "subtle" = gray, "compact" = less vertical padding */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group inline-flex items-center gap-2 bg-background border rounded-lg px-3 text-sm focus:outline-none transition-colors cursor-pointer",
          props.compact ? "py-1" : "py-2",
          // Active (open) always gets accent border; otherwise mode-specific hover border
          open
            ? "border-accent/40"
            : props.subtle
              ? "border-tertiary/20 hover:border-tertiary/40"
              : "border-accent/30 hover:border-accent/60",
          // Text color: subtle mode — white when a date is already selected, tertiary otherwise (matches open state)
          props.subtle
            ? open
              ? "text-tertiary"
              : activeValue
                ? "text-white"
                : "text-tertiary"
            : "text-accent"
        )}
      >
        <FaRegCalendarAlt
          size={12}
          className={cn(
            "flex-shrink-0 leading-none transition-colors mb-[2px]",
            props.subtle
              ? "text-tertiary"
              : (open ? "text-accent" : "text-tertiary/50 group-hover:text-accent")
          )}
        />
        <span className={cn(!props.subtle && !activeValue && !open && "opacity-50")}>{displayValue}</span>
        {props.clearable && hasValue && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              if (isRange) {
                (props as DatePickerRangeProps).onRangeChange("", "");
                setPicking("from");
              } else {
                (props as DatePickerSingleProps).onChange("");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                if (isRange) {
                  (props as DatePickerRangeProps).onRangeChange("", "");
                  setPicking("from");
                } else {
                  (props as DatePickerSingleProps).onChange("");
                }
              }
            }}
            className="ml-0.5 inline-flex items-center justify-center text-[#A46666] hover:text-white transition-colors"
            aria-label="Clear date"
          >
            <FaTimes size={12} className="text-current transition-colors" />
          </span>
        )}
      </button>

      {/* Calendar dropdown */}
      {visible && (
        <div
          className={cn(
            "absolute z-50 bg-panel border border-tertiary/[8%] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 w-[264px] transition-all duration-[180ms]",
            popupSideY === "up"
              ? popupSideX === "right" ? "bottom-full mb-1.5 right-0 origin-bottom-right" : "bottom-full mb-1.5 left-0 origin-bottom-left"
              : popupSideX === "right" ? "top-full mt-1.5 right-0 origin-top-right" : "top-full mt-1.5 left-0 origin-top-left",
            animating ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1"
          )}
          style={{ width: Math.min(264, window.innerWidth - 16) }}
        >
          {/* Range mode — picking indicator */}
          {isRange && (
            <div className="flex items-center gap-2 mb-3">
              <span className={cn(
                "flex-1 text-center text-xs rounded-md py-1 border transition-colors",
                picking === "from"
                  ? "bg-accent/15 text-accent border-accent/30"
                  : "bg-transparent border-tertiary/20 text-tertiary"
              )}>
                {(props as DatePickerRangeProps).from
                  ? dayjs((props as DatePickerRangeProps).from).format("MMM DD")
                  : "Start"}
              </span>
              <FaArrowRight size={11} className="text-tertiary/40 flex-shrink-0 self-center" />
              <span className={cn(
                "flex-1 text-center text-xs rounded-md py-1 border transition-colors",
                picking === "to"
                  ? "bg-accent/15 text-accent border-accent/30"
                  : "bg-transparent border-tertiary/20 text-tertiary"
              )}>
                {(props as DatePickerRangeProps).to
                  ? dayjs((props as DatePickerRangeProps).to).format("MMM DD")
                  : "End"}
              </span>
            </div>
          )}

          {/* Month / year navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewing((v) => v.subtract(1, "month"))}
              className="p-1.5 rounded-lg text-tertiary hover:text-white hover:bg-background/60 transition-colors"
            >
              <FaChevronLeft size={9} />
            </button>
            <span className="text-sm font-medium select-none">
              {MONTHS[viewing.month()]} {viewing.year()}
            </span>
            <button
              type="button"
              onClick={() => setViewing((v) => v.add(1, "month"))}
              className="p-1.5 rounded-lg text-tertiary hover:text-white hover:bg-background/60 transition-colors"
            >
              <FaChevronRight size={9} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {DOW.map((d) => (
              <span key={d} className="text-center text-[10px] text-tertiary/40 py-0.5 select-none">
                {d}
              </span>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <span key={`e-${i}`} />;
              const iso = viewing.date(day).format("YYYY-MM-DD");
              const { isSelected, isInRange, isRangeStart, isRangeEnd, isToday } = getDayState(iso);
              // Wednesday-only mode — disable all non-Wednesday days
              const isWednesday = dayjs(iso).day() === 3;
              const disabled = (!!props.wednesdayOnly && !isWednesday) || (props.disabledDates?.includes(iso) ?? false);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDayClick(iso)}
                  onMouseEnter={() => !disabled && isRange && setHoverDate(iso)}
                  onMouseLeave={() => isRange && setHoverDate("")}
                  className={cn(
                    "aspect-square text-xs flex items-center justify-center border border-transparent transition-colors",
                    disabled && "opacity-20 cursor-default",
                    isRangeStart || isRangeEnd ? "rounded-lg" : isInRange ? "rounded-none" : "rounded-lg",
                    !disabled && (
                      isSelected
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : isInRange
                          ? "bg-accent/10 text-accent/80 hover:bg-accent/15"
                          : isToday
                            ? "text-accent hover:bg-accent/10"
                            : "text-tertiary hover:bg-background/60 hover:text-white"
                    )
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
