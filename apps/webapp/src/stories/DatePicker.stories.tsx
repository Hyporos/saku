import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import DatePicker from "../components/DatePicker";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// DatePicker uses a discriminated union (single vs range) so Meta is typed loosely.

const meta: Meta = {
  title: "Atoms/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Calendar date picker that supports single-date and date-range modes. The trigger uses accent-pink styling by default; `subtle` switches to muted gray for low-emphasis filter fields. `wednesdayOnly` restricts selection to Wednesdays (culvert score dates). Placement auto-adjusts via `dropUp` / `align`.",
      },
    },
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 360, display: "flex", alignItems: "flex-start" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Playground

/** Fully wired single-date picker. Click the trigger to open the calendar. */
export const Default: Story = {
  name: "Default (Playground)",
  render: () => {
    const [value, setValue] = useState("");
    return <DatePicker value={value} onChange={setValue} placeholder="Pick a date" />;
  },
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Single mode

/** Default accent-pink trigger with an empty value. */
export const SingleEmpty: Story = {
  name: "Single — Empty",
  render: () => {
    const [value, setValue] = useState("");
    return <DatePicker value={value} onChange={setValue} placeholder="Pick a date" />;
  },
};

/** Pre-filled with a date. */
export const SingleWithValue: Story = {
  name: "Single — With Value",
  render: () => {
    const [value, setValue] = useState("2025-04-16");
    return <DatePicker value={value} onChange={setValue} />;
  },
};

/** Only Wednesdays are selectable — matches culvert score submission dates. */
export const SingleWednesdayOnly: Story = {
  name: "Single — Wednesday Only",
  render: () => {
    const [value, setValue] = useState("");
    return (
      <DatePicker
        value={value}
        onChange={setValue}
        placeholder="Culvert date"
        wednesdayOnly
      />
    );
  },
};

/** Shows a clear × inside the trigger — for optional filter inputs. */
export const SingleClearable: Story = {
  name: "Single — Clearable",
  render: () => {
    const [value, setValue] = useState("2025-04-16");
    return <DatePicker value={value} onChange={setValue} clearable />;
  },
};

/** Muted gray trigger — for low-emphasis filter fields. */
export const SingleSubtle: Story = {
  name: "Single — Subtle",
  render: () => {
    const [value, setValue] = useState("");
    return (
      <DatePicker
        value={value}
        onChange={setValue}
        placeholder="Filter by date"
        subtle
        clearable
      />
    );
  },
};

/** Compact height to match filter-bar density. */
export const SingleCompact: Story = {
  name: "Single — Compact",
  render: () => {
    const [value, setValue] = useState("");
    return (
      <DatePicker
        value={value}
        onChange={setValue}
        placeholder="Date"
        compact
        subtle
      />
    );
  },
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Range mode

/** Range picker with no initial selection. */
export const RangeEmpty: Story = {
  name: "Range — Empty",
  render: () => {
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    return (
      <DatePicker
        mode="range"
        from={from}
        to={to}
        onRangeChange={(f, t) => { setFrom(f); setTo(t); }}
        placeholder="Date range"
      />
    );
  },
};

/** Range picker with pre-filled from/to. */
export const RangeWithValue: Story = {
  name: "Range — With Value",
  render: () => {
    const [from, setFrom] = useState("2025-03-05");
    const [to, setTo] = useState("2025-04-09");
    return (
      <DatePicker
        mode="range"
        from={from}
        to={to}
        onRangeChange={(f, t) => { setFrom(f); setTo(t); }}
      />
    );
  },
};

/** Range picker with a clear button — used in character score history filter. */
export const RangeClearable: Story = {
  name: "Range — Clearable",
  render: () => {
    const [from, setFrom] = useState("2025-03-05");
    const [to, setTo] = useState("2025-04-09");
    return (
      <DatePicker
        mode="range"
        from={from}
        to={to}
        onRangeChange={(f, t) => { setFrom(f); setTo(t); }}
        clearable
        subtle
        compact
        wednesdayOnly
        placeholder="Date range"
      />
    );
  },
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Gallery

/** Single vs range modes side by side. */
export const Gallery: Story = {
  name: "Gallery — Single vs Range",
  decorators: [
    (Story) => (
      <div style={{ minHeight: 400, display: "flex", alignItems: "flex-start" }}>
        <Story />
      </div>
    ),
  ],
  render: () => {
    const [single, setSingle] = useState("2025-04-16");
    const [from, setFrom] = useState("2025-03-05");
    const [to, setTo] = useState("2025-04-09");
    const [subtle, setSubtle] = useState("");

    return (
      <div className="flex flex-wrap gap-6 items-start">
        {[
          {
            label: "Single",
            node: <DatePicker value={single} onChange={setSingle} />,
          },
          {
            label: "Single — Clearable Subtle Compact",
            node: (
              <DatePicker
                value={subtle}
                onChange={setSubtle}
                placeholder="Filter by date"
                subtle
                compact
                clearable
              />
            ),
          },
          {
            label: "Range",
            node: (
              <DatePicker
                mode="range"
                from={from}
                to={to}
                onRangeChange={(f, t) => { setFrom(f); setTo(t); }}
              />
            ),
          },
          {
            label: "Range — Wednesday Only",
            node: (
              <DatePicker
                mode="range"
                from={from}
                to={to}
                onRangeChange={(f, t) => { setFrom(f); setTo(t); }}
                wednesdayOnly
                clearable
                subtle
                compact
                placeholder="Date range"
              />
            ),
          },
        ].map(({ label, node }) => (
          <div key={label} className="flex flex-col gap-2 items-start">
            <span className="text-xs text-tertiary/50">{label}</span>
            {node}
          </div>
        ))}
      </div>
    );
  },
};
