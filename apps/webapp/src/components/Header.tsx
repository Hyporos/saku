import { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import useAuth from "../hooks/useAuth";
import logo from "../assets/logo.webp";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const navLinks = [
  { label: "Dashboard", path: "/" },
];
const OWNER_ID = import.meta.env.VITE_OWNER_ID as string | undefined;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const Header = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <section className="flex justify-center bg-panel h-[80px] flex-shrink-0">
      <div className="flex justify-between items-center px-12 w-full">
        <div className="flex items-center gap-24">
          <button
            className="flex items-center gap-9"
            onClick={() => navigate("/")}
          >
            <img src={logo} width={48} height={48} />
            <h1 className="text-4xl">Saku</h1>
          </button>

          <nav className="flex gap-12">
            {navLinks.map(({ label, path }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={cn(
                  "transition-colors",
                  location.pathname === path
                    ? "text-accent"
                    : "text-white hover:text-tertiary"
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-8">
          {/* Admin Panel link — visible to bees and the server owner */}
          {(user?.isBee || user?.id === OWNER_ID) && (
            <button
              onClick={() => navigate("/admin")}
              className={cn(
                "text-sm transition-colors",
                location.pathname === "/admin"
                  ? "text-accent"
                  : "text-tertiary hover:text-white"
              )}
            >
              Admin Panel
            </button>
          )}

          {/* User avatar with logout dropdown */}
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="focus:outline-none"
              >
                <img
                  className="border-2 border-accent rounded-full object-cover"
                  src={user.avatar}
                  width={45}
                  height={45}
                  alt={user.username}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-[calc(100%+10px)] bg-panel border border-tertiary/10 rounded-xl drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] p-1 min-w-[180px] z-50">
                  <div className="px-4 py-3 border-b border-tertiary/[8%]">
                    <p className="text-sm font-medium">{user.username}</p>
                    <p className="text-xs text-tertiary/60 mt-0.5">
                      {user.isBee ? "Bee (Staff)" : "Member"}
                    </p>
                  </div>
                  <a
                    href="http://localhost:8000/auth/logout"
                    className="flex w-full text-left text-sm text-tertiary hover:text-white hover:bg-background/60 rounded-lg px-4 py-2.5 transition-colors mt-1"
                  >
                    Log out
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Header;
