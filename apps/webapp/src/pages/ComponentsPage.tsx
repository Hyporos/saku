import { useState } from "react";
import { FaPlus, FaTrash, FaDownload, FaShieldAlt, FaEdit, FaCheck, FaTimes, FaSun, FaMoon, FaFilter } from "react-icons/fa";
import { Button } from "../components/Button";
import Dropdown from "../components/Dropdown";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const VARIANTS = ["secondary", "primary", "danger", "owner", "tertiary", "success"] as const;
const SIZES    = ["sm", "md", "lg", "full"] as const;

const DROPDOWN_PLAIN = [
  { value: "all", label: "All Items" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "pending", label: "Pending" },
];

const DROPDOWN_COLOR = [
  { value: "all", label: "All Colors", color: undefined },
  { value: "pink",   label: "Pink",   color: "#FFC3C6" },
  { value: "green",  label: "Green",  color: "#669A68" },
  { value: "blue",   label: "Blue",   color: "#6EB3D8" },
  { value: "amber",  label: "Amber",  color: "#D4915E" },
];

const DROPDOWN_ICON = [
  { value: "all",    label: "All Users",    iconUrl: undefined },
  { value: "user_1", label: "Druu",         iconUrl: "https://cdn.discordapp.com/embed/avatars/0.png" },
  { value: "user_2", label: "Maple",        iconUrl: "https://cdn.discordapp.com/embed/avatars/1.png" },
  { value: "user_3", label: "Sakura",       iconUrl: "https://cdn.discordapp.com/embed/avatars/2.png" },
];

const ComponentsPage = () => {
  const [loading, setLoading] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [dstOn, setDstOn] = useState(false);
  const [dropPlain, setDropPlain] = useState("all");
  const [dropColor, setDropColor] = useState("all");
  const [dropIcon, setDropIcon] = useState("all");
  const [dropSubtle, setDropSubtle] = useState("all");
  const [dropCompact, setDropCompact] = useState("all");

  const simulateLoad = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-12">

      {/* ⎯ Button ⎯ */}
      <section>
        <h2 className="text-xl mb-6">Button</h2>

        {/* Variant × Size grid */}
        {VARIANTS.map((variant) => (
          <div key={variant} className="mb-8">
            <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">{variant}</p>

            <div className="flex flex-wrap items-center gap-3 mb-3">
              {SIZES.filter((s) => s !== "full").map((size) => (
                <Button key={size} variant={variant} size={size}>
                  {size}
                </Button>
              ))}
            </div>

            {/* full-width separately */}
            <Button variant={variant} size="full">
              full
            </Button>
          </div>
        ))}

        {/* Mobile (icon-only) */}
        <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">Mobile (icon-only)</p>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Button variant="secondary" size="mobile"><FaEdit size={12} /></Button>
          <Button variant="primary"   size="mobile"><FaPlus size={12} /></Button>
          <Button variant="danger"    size="mobile"><FaTrash size={12} /></Button>
          <Button variant="owner"     size="mobile"><FaShieldAlt size={12} /></Button>
          <Button variant="tertiary"  size="mobile"><FaDownload size={12} /></Button>
          <Button variant="success"   size="mobile"><FaCheck size={12} /></Button>
        </div>

        {/* With icon */}
        <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">With icon</p>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Button variant="primary"   size="md" icon={<FaPlus size={11} />}>Create</Button>
          <Button variant="secondary" size="md" icon={<FaDownload size={11} />}>Download</Button>
          <Button variant="danger"    size="md" icon={<FaTrash size={11} />}>Delete</Button>
          <Button variant="owner"     size="md" icon={<FaShieldAlt size={11} />}>Owner Action</Button>
          <Button variant="tertiary"  size="md" icon={<FaEdit size={11} />}>Edit</Button>
          <Button variant="success"   size="md" icon={<FaDownload size={11} />}>Finalize</Button>
        </div>

        {/* Loading */}
        <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">Loading</p>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Button variant="primary"   size="md" loading>Saving…</Button>
          <Button variant="secondary" size="md" loading>Loading</Button>
          <Button variant="danger"    size="md" loading>Deleting</Button>
          <Button variant="success"   size="md" loading>Finalizing…</Button>
          <Button variant="primary"   size="md" loading={loading} onClick={simulateLoad}>
            {loading ? "Saving…" : "Click to load"}
          </Button>
        </div>

        {/* Disabled */}
        <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">Disabled</p>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Button variant="secondary" size="md" disabled>Secondary</Button>
          <Button variant="primary"   size="md" disabled>Primary</Button>
          <Button variant="danger"    size="md" disabled>Danger</Button>
          <Button variant="owner"     size="md" disabled>Owner</Button>
          <Button variant="tertiary"  size="md" disabled>Tertiary</Button>
          <Button variant="success"   size="md" disabled>Success</Button>
        </div>

        {/* Inline (icon-only, no border/bg) */}
        <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">Inline (no border / bg)</p>
        <div className="flex items-center gap-4 mb-6">
          <Button variant="inline" className="text-[#669A68] hover:text-white"><FaCheck size={14} /></Button>
          <Button variant="inline" className="text-[#A46666] hover:text-white"><FaTimes size={14} /></Button>
          <Button variant="inline" className="text-tertiary/40 hover:text-accent"><FaEdit size={14} /></Button>
          <Button variant="inline" className="text-[#A46666]/40 hover:text-[#A46666]"><FaTrash size={14} /></Button>
          <Button variant="inline" className="text-tertiary/40 hover:text-white"><FaFilter size={14} /></Button>
        </div>

        {/* Toggle / pressed */}
        <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">Toggle (pressed state)</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="mobile"
            pressed={pressed}
            onClick={() => setPressed((p) => !p)}
            className={pressed ? "border-accent/40 text-white" : ""}
          >
            {pressed ? <FaCheck size={12} /> : <FaEdit size={12} />}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            pressed={dstOn}
            onClick={() => setDstOn((d) => !d)}
            className={dstOn ? "border-amber-700/50 text-[#D4915E]" : "border-sky-700/50 text-[#6EB3D8]"}
          >
            {dstOn ? <FaSun size={11} className="mb-px" /> : <FaMoon size={11} className="mb-px" />}
            {dstOn ? "Disable DST" : "Enable DST"}
          </Button>
        </div>
      </section>

      {/* ⎯ Dropdown ⎯ */}
      <section>
        <h2 className="text-xl mb-6">Dropdown</h2>

        {/* Plain */}
        <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">Plain</p>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Dropdown options={DROPDOWN_PLAIN} value={dropPlain} onChange={setDropPlain} />
        </div>

        {/* Color variant */}
        <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">Color dots</p>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Dropdown variant="color" options={DROPDOWN_COLOR} value={dropColor} onChange={setDropColor} />
        </div>

        {/* Icon variant */}
        <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">Icon (avatar)</p>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Dropdown variant="icon" options={DROPDOWN_ICON} value={dropIcon} onChange={setDropIcon} />
        </div>

        {/* Subtle */}
        <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">Subtle (quiet when default)</p>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Dropdown options={DROPDOWN_PLAIN} value={dropSubtle} onChange={setDropSubtle} subtle />
        </div>

        {/* Compact */}
        <p className="text-xs text-tertiary/50 uppercase tracking-wider mb-3">Compact</p>
        <div className="flex flex-wrap items-center gap-3">
          <Dropdown options={DROPDOWN_PLAIN} value={dropCompact} onChange={setDropCompact} compact />
          <Dropdown options={DROPDOWN_PLAIN} value={dropCompact} onChange={setDropCompact} compact subtle />
          <Dropdown variant="icon" options={DROPDOWN_ICON} value={dropIcon} onChange={setDropIcon} compact />
        </div>
      </section>

    </div>
  );
};

export default ComponentsPage;
