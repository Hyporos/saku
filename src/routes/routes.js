const culvertSchema = require("../culvertSchema.js");
const express = require("express");

const router = express.Router();

//Post Method
router.post("/post", (req, res) => {
  res.send("Post API");
});

//Get all Method
router.get("/getAll", async (req, res) => {
  try {
    const culverts = await culvertSchema.find();
    res.json(culverts);
  } catch (error) {
    console.error("Error fetching culverts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Find the character with the given name
router.get("/character/:name", async (req, res) => {
  try {
    const user = await culvertSchema.findOne(
      {
        "characters.name": { $regex: `^${req.params.name}$`, $options: "i" },
      },
      { "characters.$": 1 }
    );
    res.json(user.characters[0]);
  } catch (error) {
    console.error("Error fetching culverts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Update by ID Method
router.patch("/update/:id", (req, res) => {
  res.send("Update by ID API");
});

//Delete by ID Method
router.delete("/delete/:id", (req, res) => {
  res.send("Delete by ID API");
});

module.exports = router;
