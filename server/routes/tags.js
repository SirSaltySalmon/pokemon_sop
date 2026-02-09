const express = require('express');
const router = express.Router();
const supabase = require('../database');

// GET /api/tags - Get all unique tags
router.get('/tags', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tags')
            .select('name')
            .order('name', { ascending: true });

        if (error) throw error;
        res.json(data ? data.map(row => row.name) : []);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

module.exports = router;
