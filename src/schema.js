const { Schema, model, models } = require("mongoose");

const schema = new Schema(
  {
    _id: {
      // Discord user ID
      type: String,
      required: true,
    },
    character: {
      type: String,
      required: true,
    },
  },
  { versionKey: false }
);

const link = "culvert";
module.exports = models[link] || model(link, schema);
