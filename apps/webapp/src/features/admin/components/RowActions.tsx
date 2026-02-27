import { FaEdit, FaTrash } from "react-icons/fa";

interface RowActionsProps {
  onEdit?: () => void;
  onDelete: () => void;
}

/** Renders as a <td> — must be placed inside a <tr> */
export const RowActions = ({ onEdit, onDelete }: RowActionsProps) => (
  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
    <div className="flex items-center justify-end gap-4">
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Edit"
          className="text-tertiary hover:text-accent transition-colors"
        >
          <FaEdit size={14} />
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete"
        className="text-tertiary hover:text-[#A46666] transition-colors"
      >
        <FaTrash size={14} />
      </button>
    </div>
  </td>
);
