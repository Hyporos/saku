import { cva, VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { FaChevronUp, FaChevronDown, FaEquals } from "react-icons/fa";

const previousScoreVariants = cva(
  "flex justify-between items-center bg-background text-sm font-light drop-shadow-[0_0_4px_rgba(0,0,0,0.25)] rounded px-4 py-2 mr-3",
  {
    variants: {
      state: {
        uptrend: "bg-gradient-to-r from-background to-[#00FF0A]/[2.5%]",
        downtrend: "bg-gradient-to-r from-background to-[#FF0000]/[2.5%]",
        invalid: "bg-gradient-to-r from-background to-[#FFFFFF]/[2.5%]",
      },
    },
  }
);

interface PreviousScoreProps
  extends VariantProps<typeof previousScoreVariants> {
    date: string;
    score: number;
  }

const PreviousScore = ({ state, date, score }: PreviousScoreProps) => {
  const getTrendIcon = () => {
    if (state === "uptrend") return <FaChevronUp size={16} className="fill-[#669A68]" />;
    if (state === "downtrend") return <FaChevronDown size={16} className="fill-[#A46666]" />;
    if (state === "invalid") return <FaEquals size={16} className="fill-tertiary/50" />;
  };

  return (
    <div className={cn(previousScoreVariants({ state }))}>
      <p className="text-tertiary">{date}</p>
      <div className="flex items-center gap-3">
        <p>{score.toLocaleString()}</p>
        <div className="bg-tertiary/15 rounded-full w-px h-[16px]" />
        {getTrendIcon()}
      </div>
    </div>
  );
};

export { PreviousScore, previousScoreVariants };
