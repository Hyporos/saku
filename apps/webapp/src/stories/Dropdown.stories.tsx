import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import Dropdown from "../components/Dropdown";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const PLAIN_OPTIONS = [
  { label: "All Members", value: "all" },
  { label: "Shade", value: "shade" },
  { label: "Bowmaster", value: "bowmaster" },
  { label: "Dark Knight", value: "dk" },
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

const meta: Meta<typeof Dropdown> = {
  title: "Atoms/Dropdown",
  component: Dropdown,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Single-select dropdown with animated panel. Supports plain text, color-dot, and icon-avatar variants. The `subtle` flag dims the trigger text when the default option is selected.",
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
type Story = StoryObj<typeof Dropdown>;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Playground

/** Fully wired and interactive. Adjust props via Controls. */
export const Default: Story = {
  name: "Default (Playground)",
  render: (args) => {
    const [value, setValue] = useState("all");
    return <Dropdown {...args} options={PLAIN_OPTIONS} value={value} onChange={setValue} />;
  },
  args: { variant: "plain", align: "left", compact: false, subtle: false },
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Functional variants

export const Plain: Story = {
  render: () => {
    const [value, setValue] = useState("all");
    return <Dropdown options={PLAIN_OPTIONS} value={value} onChange={setValue} />;
  },
};

/** The first option acts as "All" — trigger text dims until a real selection is made. */
export const PlainSubtle: Story = {
  name: "Plain — Subtle Filter",
  render: () => {
    const [value, setValue] = useState("all");
    return <Dropdown options={PLAIN_OPTIONS} value={value} onChange={setValue} subtle />;
  },
};

/** Each option shows a colored dot. Used for graph color pickers. */
export const ColorVariant: Story = {
  name: "Color Variant",
  render: () => {
    const [value, setValue] = useState("crimson");
    return <Dropdown options={COLOR_OPTIONS} value={value} onChange={setValue} variant="color" />;
  },
};

/** Each option shows a small character icon. Used for actor/character filters. */
export const IconVariant: Story = {
  name: "Icon Variant",
  render: () => {
    const [value, setValue] = useState("kopptop");
    return <Dropdown options={ICON_OPTIONS} value={value} onChange={setValue} variant="icon" />;
  },
};

/** Reduced trigger height — matches compact DatePicker / filter-bar density. */
export const Compact: Story = {
  render: () => {
    const [value, setValue] = useState("all");
    return (
      <Dropdown options={PLAIN_OPTIONS} value={value} onChange={setValue} compact subtle />
    );
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
    const [p, setP] = useState("all");
    const [ps, setPs] = useState("all");
    const [c, setC] = useState("crimson");
    const [pc, setPc] = useState("all");

    return (
      <div className="flex flex-wrap gap-4 items-start text-xs">
        {[
          { label: "Plain", node: <Dropdown options={PLAIN_OPTIONS} value={p} onChange={setP} /> },
          { label: "Plain Subtle", node: <Dropdown options={PLAIN_OPTIONS} value={ps} onChange={setPs} subtle /> },
          { label: "Color", node: <Dropdown options={COLOR_OPTIONS} value={c} onChange={setC} variant="color" /> },
          { label: "Compact Subtle", node: <Dropdown options={PLAIN_OPTIONS} value={pc} onChange={setPc} compact subtle /> },
        ].map(({ label, node }) => (
          <div key={label} className="flex flex-col gap-2 items-start">
            <span className="text-tertiary/50">{label}</span>
            {node}
          </div>
        ))}
      </div>
    );
  },
};
