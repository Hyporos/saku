const { Schema, model, models } = require("mongoose");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// The guild list truncates with dots that OCR sometimes keeps and sometimes drops, so "Beezle.." and
// "beezle" have to be the same key. Older records were stored as typed; lookups key both sides.
const toKey = (value) => String(value ?? "").replace(/\s+/g, "").toLowerCase().replace(/\.+$/, "");

const exceptionSchema = new Schema(
  {
    // The linked character this resolves to.
    name: {
      type: String,
      required: true,
    },
    // misread: an OCR misread of a name or cell. main: an account group's representative, the name
    // in brackets, pointing at the linked character of the person it belongs to.
    exception: {
      type: String,
      required: true,
      set: toKey,
    },
    kind: {
      type: String,
      enum: ["misread", "main"],
      default: "misread",
    },
    source: {
      type: String,
      enum: ["auto", "manual"],
    },
    discordId: {
      type: String,
    },
    updatedAt: {
      type: Date,
    },
  },
  { versionKey: false }
);

exceptionSchema.statics.toKey = toKey;

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const name = "exceptions";
module.exports = models[name] || model(name, exceptionSchema, name);
