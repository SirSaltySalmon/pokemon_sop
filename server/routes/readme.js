const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// GET /api/readme - Get README.md as rendered HTML
router.get('/readme', (req, res) => {
    try {
        const readmePath = path.resolve(__dirname, '../../README.md');
        
        // Check if README.md exists
        if (!fs.existsSync(readmePath)) {
            return res.status(404).json({ error: 'README.md not found' });
        }

        // Read README.md file
        const markdown = fs.readFileSync(readmePath, 'utf8');
        
        // Convert markdown to HTML
        const html = marked(markdown);
        
        res.json({ html });
    } catch (error) {
        console.error('Error reading README.md:', error);
        res.status(500).json({ error: 'Failed to read README.md', details: error.message });
    }
});

module.exports = router;
