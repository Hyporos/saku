import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import Checkbox from "../components/Checkbox";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const meta: Meta<typeof Checkbox> = {
  title: "Atoms/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Three-state checkbox: unchecked, checked, and indeterminate (dash — used when only some rows in a table are selected). Stops click propagation so it can be nested inside rows.",
      },
    },
  },
  argTypes: {
    checked: { control: "boolean" },
    indeterminate: { control: "boolean", description: "Renders a dash — for partial 'select all'" },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Playground

/** Toggle any state via Controls. */
export const Default: Story = {
  name: "Default (Playground)",
  args: { checked: false, indeterminate: false, onChange: () => {} },
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Functional states

export const Unchecked: Story = {
  args: { checked: false, onChange: () => {} },
};

export const Checked: Story = {
  args: { checked: true, onChange: () => {} },
};

/** Shown on the "select all" header row when only some rows are checked. */
export const Indeterminate: Story = {
  args: { checked: false, indeterminate: true, onChange: () => {} },
};

/** Fully wired — click to toggle between states. */
export const Interactive: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    return (
      <div className="flex items-center gap-3 text-sm text-tertiary">
        <Checkbox checked={checked} onChange={() => setChecked((v) => !v)} />
        <span>{checked ? "Checked" : "Unchecked"} — click to toggle</span>
      </div>
    );
  },
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Gallery

/** All three visual states side by side. */
export const Gallery: Story = {
  name: "Gallery — All States",
  render: () => (
    <div className="flex items-center gap-8 text-xs text-tertiary/60">
      {[
        { label: "Unchecked", checked: false },
        { label: "Checked",   checked: true  },
        { label: "Indeterminate", checked: false, indeterminate: true },
      ].map(({ label, ...props }) => (
        <div key={label} className="flex flex-col items-center gap-2">
          <Checkbox {...props} onChange={() => {}} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  ),
};
