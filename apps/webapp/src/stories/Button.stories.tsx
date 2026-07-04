import type { Meta, StoryObj } from "@storybook/react-vite";
import { FaPlus, FaTrash, FaSyncAlt, FaCheck, FaStar, FaEye } from "react-icons/fa";
import { Button } from "../components/Button";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const meta: Meta<typeof Button> = {
  title: "Atoms/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "General-purpose button. Variants: `secondary` (default) | `primary` | `danger` | `owner` | `tertiary` (ghost) | `success` | `inline` (no chrome). Sizes: `sm` | `md` (default) | `lg` | `full` | `mobile` (icon-only square). Pass icons via the `icon` prop — the Button wraps them with proper baseline alignment. Disabled state suppresses all hover and click interactions.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["secondary", "primary", "danger", "owner", "tertiary", "success", "inline"],
      description: "Visual style",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "full", "mobile"],
      description: "Height / padding preset. `mobile` = small icon-only square.",
    },
    loading: { control: "boolean", description: "Spinner overlay; disables interaction" },
    disabled: { control: "boolean", description: "Dims button and suppresses all hover/click" },
    pressed: { control: "boolean", description: "aria-pressed toggle (for toggle buttons)" },
    children: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Playground — all props wired to the Controls panel

/** Fully interactive — use the Controls panel to explore every prop combination. */
export const Default: Story = {
  name: "Default (Playground)",
  args: {
    variant: "secondary",
    size: "md",
    children: "Button",
    loading: false,
    disabled: false,
    pressed: false,
  },
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Functional variants — one story per primary category

/** Default chrome. No background fill. Used for most non-destructive actions. */
export const Secondary: Story = {
  args: { variant: "secondary", children: "Edit Settings" },
};

/** Accent-pink fill. Reserved for the primary CTA in a view. */
export const Primary: Story = {
  args: { variant: "primary", children: "Save Changes", icon: <FaCheck size={10} /> },
};

/** Destructive actions. Hover darkens rather than lightening — stays in red family. */
export const Danger: Story = {
  args: { variant: "danger", children: "Delete", icon: <FaTrash size={10} /> },
};

/** Lavender palette. Owner-only controls (e.g. Clear Log, admin-only actions). */
export const Owner: Story = {
  args: { variant: "owner", children: "Clear Log" },
};

/** Ghost / no border. De-emphasis. Used for Cancel, disabled Prev/Next, etc. */
export const Ghost: Story = {
  name: "Tertiary (Ghost)",
  args: { variant: "tertiary", children: "Cancel" },
};

/** Green palette. Confirmation or positive outcome actions. */
export const Success: Story = {
  args: { variant: "success", children: "Confirm", icon: <FaStar size={10} /> },
};

/**
 * No chrome — no bg, border, or padding. For in-context linked actions.
 * Color must be supplied via `className`. Grows slightly on active press.
 */
export const Inline: Story = {
  args: {
    variant: "inline",
    children: "View details",
    className: "text-accent text-sm",
  },
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //
// Gallery — visual audit of all variants × states in one place

type BtnRow = { label: string; variant: "secondary" | "primary" | "danger" | "owner" | "tertiary" | "success" };

const ROWS: BtnRow[] = [
  { label: "Secondary", variant: "secondary" },
  { label: "Primary",   variant: "primary"   },
  { label: "Danger",    variant: "danger"     },
  { label: "Owner",     variant: "owner"      },
  { label: "Ghost",     variant: "tertiary"   },
  { label: "Success",   variant: "success"    },
];

/**
 * All variants × all interaction states in a single grid.
 * Use this for visual regression testing — a border-radius change will show here immediately.
 */
export const Gallery: Story = {
  name: "Gallery — All Variants × States",
  render: () => (
    <div className="w-full overflow-x-auto space-y-8">

      {/* Variants × States table */}
      <div>
        <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">Variants × States</p>
        <table className="border-separate border-spacing-x-2 border-spacing-y-1.5 text-sm">
          <thead>
            <tr>
              {["", "Normal", "With Icon", "Loading", "Disabled", "Mobile"].map((h) => (
                <th key={h} className="text-left text-xs text-tertiary/40 font-normal uppercase tracking-wider pb-2 px-1 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ label, variant }) => (
              <tr key={variant}>
                <td className="text-xs text-tertiary/50 pr-3 whitespace-nowrap">{label}</td>
                <td><Button variant={variant} size="sm">{label}</Button></td>
                <td><Button variant={variant} size="sm" icon={<FaPlus size={9} />}>{label}</Button></td>
                <td><Button variant={variant} size="sm" loading>Loading</Button></td>
                <td><Button variant={variant} size="sm" disabled>{label}</Button></td>
                <td><Button variant={variant} size="mobile"><FaEye size={11} /></Button></td>
              </tr>
            ))}
            <tr>
              <td className="text-xs text-tertiary/50 pr-3">Inline</td>
              <td colSpan={2}>
                <Button variant="inline" className="text-accent text-sm">Inline link</Button>
              </td>
              <td />
              <td><Button variant="inline" className="text-sm text-tertiary/30" disabled>Disabled</Button></td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sizes */}
      <div>
        <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">Sizes — Secondary</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm">Small</Button>
          <Button variant="secondary" size="md">Medium</Button>
          <Button variant="secondary" size="lg">Large</Button>
          <Button variant="secondary" size="mobile"><FaSyncAlt size={11} /></Button>
        </div>
        <div className="w-48 mt-2">
          <Button variant="secondary" size="full" icon={<FaSyncAlt size={11} />}>Full Width</Button>
        </div>
      </div>

    </div>
  ),
};
