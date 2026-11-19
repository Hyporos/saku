const { Schema, model, models } = require("mongoose");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const culvertSchema = new Schema(
  {
    _id: {
      // Discord user ID
      type: String,
      required: true,
    },
    characters: [
      {
        _id: false,
        name: {
          type: String,
          required: true,
        },
        memberSince: {
          type: String,
          required: true,
        },
        graphColor: {
          type: String,
          required: true,
        },
        scores: [
          {
            date: {
              type: String,
              required: true,
            },
            score: {
              type: Number,
              required: true,
            },
          },
        ],
      },
    ],
    // The account group a member declared with /character group: the bracketed representative, the
    // other characters in it, and the linked character its culvert scores go to. A scan row naming any
    // of these resolves to scoresTo, ahead of learned and misread mappings.
    group: {
      type: new Schema(
        {
          main: { type: String, required: true },
          characters: { type: [String], default: [] },
          scoresTo: { type: String, required: true },
          updatedAt: { type: Date },
        },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { versionKey: false }
);

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const name = "culvert";
module.exports = models[name] || model(name, culvertSchema, name);
