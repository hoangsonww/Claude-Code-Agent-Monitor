/**
 * @file HTTP surface for Composer slash-command discovery. Reuses the
 * existing skills lib for the skills/plugins sources so we don't re-walk
 * ~/.claude/. Per-cwd discovery happens inline via slash-commands lib.
 */
const express = require("express");
const { buildCatalog } = require("../lib/slash-commands");

const router = express.Router();
const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";

router.use((req, res, next) => {
  if (!ENABLED) return res.status(404).json({ error: "orchestrator disabled" });
  next();
});

router.get("/", (req, res) => {
  const cwd = req.query?.cwd;
  if (!cwd || typeof cwd !== "string") return res.status(400).json({ error: "cwd required" });
  let skillsCatalog = { skills: [], plugins: [] };
  try {
    const skillsLib = require("../routes/skills");
    if (typeof skillsLib.getSkillsCatalog === "function") {
      skillsCatalog = skillsLib.getSkillsCatalog();
    }
  } catch {
    /* skills route unavailable — proceed with empty arrays */
  }
  res.json(buildCatalog({ cwd, skillsCatalog }));
});

module.exports = router;
