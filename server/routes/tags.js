const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/tags - Get all unique tags
router.get('/tags', (req, res) => {
    db.all(
        'SELECT DISTINCT name FROM tags',
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json(rows.map(row => row.name));
        }
    );
});

module.exports = router;