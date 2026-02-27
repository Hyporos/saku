import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import useAuth from "./hooks/useAuth";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import Login from "./pages/Login";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Shared chrome (Header + Footer) wrapping each protected page
const AppLayout = ({ children, noFooter = false }: { children: React.ReactNode; noFooter?: boolean }) => (
  <div className="flex flex-col h-dvh">
    <Header />
    <div className="flex flex-1 min-h-0">{children}</div>
    {!noFooter && <Footer />}
  </div>
);

// Redirect to /login if unauthenticated; redirect to / if bee access is required
// but the user isn't a bee. Shows a blank loading state while the session resolves.
const OWNER_ID = import.meta.env.VITE_OWNER_ID as string | undefined;
const ProtectedRoute = ({
  children,
  requireBee = false,
}: {
  children: React.ReactNode;
  requireBee?: boolean;
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-tertiary/50 text-sm">
        Loading...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (
    requireBee &&
    !(user.isBee || user.id === OWNER_ID)
  )
    return <Navigate to="/" replace />;

  return <>{children}</>;
};

// All /admin/* routes render the same component — extract once to avoid repeating
// the entire ProtectedRoute + AppLayout wrapper tree six times.
const AdminRoute = () => (
  <ProtectedRoute requireBee>
    <AppLayout noFooter>
      <AdminPanel />
    </AppLayout>
  </ProtectedRoute>
);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route path="/admin"                    element={<AdminRoute />} />
          <Route path="/admin/users"              element={<AdminRoute />} />
          <Route path="/admin/users/:userId"      element={<AdminRoute />} />
          <Route path="/admin/characters"         element={<AdminRoute />} />
          <Route path="/admin/characters/:charName" element={<AdminRoute />} />
          <Route path="/admin/scores"             element={<AdminRoute />} />
          <Route path="/admin/exceptions"         element={<AdminRoute />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;