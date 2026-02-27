import { FaTrash } from "react-icons/fa";

interface BatchBarProps {
  count: number;
  onDelete: () => void;
  onClear: () => void;
}

export const BatchBar = ({ count, onDelete, onClear }: BatchBarProps) =>
  count > 0 ? (
    <div className="flex items-center gap-6 px-6 py-3 bg-accent/[3%] border-b border-accent/10">
      <span className="text-sm text-accent">{count} selected</span>
      <button
        onClick={onDelete}
        className="ml-auto text-sm text-[#A46666] hover:text-red-400 transition-colors flex items-center gap-1.5"
      >
        <FaTrash size={11} style={{ marginBottom: "1px" }} /> Delete Selected
      </button>
      <button onClick={onClear} className="text-sm text-tertiary hover:text-white transition-colors">
        Clear
      </button>
    </div>
  ) : null;
