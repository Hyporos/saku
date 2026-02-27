const { Schema, model, models } = require("mongoose");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const actionLogSchema = new Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    target: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    details: {
      type: String,
      default: null,
      maxlength: 800,
    },
    category: {
      type: String,
      enum: ["create", "edit", "delete", "transfer", "rename"],
      required: true,
    },
    actorId: {
      // Discord user ID of the admin who performed the action
      type: String,
      default: null,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

// Auto-delete entries older than 90 days
actionLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
actionLogSchema.index({ timestamp: -1 });
actionLogSchema.index({ category: 1, timestamp: -1 });

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const name = "actionLog";
module.exports = models[name] || model(name, actionLogSchema, name);
