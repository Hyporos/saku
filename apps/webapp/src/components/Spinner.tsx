import { FaSpinner } from "react-icons/fa";
import { cn } from "../lib/utils";

interface SpinnerProps {
  size?: number;
  className?: string;
  /** Wrap in a flex-1 box that centers the spinner — for full-panel loading states. */
  center?: boolean;
}

export const Spinner = ({ size = 20, className, center }: SpinnerProps) => {
  const spinner = <FaSpinner size={size} className={cn("animate-spin text-tertiary/30", className)} />;
  if (!center) return spinner;
  return <div className="flex-1 flex items-center justify-center">{spinner}</div>;
};

export default Spinner;
