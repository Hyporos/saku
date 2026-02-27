import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { cn } from "../../../lib/utils";
import { FaLink, FaChevronDown } from "react-icons/fa";
import { useAdminContext } from "../context";
import { inputCls, BOT_API } from "../constants";
import { useNotifications } from "../../../context/NotificationContext";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

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

  // Form state
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<GuildMember | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [charInput, setCharInput] = useState("");
  const [memberSince, setMemberSince] = useState(dayjs().format("MMM DD, YYYY"));
  const [verifyState, setVerifyState] = useState<VerifyState>("idle");
  const [verifiedName, setVerifiedName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [creating, setCreating] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch guild members on open
  useEffect(() => {
    if (!isOpen) return;
    setMembersLoading(true);
    axios
      .get<GuildMember[]>(`${BOT_API}/bot/api/admin/guild-members`)
      .then((res) => setGuildMembers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setGuildMembers([]))
      .finally(() => setMembersLoading(false));
  }, [isOpen]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setUserSearch("");
      setSelectedUser(null);
      setDropdownOpen(false);
      setCharInput("");
      setMemberSince(dayjs().format("MMM DD, YYYY"));
      setVerifyState("idle");
      setVerifiedName("");
      setErrorMsg("");
      setCreating(false);
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

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60]"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-[70] pointer-events-none">
        <div
          className="bg-panel border border-tertiary/[8%] rounded-2xl p-8 w-[480px] pointer-events-auto drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon + title */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mt-0.5">
              <FaLink size={14} className="text-accent" />
            </div>
            <div>
              <h3 className="text-lg">Link Character</h3>
              <p className="text-sm text-tertiary mt-1 leading-relaxed">
                Select a Discord user and enter the character name to link.
              </p>
            </div>
          </div>

          {/* Discord user select with autocomplete */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-tertiary/70 uppercase tracking-wider">Discord User</label>
            <div className="relative" ref={dropdownRef}>
              <div
                className={cn(
                  inputCls,
                  "flex items-center gap-2 cursor-pointer"
                )}
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
              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-panel border border-tertiary/20 rounded-lg shadow-lg z-[10] max-h-[240px] overflow-hidden flex flex-col">
                  <div className="px-3 py-2 border-b border-tertiary/10">
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none w-full"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {membersLoading ? (
                      <p className="px-3 py-4 text-sm text-tertiary/50 text-center">Loading members...</p>
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
              )}
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
            <input
              className={cn(inputCls)}
              placeholder="e.g. Jun 15, 2024"
              value={memberSince}
              onChange={(e) => setMemberSince(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-1">
            <button
              disabled={isVerified ? creating : !canVerify}
              onClick={isVerified ? handleCreate : handleVerify}
              className={cn(
                "flex-1 rounded-lg py-2.5 text-sm transition-colors",
                (isVerified || canVerify) && !creating
                  ? "bg-accent/15 hover:bg-accent/20 text-accent"
                  : "bg-background/60 text-tertiary/30 cursor-default"
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
      </div>
    </>
  );
};
