/**
 * @file Express router for event endpoints, allowing retrieval of events with optional pagination and filtering by session ID. It queries the database for events and returns them in a structured JSON format for frontend consumption.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { stmts } = require("../db");

const router = Router();

router.get("/", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const session_id = req.query.session_id;

  const rows = session_id
    ? stmts.listEventsBySession.all(session_id)
    : stmts.listEvents.all(limit, offset);

  res.json({ events: rows, limit, offset });
});

module.exports = router;
