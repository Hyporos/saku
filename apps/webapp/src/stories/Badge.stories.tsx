import type { Meta, StoryObj } from "@storybook/react-vite";
import Badge from "../components/Badge";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["green", "red", "primary"],
      description: "Color variant — green (success/create), red (danger/delete), primary (accent/action)",
    },
    children: {
      control: "text",
      description: "Badge label text",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const Green: Story = {
  args: { variant: "green", children: "Create" },
};

export const Red: Story = {
  args: { variant: "red", children: "Delete" },
};

export const Primary: Story = {
  args: { variant: "primary", children: "Edit" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="green">Create</Badge>
      <Badge variant="green">Finalize</Badge>
      <Badge variant="green">Scan</Badge>
      <Badge variant="red">Delete</Badge>
      <Badge variant="primary">Edit</Badge>
      <Badge variant="primary">Transfer</Badge>
      <Badge variant="primary">Rename</Badge>
    </div>
  ),
};
