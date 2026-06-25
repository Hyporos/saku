import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pagination } from "../features/admin/components/Pagination";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const meta: Meta<typeof Pagination> = {
  title: "Atoms/Pagination",
  component: Pagination,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          'Footer pagination bar used in admin list tables. Shows current page / total and Prev + Next buttons. Prev is disabled on page 1; Next is disabled on the last page. Displays "No results" when `total` is 0.',
      },
    },
    layout: "fullscreen",
  },
  argTypes: {
    page: { control: { type: "number", min: 1 } },
    total: { control: { type: "number", min: 0 } },
    pageCount: { control: { type: "number", min: 0 } },
  },
};

export default meta;
type Story = StoryObj<typeof Pagination>;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Playground

/** Fully interactive — click Prev/Next or adjust Controls. */
export const Default: Story = {
  name: "Default (Playground)",
  render: (args) => {
    const [page, setPage] = useState(args.page ?? 3);
    const pageCount = args.pageCount ?? 10;
    return (
      <Pagination
        page={page}
        total={args.total ?? 97}
        pageCount={pageCount}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
      />
    );
  },
  args: { page: 3, total: 97, pageCount: 10 },
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Functional states

/** Prev is disabled — can't go before page 1. */
export const FirstPage: Story = {
  name: "First Page",
  args: { page: 1, total: 97, pageCount: 10, onPrev: () => {}, onNext: () => {} },
};

/** Both buttons enabled. */
export const MiddlePage: Story = {
  name: "Middle Page",
  args: { page: 5, total: 97, pageCount: 10, onPrev: () => {}, onNext: () => {} },
};

/** Next is disabled — already on the last page. */
export const LastPage: Story = {
  name: "Last Page",
  args: { page: 10, total: 97, pageCount: 10, onPrev: () => {}, onNext: () => {} },
};

/** Both buttons disabled and "No results" shown. */
export const NoResults: Story = {
  name: "No Results",
  args: { page: 1, total: 0, pageCount: 0, onPrev: () => {}, onNext: () => {} },
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Gallery

/** All four states stacked. */
export const Gallery: Story = {
  name: "Gallery — All States",
  render: () => (
    <div className="flex flex-col divide-y divide-tertiary/10">
      {[
        { label: "First page (Prev disabled)", page: 1 },
        { label: "Middle page",                page: 5 },
        { label: "Last page (Next disabled)",  page: 10 },
      ].map(({ label, page }) => (
        <div key={label}>
          <p className="text-xs text-tertiary/40 px-6 pt-3 pb-1">{label}</p>
          <Pagination
            page={page}
            total={97}
            pageCount={10}
            onPrev={() => {}}
            onNext={() => {}}
          />
        </div>
      ))}
      <div>
        <p className="text-xs text-tertiary/40 px-6 pt-3 pb-1">No results</p>
        <Pagination page={1} total={0} pageCount={0} onPrev={() => {}} onNext={() => {}} />
      </div>
    </div>
  ),
};
