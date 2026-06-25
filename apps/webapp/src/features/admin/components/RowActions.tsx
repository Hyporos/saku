import { FaEdit, FaTrash } from "react-icons/fa";
import { Button } from "../../../components/Button";

interface RowActionsProps {
  onEdit?: () => void;
  onDelete: () => void;
}

/** Renders as a <td> — must be placed inside a <tr> */
export const RowActions = ({ onEdit, onDelete }: RowActionsProps) => (
  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
    <div className="flex items-center justify-end gap-4">
      {onEdit && (
        <Button
          variant="inline"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Edit"
          className="text-tertiary/40 hover:text-accent"
        >
          <FaEdit size={14} style={{ marginBottom: "2px" }} />
        </Button>
      )}
      <Button
        variant="inline"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete"
        className="text-[#A46666]/40 hover:text-[#A46666]"
      >
        <FaTrash size={14} style={{ marginBottom: "2px" }} />
      </Button>
    </div>
  </td>
);
