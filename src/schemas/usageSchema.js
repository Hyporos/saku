const { Schema, model, models } = require("mongoose");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Saku's daily model usage tally, one document per quota day: request counts and token totals per
// model. The API never reports what a day has cost, so it is counted here instead. Survives restarts;
// expires after 30 days.
const usageSchema = new Schema(
  {
    _id: {
      // Day as YYYY-MM-DD in Pacific time
      type: String,
      required: true,
    },
    requests: {
      // Per model request counts, keyed by model id
      type: Object,
      default: {},
    },
    tokens: {
      // Per model token totals, keyed by model id: { prompt, output, cached, written }. Requests
      // alone say nothing about the bill, since a request's cost is dominated by the system prompt,
      // how much of it came from cache, and how much the model chose to think.
      type: Object,
      default: {},
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false, minimize: false }
);

usageSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const name = "saku_usage";
module.exports = models[name] || model(name, usageSchema, name);
