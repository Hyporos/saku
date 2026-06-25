import { useState } from "react";
import { AdminProvider, useAdminContext } from "../features/admin/context";
import { useMatch } from "react-router-dom";
import { FaBars } from "react-icons/fa";
import { cn } from "../lib/utils";
import { AdminSidebar } from "../features/admin/components/AdminSidebar";
import { DrawerPanel } from "../features/admin/components/DrawerPanel";
import { TransferModal } from "../features/admin/components/TransferModal";
import { RenameModal } from "../features/admin/components/RenameModal";
import { UnlinkModal } from "../features/admin/components/UnlinkModal";
import { BatchUnlinkModal } from "../features/admin/components/BatchUnlinkModal";
import { UsersTab } from "../features/admin/tabs/UsersTab";
import { CharactersTab } from "../features/admin/tabs/CharactersTab";
import { ScoresTab } from "../features/admin/tabs/ScoresTab";
import { ExceptionsTab } from "../features/admin/tabs/ExceptionsTab";
import { CharacterDetail } from "../features/admin/tabs/CharacterDetail";
import { UserDetail } from "../features/admin/tabs/UserDetail";
import { ActionLogTab } from "../features/admin/tabs/ActionLogTab";
import { ScannerTab } from "../features/admin/tabs/ScannerTab";
import { ScheduledTasksTab } from "../features/admin/tabs/ScheduledTasksTab";
import WarningModal from "../components/WarningModal";
import { Button } from "../components/Button";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Inner layout — consumes context, must be rendered inside AdminProvider
const AdminPanelLayout = () => {
  const { activeSection, charDetail, userDetail, modal, closeModal, activeToolSection } = useAdminContext();
  const isCharDetailRoute = !!useMatch("/admin/characters/:charName");
  const isUserDetailRoute = !!useMatch("/admin/users/:userId");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const mobileLabel =
    charDetail ? charDetail.name
    : userDetail ? (userDetail.username ?? "User")
    : isCharDetailRoute ? "Character"
    : isUserDetailRoute ? "User"
    : activeToolSection === "action-log" ? "Action Log"
    : activeToolSection === "scanner" ? "Scanner"
    : activeToolSection === "scheduled-tasks" ? "Scheduled Tasks"
    : activeSection === "users" ? "Users"
    : activeSection === "characters" ? "Characters"
    : activeSection === "scores" ? "Scores"
    : activeSection === "exceptions" ? "Exceptions"
    : "Admin";

  const renderMain = () => {
    if (activeToolSection === "action-log") return <ActionLogTab />;
    if (activeToolSection === "scheduled-tasks") return <ScheduledTasksTab />;

    if (charDetail || isCharDetailRoute) return <CharacterDetail />;
    if (userDetail || isUserDetailRoute) return <UserDetail />;

    switch (activeSection) {
      case "users":      return <UsersTab />;
      case "characters": return <CharactersTab />;
      case "scores":     return <ScoresTab />;
      case "exceptions": return <ExceptionsTab />;
    }
  };

  return (
    <section className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">

      {/* Mobile topbar */}
      <div className="md:hidden flex items-center gap-3 px-4 h-14 bg-panel border-b border-tertiary/[8%] flex-shrink-0">
        <Button
          variant="tertiary"
          size="mobile"
          onClick={() => setSidebarOpen(true)}
          className="p-1 -ml-1"
        >
          <FaBars size={16} />
        </Button>
        <span className="text-sm font-medium truncate">{mobileLabel}</span>
      </div>

      {/* Mobile sidebar backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 z-[90] md:hidden transition-opacity duration-200",
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSidebarOpen(false)}
      />

      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-4 md:gap-6">
        {/* ScannerTab is always mounted so its results survive tab switches.
            display:contents makes it transparent to the flex layout when active;
            display:none hides it (but keeps it alive in the tree) when inactive. */}
        <div className={activeToolSection === "scanner" ? "contents" : "hidden"}>
          <ScannerTab />
        </div>
        {activeToolSection !== "scanner" && renderMain()}
      </main>

      <DrawerPanel />

      {modal && (
        <WarningModal
          isOpen={modal.isOpen}
          variant={modal.variant}
          title={modal.title}
          description={modal.description}
          onConfirm={modal.onConfirm}
          onCancel={closeModal}
          confirmLabel={modal.variant === "confirm" ? modal.confirmLabel : undefined}
          confirmDanger={modal.variant === "confirm" ? modal.confirmDanger : undefined}
          confirmWord={modal.variant === "sensitive" ? modal.confirmWord : undefined}
          colorVariant={modal.colorVariant}
          icon={modal.icon}
        />
      )}

      <TransferModal />
      <RenameModal />
      <UnlinkModal />
      <BatchUnlinkModal />
    </section>
  );
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const AdminPanel = () => (
  <AdminProvider>
    <AdminPanelLayout />
  </AdminProvider>
);

export default AdminPanel;