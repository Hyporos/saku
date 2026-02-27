import { cn } from "../../../lib/utils";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  FaArrowLeft, FaUserAlt, FaTrash, FaShieldAlt,
} from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import CopyId from "../../../components/CopyId";
import { SortableHead } from "../components/SortableHead";
import { BatchBar } from "../components/BatchBar";
import { RowActions } from "../components/RowActions";
import { useAdminContext } from "../context";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const UserDetail = () => {
  const navigate = useNavigate();
  const {
    userDetail, setUserDetail,
    userMemberData, userDetailCharSort, setUserDetailCharSort,
    selUserDetailChars, setSelUserDetailChars,
    deleteUser, deleteCharacter, batchDeleteUserDetailChars,
    openCharDetail,
    toggleSort, toggleSel, toggleAll,
  } = useAdminContext();

  if (!userDetail) return null;

  // Sort characters — derive participation rate per character
  const rawUserChars = userDetail.characters.map((c) => {
    const participated = c.scores.filter((s) => s.score > 0).length;
    const total = c.scores.length;
    return { ...c, participationRate: total > 0 ? Math.round((participated / total) * 100) : 0 };
  });
  const userChars = userDetailCharSort
    ? [...rawUserChars].sort((a, b) => {
        const dir = userDetailCharSort.dir === "asc" ? 1 : -1;
        switch (userDetailCharSort.field) {
          case "name":              return dir * a.name.localeCompare(b.name);
          case "memberSince":       return dir * (dayjs(a.memberSince).valueOf() - dayjs(b.memberSince).valueOf());
          case "participationRate": return dir * (a.participationRate - b.participationRate);
          case "scores":            return dir * (a.scores.length - b.scores.length);
          default:                  return 0;
        }
      })
    : rawUserChars;

  return (
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <button
        onClick={() => { setUserDetail(null); navigate("/admin/users"); }}
        className="flex items-center gap-2 text-sm text-tertiary hover:text-white transition-colors self-start"
      >
        <FaArrowLeft size={12} /> Back to Users
      </button>

      {/* Header */}
      <div className="bg-panel rounded-xl px-6 py-5 flex items-center gap-5">
        {userDetail.avatarUrl ? (
          <img
            src={userDetail.avatarUrl}
            alt={userDetail.username ?? ""}
            className="w-14 h-14 rounded-full object-cover bg-background shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-background flex items-center justify-center shrink-0">
            <FaUserAlt size={20} className="text-tertiary/40" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl">{userDetail.username ?? "Unknown User"}</h2>
            {userDetail.nickname && (
              <span className="text-sm text-tertiary/60">{userDetail.nickname}</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-tertiary/50">
            <CopyId id={userDetail._id} />
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); deleteUser(userDetail._id, userDetail.username); }}
          title="Delete user"
          className="flex items-center gap-1.5 text-xs text-[#A46666]/70 hover:text-[#A46666] border border-[#A46666]/20 hover:border-[#A46666]/40 rounded-lg px-2.5 py-1.5 transition-colors shrink-0"
        >
          <FaTrash size={11} className="mb-0.5" /> Delete User
        </button>
      </div>

      {/* Condensed info */}
      <div className="bg-panel rounded-xl divide-y divide-tertiary/[6%]">
        <div className="px-6 py-4 flex items-center gap-4">
          <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">Role</span>
          <div className="flex items-center gap-1.5 text-sm text-tertiary">
            {(userMemberData?.role ?? userDetail.role) === "bee" ? (
              <FaShieldAlt size={11} className="text-tertiary/60 mb-0.5" />
            ) : (
              <FaUserAlt size={11} className="text-tertiary/60 mb-0.5" />
            )}
            <span className="capitalize">{userMemberData?.role ?? userDetail.role ?? "—"}</span>
          </div>
        </div>
        <div className="px-6 py-4 flex items-center gap-4">
          <span className="text-xs text-tertiary uppercase tracking-wide font-medium w-32 shrink-0">Member Since</span>
          <span className="text-sm text-tertiary">
            {(userMemberData?.joinedAt ?? userDetail.joinedAt)
              ? dayjs(userMemberData?.joinedAt ?? userDetail.joinedAt).format("MMM DD, YYYY")
              : "—"}
          </span>
        </div>
      </div>

      {/* Characters table */}
      <div className="bg-panel rounded-xl overflow-hidden flex-shrink-0">
        <div className="px-6 py-5 flex items-center gap-4">
          <h3 className="text-lg">Linked Characters</h3>
          <span className="text-tertiary/60 text-sm mt-1">{rawUserChars.length} linked</span>
        </div>
        <div className="bg-tertiary/20 h-px" />
        <BatchBar
          count={selUserDetailChars.size}
          onDelete={batchDeleteUserDetailChars}
          onClear={() => setSelUserDetailChars(new Set())}
        />
        <table className="w-full table-fixed">
          <SortableHead
            cols={[
              { label: "Name",          field: "name"              },
              { label: "Member Since",  field: "memberSince"       },
              { label: "Participation", field: "participationRate" },
              { label: "Scores",        field: "scores"            },
            ]}
            sort={userDetailCharSort}
            onSort={(f) => toggleSort(userDetailCharSort, f, setUserDetailCharSort)}
            onSelectAll={() =>
              toggleAll(userChars.map((c) => c.name), selUserDetailChars, setSelUserDetailChars)
            }
            allSelected={userChars.length > 0 && userChars.every((c) => selUserDetailChars.has(c.name))}
            someSelected={userChars.some((c) => selUserDetailChars.has(c.name))}
          />
          <tbody>
            {userChars.map((char) => (
              <tr
                key={char.name}
                onClick={() => {
                  const participatedCount = char.scores.filter((s) => s.score > 0).length;
                  const totalCount = char.scores.length;
                  openCharDetail(
                    {
                      ...char,
                      userId: userDetail._id,
                      scoreCount: totalCount,
                      participationRate: totalCount > 0 ? Math.round((participatedCount / totalCount) * 100) : 0,
                    },
                    userDetail
                  );
                }}
                className="border-t border-tertiary/[6%] hover:bg-background/40 transition-colors cursor-pointer"
              >
                <td className="pl-5 pr-2 py-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selUserDetailChars.has(char.name)}
                    onChange={() => toggleSel(selUserDetailChars, char.name, setSelUserDetailChars)}
                  />
                </td>
                <td className="px-6 py-4 text-sm text-accent">{char.name}</td>
                <td className="px-6 py-4 text-sm text-tertiary">{char.memberSince}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={cn(char.participationRate === 100 && "text-accent")}>
                    {char.participationRate}%
                  </span>
                  <span className="text-tertiary/50 ml-1 text-xs">
                    ({char.scores.filter((s) => s.score > 0).length}/{char.scores.length})
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">{char.scores.length}</td>
                <RowActions
                  onDelete={() => { deleteCharacter(userDetail._id, char.name); }}
                />
              </tr>
            ))}
            {userChars.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-sm text-tertiary/50 text-center">
                  No characters linked
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
