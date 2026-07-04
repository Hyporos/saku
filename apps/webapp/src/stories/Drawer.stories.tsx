import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import Drawer from "../components/Drawer";
import { Button } from "../components/Button";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const meta: Meta<typeof Drawer> = {
  title: "Components/Drawer",
  component: Drawer,
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Drawer>;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const DrawerDemo = ({ title, subtitle }: { title: string; subtitle?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-8">
      <Button variant="primary" onClick={() => setOpen(true)}>Open Drawer</Button>
      <Drawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle={subtitle}
        footer={
          <>
            <Button variant="primary" onClick={() => setOpen(false)} className="flex-1 h-auto py-2.5">
              Save Changes
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1 h-auto py-2.5">
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-tertiary text-sm">Drawer body content goes here.</p>
      </Drawer>
    </div>
  );
};

export const WithFooter: Story = {
  render: () => <DrawerDemo title="New Character" subtitle="Add a new record to the characters collection" />,
};

export const NoFooter: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div className="p-8">
        <Button variant="primary" onClick={() => setOpen(true)}>Open Drawer</Button>
        <Drawer isOpen={open} onClose={() => setOpen(false)} title="Details" subtitle="No footer variant">
          <p className="text-tertiary text-sm">This drawer has no footer actions.</p>
        </Drawer>
      </div>
    );
  },
};
