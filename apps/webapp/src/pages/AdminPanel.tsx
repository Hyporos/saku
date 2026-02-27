import { AdminProvider, useAdminContext } from "../features/admin/context";
import { useMatch } from "react-router-dom";
import { AdminSidebar } from "../features/admin/components/AdminSidebar";
import { DrawerPanel } from "../features/admin/components/DrawerPanel";
import { TransferModal } from "../features/admin/components/TransferModal";
import { UsersTab } from "../features/admin/tabs/UsersTab";
import { CharactersTab } from "../features/admin/tabs/CharactersTab";
import { ScoresTab } from "../features/admin/tabs/ScoresTab";
import { ExceptionsTab } from "../features/admin/tabs/ExceptionsTab";
import { CharacterDetail } from "../features/admin/tabs/CharacterDetail";
import { UserDetail } from "../features/admin/tabs/UserDetail";
import WarningModal from "../components/WarningModal";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Inner layout — consumes context, must be rendered inside AdminProvider
const AdminPanelLayout = () => {
  const { activeSection, charDetail, userDetail, modal, closeModal } = useAdminContext();
  const isCharDetailRoute = !!useMatch("/admin/characters/:charName");
  const isUserDetailRoute = !!useMatch("/admin/users/:userId");

  const renderMain = () => {
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
    <section className="flex flex-1 min-h-0">
      <AdminSidebar />

      <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
        {renderMain()}
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
        />
      )}

      <TransferModal />
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