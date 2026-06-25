import { useRef, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import useAuth from "../hooks/useAuth";
import logo from "../assets/logo.webp";
import { FaSignOutAlt, FaShieldAlt, FaUserAlt } from "react-icons/fa";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const OWNER_ID = import.meta.env.VITE_OWNER_ID as string | undefined;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const Header = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isAdminPanel = location.pathname.startsWith("/admin");

  // Desktop dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownMounted, setDropdownMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Mobile profile sidebar
  const [profileMounted, setProfileMounted] = useState(false);
  const [profileAnimating, setProfileAnimating] = useState(false);

  // Close desktop dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mount before animating in; allow CSS transition to play
  const openDropdown = () => {
    setDropdownMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setDropdownOpen(true)));
  };
  const closeDropdown = () => {
    setDropdownOpen(false);
  };
  const toggleDropdown = () => (dropdownOpen ? closeDropdown() : openDropdown());

  // Mobile profile sidebar helpers
  const openProfile = () => {
    setProfileMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setProfileAnimating(true)));
  };
  const closeProfile = () => {
    setProfileAnimating(false);
    setTimeout(() => setProfileMounted(false), 300);
  };

  const roleLabel =
    user?.isBee ? "Bee (Staff)" : user?.id === OWNER_ID ? "Owner" : "Member";

  return (
    <section className="flex justify-center bg-panel h-[80px] flex-shrink-0">
      <div className={cn("flex justify-between items-center w-full transition-all", isAdminPanel ? "px-4 md:px-8" : "px-4 md:px-12")}>
        <div className="flex items-center gap-24">
          {/* Logo — no navigation */}
          <div className="flex items-center gap-4 md:gap-8">
            <img src={logo} className="w-9 h-9 md:w-12 md:h-12" alt="Saku" />
            <h1 className="text-2xl md:text-4xl">Saku</h1>
          </div>
        </div>

        <div className="flex items-center gap-8">
          {user && (
            <>
              {/* Mobile: bare avatar → opens right sidebar */}
              <button
                onClick={openProfile}
                className="md:hidden p-0.5 rounded-full border-2 border-accent/60 hover:border-accent transition-colors"
              >
                <img
                  className="rounded-full object-cover block"
                  src={user.avatar}
                  width={30}
                  height={30}
                  alt={user.username}
                />
              </button>

              {/* Desktop: pill button with dropdown */}
              <div className="relative hidden md:block" ref={dropdownRef}>
                <button
                  onClick={toggleDropdown}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl pl-2 pr-3 py-1.5 border transition-colors",
                    dropdownOpen
                      ? "bg-background/80 border-tertiary/20"
                      : "bg-background/40 border-tertiary/[10%] hover:bg-background/60 hover:border-tertiary/20"
                  )}
                >
                  <img
                    className="border-2 border-accent/60 rounded-full object-cover flex-shrink-0"
                    src={user.avatar}
                    width={30}
                    height={30}
                    alt={user.username}
                  />
                  <span className="text-sm text-white/90 font-medium">{user.username}</span>
                </button>

                {/* Animated dropdown */}
                {dropdownMounted && (
                  <div
                    onTransitionEnd={() => { if (!dropdownOpen) setDropdownMounted(false); }}
                    className={cn(
                      "absolute right-0 top-[calc(100%+8px)] bg-panel border border-tertiary/10 rounded-xl drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] p-1 min-w-[190px] z-50 transition-all duration-200 origin-top-right",
                      dropdownOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
                    )}
                  >
                    <div className="px-4 py-3 border-b border-tertiary/[8%]">
                      <p className="text-sm font-medium">{user.username}</p>
                      <p className="text-xs text-tertiary/60 mt-0.5">{roleLabel}</p>
                    </div>
                    <a
                      href="http://localhost:8000/auth/logout"
                      className="flex w-full items-center gap-2 text-left text-sm text-[#C87070] hover:text-red-400 hover:bg-[#A46666]/10 rounded-lg px-4 py-2.5 transition-colors mt-1"
                    >
                      <FaSignOutAlt size={12} style={{ marginBottom: "1px" }} />
                      Log out
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile profile sidebar */}
      {profileMounted && (
        <>
          {/* Backdrop */}
          <div
            className={cn(
              "fixed inset-0 bg-black/60 z-[125] md:hidden transition-opacity duration-300",
              profileAnimating ? "opacity-100" : "opacity-0"
            )}
            onClick={closeProfile}
          />

          {/* Panel */}
          <div
            className={cn(
              "fixed right-0 top-0 h-full w-[260px] bg-panel border-l border-tertiary/[6%] z-[130] flex flex-col md:hidden transition-transform duration-300",
              profileAnimating ? "translate-x-0" : "translate-x-full"
            )}
          >
            {/* User info */}
            {user && (
              <div className="flex items-center gap-3 px-5 py-5 border-b border-tertiary/[8%]">
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-10 h-10 rounded-full object-cover border-2 border-accent/50 flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{user.username}</p>
                  <p className="text-xs text-tertiary/60 mt-0.5 flex items-center gap-1">
                    {user.isBee ? (
                      <FaShieldAlt size={10} className="flex-shrink-0" />
                    ) : (
                      <FaUserAlt size={10} className="flex-shrink-0" />
                    )}
                    {roleLabel}
                  </p>
                </div>
              </div>
            )}

            {/* Log out pinned at bottom */}
            <div className="mt-auto border-t border-tertiary/[8%] p-4">
              <a
                href="http://localhost:8000/auth/logout"
                className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm bg-[#A46666]/10 border border-[#A46666]/30 text-[#C87070] hover:text-red-400 hover:border-[#A46666]/50 transition-colors"
              >
                <FaSignOutAlt size={13} />
                Log out
              </a>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default Header;
