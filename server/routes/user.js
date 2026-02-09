const express = require('express');
const router = express.Router();
const supabase = require('../database');

// GET /api/user/:sessionId/interactions - Get user's interaction history
router.get('/user/:sessionId/interactions', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const { data, error } = await supabase
            .from('user_interactions')
            .select('*')
            .eq('session_id', sessionId)
            .order('interacted_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

module.exports = router;
