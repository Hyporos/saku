import { useState } from "react";
import { FaSearch, FaUsers } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import CopyId from "../../../components/CopyId";
import { SortableHead } from "../components/SortableHead";
import { BatchPopup } from "../components/BatchPopup";
import { Pagination } from "../components/Pagination";
import { SectionHeader } from "../components/SectionHeader";
import { RowActions } from "../components/RowActions";
import { useAdminContext } from "../context";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const UsersTab = () => {
  const {
    usersLoading, filteredUsers, pagedUsers, userPageCount,
    userSearch, setUserSearch, userPage, setUserPage,
    userSort, setUserSort, selUsers, setSelUsers,
    userData, openUserDetail, batchDeleteUsers, deleteUser,
    toggleSort, toggleSel, toggleAll,
  } = useAdminContext();

  const [filtersOpen, setFiltersOpen] = useState(false);
  void filtersOpen; void setFiltersOpen;

  return (
    <>
    <div className="bg-panel rounded-xl overflow-visible flex-shrink-0 flex flex-col md:h-[760px]">
      <SectionHeader
        title="Users"
        count={filteredUsers.length}
        canCreate={false}
        createSection="users"
      />
      <div className="bg-tertiary/20 h-px flex-shrink-0" />
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 h-[63px] border-b border-tertiary/[6%] flex-shrink-0">
        <FaSearch size={13} className="text-tertiary/50 flex-shrink-0 mb-0.5" />
        <input
          type="text"
          placeholder="Filter by username or Discord ID..."
          value={userSearch}
          onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
          className="bg-transparent text-sm text-white placeholder-tertiary/40 focus:outline-none w-full max-w-xs"
        />
      </div>
      {usersLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-tertiary/50">Loading...</p>
        </div>
      ) : (
        <>
          <BatchPopup
            count={selUsers.size}
            onDelete={batchDeleteUsers}
            onClear={() => setSelUsers(new Set())}
          />
          <div className="overflow-y-auto overflow-x-auto md:flex-1 md:min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-panel [&::-webkit-scrollbar-thumb]:bg-tertiary/20 [&::-webkit-scrollbar-thumb]:rounded-full">
            {pagedUsers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-tertiary/50">
                <FaUsers size={24} />
                <p className="text-sm">No users found</p>
              </div>
            ) : (
              <table className="w-full table-auto min-w-[580px]">
                <SortableHead
                  theadClassName="sticky top-0 bg-panel z-10"
                  cols={[
                    { label: "User",       field: "username"       },
                    { label: "Discord ID", field: "id"             },
                    { label: "Characters", field: "characterCount" },
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
                    if (found) openUserDetail(found);
                  }}
                  className="border-t border-tertiary/[6%] hover:bg-background/40 transition-colors cursor-pointer"
                >
                  <td className="pl-6 pr-2 py-4" onClick={(e) => e.stopPropagation()}>
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
              </tbody>
            </table>
          )}
          </div>
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
    </>
  );
};
