import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FaCheck, FaTimes, FaInfoCircle } from "react-icons/fa";
import { cn } from "../lib/utils";
import { useNotifications, type NotificationItem, type NotificationType } from "../context/NotificationContext";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const ICON: Record<NotificationType, React.ElementType> = {
  success: FaCheck,
  error:   FaTimes,
  info:    FaInfoCircle,
};

const STYLES: Record<NotificationType, { icon: string; bar: string; ring: string }> = {
  success: {
    icon: "text-accent",
    bar:  "bg-accent",
    ring: "bg-accent/10",
  },
  error: {
    icon: "text-[#C87070]",
    bar:  "bg-[#A46666]",
    ring: "bg-[#A46666]/10",
  },
  info: {
    icon: "text-tertiary/70",
    bar:  "bg-tertiary/40",
    ring: "bg-tertiary/10",
  },
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const Toast = ({ item, onDismiss }: { item: NotificationItem; onDismiss: () => void }) => {
  const [visible, setVisible] = useState(false);
  const Icon = ICON[item.type];
  const style = STYLES[item.type];

  // Trigger enter animation on mount
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  const isOut = item.exiting || !visible;

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 w-[320px] bg-panel border border-tertiary/[8%] rounded-xl px-4 py-3.5 drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)] overflow-hidden",
        "transition-all duration-300 ease-out",
        isOut
          ? "opacity-0 translate-x-4 pointer-events-none"
          : "opacity-100 translate-x-0"
      )}
    >
      {/* Progress bar */}
      {(item.duration ?? 4000) > 0 && (
        <ProgressBar
          duration={item.duration ?? 4000}
          color={style.bar}
          paused={!!item.exiting}
        />
      )}

      {/* Icon */}
      <div className={cn("flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5", style.ring)}>
        <Icon size={12} className={style.icon} />
      </div>

      {/* Message */}
      <p className="text-sm text-white/90 leading-relaxed flex-1 pt-0.5 pr-4">{item.message}</p>

      {/* Close button */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-tertiary/40 hover:text-tertiary/80 transition-colors"
        aria-label="Dismiss"
      >
        <FaTimes size={10} />
      </button>
    </div>
  );
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const ProgressBar = ({
  duration,
  color,
  paused,
}: {
  duration: number;
  color: string;
  paused: boolean;
}) => {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.transition = `width ${duration}ms linear`;
      el.style.width = "0%";
    });
  }, [duration]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-tertiary/10">
      <div
        ref={barRef}
        className={cn("h-full rounded-full", color)}
        style={{
          width: "100%",
          animationPlayState: paused ? "paused" : "running",
        }}
      />
    </div>
  );
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

/** Renders all active notifications stacked in the bottom-right corner. */
const Notifications = () => {
  const { notifications, dismiss } = useNotifications();
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const previousTops = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const nextTops = new Map<string, number>();

    notifications.forEach((item) => {
      const el = itemRefs.current.get(item.id);
      if (!el) return;

      const currentTop = el.getBoundingClientRect().top;
      nextTops.set(item.id, currentTop);

      const prevTop = previousTops.current.get(item.id);
      if (prevTop === undefined) return;

      const deltaY = prevTop - currentTop;
      if (deltaY === 0) return;

      el.style.transition = "none";
      el.style.transform = `translateY(${deltaY}px)`;

      requestAnimationFrame(() => {
        el.style.transition = "transform 240ms ease";
        el.style.transform = "translateY(0)";
      });
    });

    previousTops.current = nextTops;
  }, [notifications]);

  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-3 pointer-events-none">
      {notifications.map((item) => (
        <div
          key={item.id}
          ref={(el) => {
            if (el) itemRefs.current.set(item.id, el);
            else itemRefs.current.delete(item.id);
          }}
          className="pointer-events-auto"
        >
          <Toast item={item} onDismiss={() => dismiss(item.id)} />
        </div>
      ))}
    </div>
  );
};

export default Notifications;
