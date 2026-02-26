import { useState } from "react";
import { FaCheck, FaCopy } from "react-icons/fa";
import { cn } from "../lib/utils";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Inline copyable Discord ID — clicking copies the id to clipboard.
// Shows ✓ checkmark with a fade-out on copy, then the copy icon fades back in.
const CopyId = ({ id }: { id: string }) => {
  const [copied, setCopied] = useState(false);
  const [fading, setFading] = useState(false);
  const [copyFadingIn, setCopyFadingIn] = useState(false);

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setFading(false);
      setTimeout(() => setFading(true), 900);
      setTimeout(() => {
        setCopied(false);
        setFading(false);
        setCopyFadingIn(true);
        setTimeout(() => setCopyFadingIn(false), 16);
      }, 1150);
    });
  };

  return (
    <span
      onClick={copy}
      title="Copy ID"
      className={cn(
        "group/copy inline-flex items-center gap-1.5 font-mono cursor-pointer transition-colors duration-200",
        copied && !fading ? "text-white" : "hover:text-white"
      )}
    >
      {id}
      {copied ? (
        <span className={cn(
          "inline-flex items-center transition-opacity duration-200",
          fading ? "opacity-0" : "opacity-100"
        )}>
          <FaCheck size={10} className="text-accent" />
        </span>
      ) : (
        <FaCopy
          size={10}
          className={cn(
            "transition-all duration-200",
            copyFadingIn ? "opacity-0" : "opacity-100",
            "text-tertiary/30 group-hover/copy:text-white"
          )}
        />
      )}
    </span>
  );
};

export default CopyId;
