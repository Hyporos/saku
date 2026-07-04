import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import Select from "../components/Select";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const PLAIN_OPTIONS = [
  { label: "All Classes", value: "all" },
  { label: "Shade", value: "shade" },
  { label: "Bowmaster", value: "bowmaster" },
  { label: "Dark Knight", value: "dk" },
  { label: "Blaze Wizard", value: "bw" },
];

const COLOR_OPTIONS = [
  { label: "All Colors", value: "all", color: "#888" },
  { label: "Crimson", value: "crimson", color: "#C87070" },
  { label: "Sky Blue", value: "sky", color: "#6EB3D8" },
  { label: "Gold", value: "gold", color: "#D4A35E" },
  { label: "Sage", value: "sage", color: "#7AB87A" },
];

const ICON_OPTIONS = [
  {
    label: "Kopptop",
    value: "kopptop",
    iconUrl: "https://maplestory.io/api/KMS/389/character/icon?name=Kopptop",
  },
  {
    label: "Lottie",
    value: "lottie",
    iconUrl: "https://maplestory.io/api/KMS/389/character/icon?name=Lottie",
  },
  {
    label: "Miso",
    value: "miso",
    iconUrl: "https://maplestory.io/api/KMS/389/character/icon?name=Miso",
  },
];

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const meta: Meta<typeof Select> = {
  title: "Atoms/Select",
  component: Select,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Single-select with animated panel. Like Dropdown but used for form fields rather than filters — triggers a bordered secondary-style button. Supports plain text, color-dot, and icon-avatar variants.",
      },
    },
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 220, display: "flex", alignItems: "flex-start" }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    variant: { control: "select", options: ["plain", "color", "icon"] },
    align: { control: "radio", options: ["left", "right"] },
    compact: { control: "boolean" },
    subtle: { control: "boolean" },
    placeholder: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Playground

/** Fully wired and interactive. Adjust props via Controls. */
export const Default: Story = {
  name: "Default (Playground)",
  render: (args) => {
    const [value, setValue] = useState("all");
    return <Select {...args} options={PLAIN_OPTIONS} value={value} onChange={setValue} />;
  },
  args: { variant: "plain", align: "left", compact: false, subtle: false },
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Functional variants

export const Plain: Story = {
  render: () => {
    const [value, setValue] = useState("shade");
    return <Select options={PLAIN_OPTIONS} value={value} onChange={setValue} />;
  },
};

/** Trigger text dims on the "All" default — useful for optional filter fields. */
export const PlainSubtle: Story = {
  name: "Plain — Subtle",
  render: () => {
    const [value, setValue] = useState("all");
    return <Select options={PLAIN_OPTIONS} value={value} onChange={setValue} subtle />;
  },
};

/** Each option shows a small color dot — used for graph series colors. */
export const ColorVariant: Story = {
  render: () => {
    const [value, setValue] = useState("crimson");
    return <Select options={COLOR_OPTIONS} value={value} onChange={setValue} variant="color" />;
  },
};

/** Each option shows a tiny avatar image — used for Discord character pickers. */
export const IconVariant: Story = {
  render: () => {
    const [value, setValue] = useState("kopptop");
    return <Select options={ICON_OPTIONS} value={value} onChange={setValue} variant="icon" />;
  },
};

/** Compact density — matches tight filter-bar layouts. */
export const Compact: Story = {
  render: () => {
    const [value, setValue] = useState("all");
    return <Select options={PLAIN_OPTIONS} value={value} onChange={setValue} compact subtle />;
  },
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Gallery

/** All variants and densities side by side. */
export const Gallery: Story = {
  name: "Gallery — All Variants",
  decorators: [
    (Story) => (
      <div style={{ minHeight: 280, display: "flex", alignItems: "flex-start" }}>
        <Story />
      </div>
    ),
  ],
  render: () => {
    const [p, setP] = useState("shade");
    const [ps, setPs] = useState("all");
    const [c, setC] = useState("crimson");
    const [pc, setPc] = useState("all");

    return (
      <div className="flex flex-wrap gap-4 items-start">
        {[
          { label: "Plain", node: <Select options={PLAIN_OPTIONS} value={p} onChange={setP} /> },
          { label: "Plain Subtle", node: <Select options={PLAIN_OPTIONS} value={ps} onChange={setPs} subtle /> },
          { label: "Color", node: <Select options={COLOR_OPTIONS} value={c} onChange={setC} variant="color" /> },
          { label: "Compact Subtle", node: <Select options={PLAIN_OPTIONS} value={pc} onChange={setPc} compact subtle /> },
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
