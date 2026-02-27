import { cn } from "../../../lib/utils";
import { useAdminContext } from "../context";

export const AdminSidebar = () => {
  const { activeSection, navigateToSection, navItems } = useAdminContext();

  return (
    <aside className="bg-panel flex flex-col gap-1 p-4 w-[220px] flex-shrink-0 border-r border-tertiary/[6%]">
      <p className="text-xs text-tertiary/50 uppercase tracking-widest px-4 pt-3 pb-2 font-medium">
        Database
      </p>
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => navigateToSection(id)}
          className={cn(
            "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-left transition-colors",
            activeSection === id
              ? "bg-background/80 text-accent"
              : "text-tertiary hover:text-white hover:bg-background/40"
          )}
        >
          <Icon size={16} className="flex-shrink-0" />
          {label}
        </button>
      ))}

      <div className="bg-tertiary/20 rounded-full h-px mx-2 my-2" />
    </aside>
  );
};
