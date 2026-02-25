import express from "express";
import axios from "axios";

const PORT = 8000;
const app = express();

app.listen(PORT, () => {
  console.log(`App started on port ${PORT}`);
});
