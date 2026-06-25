import { FaTrash } from "react-icons/fa";
import { Button } from "../../../components/Button";

interface BatchBarProps {
  count: number;
  onDelete: () => void;
  onClear: () => void;
}

export const BatchBar = ({ count, onDelete, onClear }: BatchBarProps) =>
  count > 0 ? (
    <div className="flex items-center gap-6 px-6 py-3 bg-accent/[3%] border-b border-accent/10">
      <span className="text-sm text-accent">{count} selected</span>
      <Button
        variant="danger"
        onClick={onDelete}
        icon={<FaTrash size={11} />}
        className="ml-auto h-auto py-0 border-0 bg-transparent text-sm hover:bg-transparent active:bg-transparent"
      >
        Delete Selected
      </Button>
      <Button
        variant="tertiary"
        onClick={onClear}
        className="h-auto py-0 border-0 text-sm"
      >
        Clear
      </Button>
    </div>
  ) : null;
