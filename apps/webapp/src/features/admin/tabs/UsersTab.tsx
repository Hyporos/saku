import { useNavigate } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import CopyId from "../../../components/CopyId";
import { SortableHead } from "../components/SortableHead";
import { BatchBar } from "../components/BatchBar";
import { Pagination } from "../components/Pagination";
import { SectionHeader } from "../components/SectionHeader";
import { RowActions } from "../components/RowActions";
import { useAdminContext } from "../context";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const UsersTab = () => {
  const navigate = useNavigate();
  const {
    usersLoading, filteredUsers, pagedUsers, userPageCount,
    userSearch, setUserSearch, userPage, setUserPage,
    userSort, setUserSort, selUsers, setSelUsers,
    userData, setUserDetail, batchDeleteUsers, deleteUser,
    toggleSort, toggleSel, toggleAll,
  } = useAdminContext();

  return (
    <div className="bg-panel rounded-xl overflow-hidden flex-shrink-0">
      <SectionHeader
        title="Users"
        count={filteredUsers.length}
        canCreate={false}
        createSection="users"
      />
      <div className="bg-tertiary/20 h-px" />
      <div className="flex items-center gap-3 px-6 py-4 border-b border-tertiary/[6%]">
        <FaSearch size={13} className="text-tertiary/50 flex-shrink-0" />
        <input
          type="text"
          placeholder="Filter by username or Discord ID..."
          value={userSearch}
          onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
          className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none w-full max-w-xs"
        />
      </div>
      {usersLoading ? (
        <p className="px-6 py-8 text-sm text-tertiary/50 text-center">Loading...</p>
      ) : (
        <>
          <BatchBar
            count={selUsers.size}
            onDelete={batchDeleteUsers}
            onClear={() => setSelUsers(new Set())}
          />
          <table className="w-full table-fixed">
            <SortableHead
              cols={[
                { label: "User",       field: "username",       className: "w-[28%]" },
                { label: "Discord ID", field: "id",             className: "w-[38%]" },
                { label: "Characters", field: "characterCount", className: "w-[20%]" },
              ]}
              sort={userSort}
              onSort={(f) => toggleSort(userSort, f, setUserSort)}
              onSelectAll={() => toggleAll(pagedUsers.map((u) => u.id), selUsers, setSelUsers)}
              allSelected={pagedUsers.length > 0 && pagedUsers.every((u) => selUsers.has(u.id))}
              someSelected={pagedUsers.some((u) => selUsers.has(u.id))}
            />
            <tbody>
              {pagedUsers.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => {
                    const found = userData.find((u) => u._id === user.id);
                    if (found) { setUserDetail(found); navigate(`/admin/users/${user.id}`); }
                  }}
                  className="border-t border-tertiary/[6%] hover:bg-background/40 transition-colors cursor-pointer"
                >
                  <td className="pl-5 pr-2 py-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selUsers.has(user.id)}
                      onChange={() => toggleSel(selUsers, user.id, setSelUsers)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white">{user.username ?? "—"}</p>
                      {user.nickname && <p className="text-xs text-tertiary/60">{user.nickname}</p>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-tertiary/50 font-mono">
                    <CopyId id={user.id} />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-accent">{user.characterCount}</span>
                    <span className="text-tertiary"> linked</span>
                  </td>
                  <RowActions
                    onDelete={() => deleteUser(user.id, user.username)}
                  />
                </tr>
              ))}
              {pagedUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-sm text-tertiary/50 text-center">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination
            page={userPage}
            total={filteredUsers.length}
            pageCount={userPageCount}
            onPrev={() => setUserPage((p) => p - 1)}
            onNext={() => setUserPage((p) => p + 1)}
          />
        </>
      )}
    </div>
  );
};
