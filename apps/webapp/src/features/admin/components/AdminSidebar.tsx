import { cn } from "../../../lib/utils";
import { FaSyncAlt } from "react-icons/fa";
import { useAdminContext } from "../context";
import { Button } from "../../../components/Button";

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminSidebar = ({ isOpen, onClose }: AdminSidebarProps) => {
  const {
    activeSection, navigateToSection, navItems,
    activeToolSection, navigateToToolSection, monitoringItems, toolItems,
    refreshAllData,
  } = useAdminContext();

  return (
    <aside className={cn(
      "bg-panel flex flex-col gap-1 p-4 w-[220px] flex-shrink-0 border-r border-tertiary/[6%]",
      "fixed top-0 left-0 h-full z-[100] transition-transform duration-300",
      "md:static md:z-auto md:h-auto md:translate-x-0 md:transition-none",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>

      <p className="text-xs text-tertiary/50 uppercase tracking-widest px-4 pt-3 pb-2 font-medium">
        Database
      </p>
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => { navigateToSection(id); onClose(); }}
          className={cn(
            "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-left transition-colors",
            activeSection === id && activeToolSection === null
              ? "bg-background/80 text-accent"
              : "text-tertiary hover:text-white hover:bg-background/40"
          )}
        >
          <Icon size={16} className="flex-shrink-0" style={{ marginBottom: "2px" }} />
          {label}
        </button>
      ))}

      <div className="bg-tertiary/20 rounded-full h-px mx-2 my-2" />

      <p className="text-xs text-tertiary/50 uppercase tracking-widest px-4 pt-1 pb-2 font-medium">
        Tools
      </p>
      {toolItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => { navigateToToolSection(id); onClose(); }}
          className={cn(
            "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-left transition-colors",
            activeToolSection === id
              ? "bg-background/80 text-accent"
              : "text-tertiary hover:text-white hover:bg-background/40"
          )}
        >
          <Icon size={16} className="flex-shrink-0" style={{ marginBottom: "2px" }} />
          {label}
        </button>
      ))}

      <div className="bg-tertiary/20 rounded-full h-px mx-2 my-2" />

      <p className="text-xs text-tertiary/50 uppercase tracking-widest px-4 pt-1 pb-2 font-medium">
        Monitoring
      </p>
      {monitoringItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => { navigateToToolSection(id); onClose(); }}
          className={cn(
            "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-left transition-colors",
            activeToolSection === id
              ? "bg-background/80 text-accent"
              : "text-tertiary hover:text-white hover:bg-background/40"
          )}
        >
          <Icon size={16} className="flex-shrink-0" style={{ marginBottom: "2px" }} />
          {label}
        </button>
      ))}

      <div className="mt-auto pt-3">
        <Button
          variant="secondary"
          size="full"
          icon={<FaSyncAlt size={12} />}
          onClick={() => refreshAllData()}
        >
          Refresh
        </Button>
      </div>
    </aside>
  );
};
