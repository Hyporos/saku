import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { cn } from "../../../lib/utils";
import { FaTimes, FaChevronDown } from "react-icons/fa";
import { useAdminContext } from "../context";
import { inputCls, BOT_API } from "../constants";
import { useNotifications } from "../../../context/NotificationContext";
import DatePicker from "../../../components/DatePicker";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Discord CDN serves GIF avatars for animated profile pictures — static is enforced server-side via forceStatic

type GuildMember = {
  id: string;
  username: string;
  nickname: string;
  avatarUrl: string;
};

type VerifyState = "idle" | "loading" | "found" | "error";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const LinkCharacterModal = ({ isOpen, onClose }: Props) => {
  const { refreshUsers, refreshActionLog, liveCharacters } = useAdminContext();
  const { notify } = useNotifications();

  // Guild members for autocomplete
  const [guildMembers, setGuildMembers] = useState<GuildMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(false);

  const fetchGuildMembers = () => {
    setMembersLoading(true);
    setMembersError(false);
    axios
      .get<GuildMember[]>(`${BOT_API}/bot/api/admin/guild-members`, { withCredentials: true })
      .then((res) => setGuildMembers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMembersError(true))
      .finally(() => setMembersLoading(false));
  };

  // Form state
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<GuildMember | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [charInput, setCharInput] = useState("");
  const [memberSince, setMemberSince] = useState(dayjs().format("YYYY-MM-DD"));
  const [verifyState, setVerifyState] = useState<VerifyState>("idle");
  const [verifiedName, setVerifiedName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [creating, setCreating] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (dropdownOpen) searchInputRef.current?.focus();
  }, [dropdownOpen]);

  // Fetch guild members on open
  useEffect(() => {
    if (!isOpen) return;
    fetchGuildMembers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setUserSearch("");
      setSelectedUser(null);
      setDropdownOpen(false);
      setCharInput("");
      setMemberSince(dayjs().format("YYYY-MM-DD"));
      setVerifyState("idle");
      setVerifiedName("");
      setErrorMsg("");
      setCreating(false);
      setGuildMembers([]);
      setMembersError(false);
    }
  }, [isOpen]);

  // Reset verify state on character input change
  useEffect(() => {
    setVerifyState("idle");
    setVerifiedName("");
    setErrorMsg("");
  }, [charInput]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const filteredMembers = useMemo(() => {
    if (!userSearch.trim()) return guildMembers;
    const q = userSearch.toLowerCase();
    return guildMembers.filter(
      (m) =>
        m.username.toLowerCase().includes(q) ||
        m.nickname.toLowerCase().includes(q) ||
        m.id.includes(q)
    );
  }, [guildMembers, userSearch]);

  const handleSelectUser = (member: GuildMember) => {
    setSelectedUser(member);
    setUserSearch(member.nickname || member.username);
    setDropdownOpen(false);
  };

  const handleVerify = async () => {
    const name = charInput.trim();
    if (!name) return;

    // Check if already linked
    const exists = liveCharacters.some(
      (c) => c.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      setVerifyState("error");
      setErrorMsg("This character is already linked to a user.");
      return;
    }

    setVerifyState("loading");
    try {
      const res = await axios.get(`${BOT_API}/bot/api/rankings/${encodeURIComponent(name)}`);
      const rankedName = res.data?.ranks?.[0]?.characterName ?? res.data?.ranks?.[0]?.character_name ?? name;
      setVerifiedName(rankedName);
      setVerifyState("found");
    } catch {
      setVerifyState("error");
      setErrorMsg("Character not found on MapleStory rankings.");
    }
  };

  const handleCreate = async () => {
    if (!selectedUser || !verifiedName) return;
    setCreating(true);
    try {
      await axios.post(`${BOT_API}/bot/api/admin/characters`, {
        userId: selectedUser.id,
        name: verifiedName,
        memberSince,
        username: selectedUser.username,
      });
      notify("success", `Linked ${verifiedName} to ${selectedUser.nickname || selectedUser.username}`);
      await refreshUsers(true);
      await refreshActionLog();
      onClose();
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        setVerifyState("error");
        setErrorMsg("This character is already linked to a user.");
      } else {
        const ax = e as import("axios").AxiosError<{ error?: string }>;
        notify("error", ax?.response?.data?.error ?? "Failed to link character");
      }
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  const canVerify = charInput.trim().length > 0 && verifyState !== "loading" && !!selectedUser;
  const isVerified = verifyState === "found";
  const submitDisabled = isVerified ? creating : !canVerify;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-[420px] bg-panel border-l border-tertiary/[8%] z-50 overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-tertiary/[8%]">
          <div>
            <h2 className="text-xl">Link Character</h2>
            <p className="text-tertiary text-sm mt-0.5">Link a new character for a user in the guild.</p>
          </div>
          <button onClick={onClose} className="text-tertiary hover:text-white transition-colors">
            <FaTimes size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-5 px-8 py-6 flex-1">

          {/* Discord user select with autocomplete */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-tertiary/70 uppercase tracking-wider">Discord User</label>
            <div className="relative" ref={dropdownRef}>
              <div
                className={cn(inputCls, "flex items-center gap-2 cursor-pointer")}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {selectedUser ? (
                  <>
                    <img
                      src={selectedUser.avatarUrl}
                      alt=""
                      className="w-5 h-5 rounded-full flex-shrink-0"
                    />
                    <span className="flex-1 truncate">{selectedUser.nickname || selectedUser.username}</span>
                    <span className="text-xs text-tertiary/40">{selectedUser.username}</span>
                  </>
                ) : (
                  <span className="flex-1 text-tertiary/40">Select user...</span>
                )}
                <FaChevronDown
                  size={10}
                  className={cn(
                    "text-tertiary/40 transition-transform flex-shrink-0",
                    dropdownOpen && "rotate-180"
                  )}
                />
              </div>
              <div
                className={cn(
                  "absolute top-full left-0 right-0 mt-1 bg-panel border border-tertiary/20 rounded-lg shadow-lg z-[10] overflow-hidden flex flex-col",
                  "transition-all duration-150 ease-in-out",
                  dropdownOpen
                    ? "max-h-[240px] opacity-100 pointer-events-auto"
                    : "max-h-0 opacity-0 pointer-events-none"
                )}
              >
                <div className="px-3 py-2 border-b border-tertiary/10">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search members..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none w-full"
                  />
                </div>
                <div className="overflow-y-auto flex-1">
                  {membersLoading ? (
                    <p className="px-3 py-4 text-sm text-tertiary/50 text-center">Loading members...</p>
                  ) : membersError ? (
                    <div className="px-3 py-4 text-center">
                      <p className="text-sm text-[#C87070] mb-2">Failed to load members</p>
                      <button
                        onClick={fetchGuildMembers}
                        className="text-xs text-accent hover:text-accent/80 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-tertiary/50 text-center">No members found</p>
                  ) : (
                    filteredMembers.slice(0, 50).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleSelectUser(m)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-background/60 transition-colors text-left"
                      >
                        <img
                          src={m.avatarUrl}
                          alt=""
                          className="w-5 h-5 rounded-full flex-shrink-0"
                        />
                        <span className="text-sm text-white truncate flex-1">
                          {m.nickname || m.username}
                        </span>
                        {m.nickname !== m.username && (
                          <span className="text-xs text-tertiary/40">{m.username}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Character name input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-tertiary/70 uppercase tracking-wider">Character Name</label>
            <input
              className={cn(inputCls)}
              placeholder="Character name..."
              value={charInput}
              onChange={(e) => setCharInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (isVerified) handleCreate();
                  else if (canVerify) handleVerify();
                }
              }}
            />
            {verifyState === "error" && (
              <p className="text-xs text-red-400">{errorMsg}</p>
            )}
            {verifyState === "found" && (
              <p className="text-xs text-green-400">Character found ({verifiedName}) — click Create to confirm.</p>
            )}
          </div>

          {/* Member Since */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-tertiary/70 uppercase tracking-wider">Member Since</label>
            <DatePicker
              value={memberSince}
              onChange={setMemberSince}
              placeholder="Select Date"
              subtle
            />
          </div>

        </div>

        {/* Actions */}
        <div className="flex gap-3 px-8 py-6 border-t border-tertiary/[8%]">
          <button
            disabled={submitDisabled}
            onClick={isVerified ? handleCreate : handleVerify}
            className={cn(
              "flex-1 rounded-lg py-2.5 text-sm transition-colors",
              !submitDisabled
                ? "bg-accent/15 hover:bg-accent/20 text-accent"
                : "bg-tertiary/10 text-tertiary/40 cursor-default"
            )}
          >
            {verifyState === "loading"
              ? "Verifying..."
              : creating
                ? "Creating..."
                : isVerified
                  ? "Create"
                  : "Verify Name"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-background hover:bg-background/60 text-tertiary rounded-lg py-2.5 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>

      </div>
    </>
  );
};
