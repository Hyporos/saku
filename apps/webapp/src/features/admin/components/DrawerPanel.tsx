import { cn } from "../../../lib/utils";
import { FaTimes } from "react-icons/fa";
import DatePicker from "../../../components/DatePicker";
import AutocompleteInput from "../../../components/AutocompleteInput";
import { Field } from "./Field";
import { useAdminContext } from "../context";
import { rgbCss } from "../utils";
import { GRAPH_COLORS, inputCls } from "../constants";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const DrawerFields = () => {
  const { drawer, updateField, liveCharacters, liveScores } = useAdminContext();
  const { section, mode, data } = drawer;
  const isCreate = mode === "create";

  switch (section) {
    case "users":
      return (
        <>
          {isCreate ? (
            <Field label="Discord ID">
              <input
                className={inputCls}
                value={data.id ?? ""}
                onChange={(e) => updateField("id", e.target.value)}
                placeholder="e.g. 631337640754675725"
              />
            </Field>
          ) : (
            <div className="flex flex-col gap-0.5 pb-1">
              <p className="text-white font-medium">{data.username ?? "Unknown User"}</p>
              <p className="text-tertiary/50 text-xs font-mono">{data.id}</p>
            </div>
          )}
          <Field label="Graph Colour">
            <div className="flex items-center gap-3">
              <span
                className="rounded-full w-7 h-7 flex-shrink-0 border border-white/10"
                style={{ backgroundColor: rgbCss(data.graphColor ?? "255,189,213") }}
              />
              <select
                className={inputCls}
                value={data.graphColor ?? ""}
                onChange={(e) => updateField("graphColor", e.target.value)}
              >
                {GRAPH_COLORS.map(({ name, value }) => (
                  <option key={value} value={value}>{name}</option>
                ))}
              </select>
            </div>
          </Field>
        </>
      );

    case "characters":
      return (
        <>
          <Field label="Name" hint="Character names are case-sensitive.">
            <input
              className={inputCls}
              value={data.name ?? ""}
              onChange={(e) => updateField("name", e.target.value)}
              disabled={!isCreate}
            />
          </Field>
          <Field label="Member Since">
            <DatePicker
              value={data.memberSince ?? ""}
              onChange={(v) => updateField("memberSince", v)}
            />
          </Field>
          <Field
            label="Avatar URL"
            hint="Auto-fetched from MapleStory rankings. Only update if auto-fetch fails."
          >
            <input
              className={inputCls}
              value={data.avatar ?? ""}
              onChange={(e) => updateField("avatar", e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <Field label="Owner (Discord ID)">
            <input
              className={inputCls}
              value={data.userId ?? ""}
              onChange={(e) => updateField("userId", e.target.value)}
              disabled={!isCreate}
              placeholder="e.g. 631337640754675725"
            />
          </Field>
        </>
      );

    case "scores":
      return (
        <>
          <Field label="Character">
            {isCreate && !data._fromCharDetail ? (
              <AutocompleteInput
                value={data.character ?? ""}
                onChange={(v) => updateField("character", v)}
                suggestions={liveCharacters.map((c) => c.name)}
                placeholder="e.g. Dánnis"
                inputClassName={inputCls}
              />
            ) : (
              <input
                className={cn(inputCls, "text-tertiary/60")}
                value={data.character ?? ""}
                disabled
                readOnly
              />
            )}
          </Field>
          <Field label="Date">
            <DatePicker
              mode="single"
              value={data.date ?? ""}
              onChange={(v) => updateField("date", v)}
              wednesdayOnly
              disabledDates={
                liveScores
                  .filter((s) =>
                    s.character === (data.character ?? "") &&
                    (!isCreate ? s.date !== data.date : true)
                  )
                  .map((s) => s.date)
              }
              placeholder="Select Date"
              align="right"
              subtle
            />
          </Field>
          {isCreate &&
            data.character &&
            data.date &&
            liveScores.some(
              (s) => s.character === data.character && s.date === data.date
            ) && (
              <p className="text-[#A46666] text-xs px-0.5 -mt-1">
                A score for this character on this date already exists.
              </p>
            )}
          <Field label="Score">
            <input
              type="number"
              className={`${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              value={data.score ?? ""}
              onChange={(e) => updateField("score", e.target.value)}
              placeholder="0"
              min={0}
            />
          </Field>
        </>
      );

    case "exceptions":
      return (
        <>
          <Field label="Character Name" hint="The real (correct) character name.">
            <AutocompleteInput
              value={data.name ?? ""}
              onChange={(v) => updateField("name", v)}
              suggestions={liveCharacters.map((c) => c.name)}
              placeholder="e.g. Dánnis"
              inputClassName={inputCls}
            />
          </Field>
          <Field
            label="Exception"
            hint="The incorrect name that the scanner picked up."
          >
            <input
              className={inputCls}
              value={data.exception ?? ""}
              onChange={(e) => updateField("exception", e.target.value)}
              placeholder="e.g. Danniz"
            />
          </Field>
        </>
      );
  }
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

export const DrawerPanel = () => {
  const { drawer, closeDrawer, handleSave, liveScores } = useAdminContext();

  const { section, mode, data } = drawer;

  const submitDisabled =
    mode === "create" && (
      section === "scores"
        ? !data.character || !data.date || data.score === "" || data.score === undefined || data.score === null || liveScores.some((s) => s.character === data.character && s.date === data.date)
        : section === "exceptions"
        ? !data.name || !data.exception
        : false
    );

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-background/60 backdrop-blur-sm z-40 transition-opacity duration-300",
          drawer.isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closeDrawer}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-[420px] bg-panel border-l border-tertiary/[8%] z-50 overflow-y-auto flex flex-col transition-transform duration-300",
          drawer.isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-tertiary/[8%]">
          <div>
            <h2 className="text-xl capitalize">
              {mode === "create" ? "New" : "Edit"} {section.slice(0, -1)}
            </h2>
            <p className="text-tertiary text-sm mt-0.5">
              {mode === "create"
                ? section === "scores"
                  ? "Add a new score to the database"
                  : section === "exceptions"
                  ? "Add a new exception to the database"
                  : `Add a new record to the ${section} collection`
                : `Modify this record in the ${section} collection`}
            </p>
          </div>
          <button
            onClick={closeDrawer}
            className="text-tertiary hover:text-white transition-colors"
          >
            <FaTimes size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-5 px-8 py-6 flex-1">
          <DrawerFields />
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-8 py-6 border-t border-tertiary/[8%]">
          <button
            onClick={handleSave}
            disabled={submitDisabled}
            className={cn(
              "flex-1 rounded-lg py-2.5 text-sm transition-colors",
              submitDisabled
                ? "bg-tertiary/10 text-tertiary/40 cursor-not-allowed"
                : "bg-accent/15 hover:bg-accent/20 text-accent"
            )}
          >
            {mode === "create" ? "Create" : "Save Changes"}
          </button>
          <button
            onClick={closeDrawer}
            className="flex-1 bg-background hover:bg-background/60 text-tertiary rounded-lg py-2.5 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};
