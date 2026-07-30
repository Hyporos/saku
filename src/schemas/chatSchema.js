const { Schema, model, models } = require("mongoose");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Per-user /chat + @Saku conversation memory. One document per Discord user, holding a rolling
// window of recent turns. Expires 30 days after the last message (TTL on updatedAt).
const chatSchema = new Schema(
  {
    _id: {
      // Discord user ID
      type: String,
      required: true,
    },
    messages: [
      {
        _id: false,
        role: { type: String }, // "user" | "model"
        text: { type: String },
      },
    ],
    summary: {
      // Durable facts folded out of turns that aged past the rolling window
      type: String,
      default: "",
    },
    facts: {
      // Numbers that appeared in tool results on recent turns, so a follow-up repeating a figure
      // Saku already looked up isn't treated as invented. Tool results are never stored anywhere
      // else, and the model answers from conversation memory rather than re-running the lookup.
      // Tool-sourced ONLY: numbers out of Saku's own replies must never land here, or a single
      // fabrication would launder itself into permanent evidence.
      type: [String],
      default: [],
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

chatSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const name = "saku_chats";
module.exports = models[name] || model(name, chatSchema, name);
