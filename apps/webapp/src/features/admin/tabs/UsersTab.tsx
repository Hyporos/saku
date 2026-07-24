import { FaUsers } from "react-icons/fa";
import Checkbox from "../../../components/Checkbox";
import CopyId from "../../../components/CopyId";
import { SortableHead } from "../components/SortableHead";
import { BatchPopup } from "../components/BatchPopup";
import { Pagination } from "../components/Pagination";
import { SectionHeader } from "../components/SectionHeader";
import { SearchInput } from "../components/SearchInput";
import { EmptyState } from "../components/EmptyState";
import { ListPanel } from "../components/ListPanel";
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

  return (
    <ListPanel
      header={<SectionHeader title="Users" count={filteredUsers.length} canCreate={false} />}
      filter={
        <SearchInput
          value={userSearch}
          onChange={(v) => { setUserSearch(v); setUserPage(1); }}
          placeholder="Filter by username or Discord ID..."
          inputClassName="w-full max-w-xs"
        />
      }
      loading={usersLoading}
      isEmpty={pagedUsers.length === 0}
      empty={<EmptyState icon={<FaUsers size={24} />} message="No users found" />}
      batchBar={
        <BatchPopup
          count={selUsers.size}
          onDelete={batchDeleteUsers}
          onClear={() => setSelUsers(new Set())}
        />
      }
      pagination={
        <Pagination
          page={userPage}
          total={filteredUsers.length}
          pageCount={userPageCount}
          onPrev={() => setUserPage((p) => p - 1)}
          onNext={() => setUserPage((p) => p + 1)}
        />
      }
    >
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
    </ListPanel>
  );
};
