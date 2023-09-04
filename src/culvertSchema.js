const { Schema, model, models } = require("mongoose");

const culvertSchema = new Schema(
  {
    _id: {
      // Discord user ID
      type: String,
      required: true,
    },
    characters: [{
      _id: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      class: {
        type: String,
        required: true,
      },
      level: {
        type: String,
        required: true,
      },
      rank: {
        type: String,
        required: true,
      },
      scores: [{
        date: {
          type: String,
          required: true,
        },
        score: {
          type: String,
          required: true,
        }
      }]
    }],
  },
  { versionKey: false }
);

const name = "culvert";
module.exports = models[name] || model(name, culvertSchema);
