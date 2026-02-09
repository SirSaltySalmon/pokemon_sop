const express = require('express');
const router = express.Router();
const supabase = require('../database');

// GET /api/character/random?tags=tag1,tag2&exclude=tag3&excludeIds=1,2,3
router.get('/character/random', async (req, res) => {
    try {
        const { tags, exclude, excludeIds } = req.query;

        let eligibleCharIds = null;

        // Tag inclusion (character must have at least one of the selected tags)
        if (tags) {
            const tagList = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            if (tagList.length > 0) {
                // Get tag IDs first
                const { data: tagData, error: tagError } = await supabase
                    .from('tags')
                    .select('id')
                    .in('name', tagList);

                if (tagError) throw tagError;

                if (tagData && tagData.length > 0) {
                    const tagIds = tagData.map(t => t.id);
                    // Get character IDs that have at least one of these tags
                    const { data: charTagData, error: charTagError } = await supabase
                        .from('character_tags')
                        .select('character_id')
                        .in('tag_id', tagIds);

                    if (charTagError) throw charTagError;

                    if (charTagData && charTagData.length > 0) {
                        eligibleCharIds = [...new Set(charTagData.map(ct => ct.character_id))];
                    } else {
                        return res.status(404).json({ error: 'No character found' });
                    }
                } else {
                    return res.status(404).json({ error: 'No character found' });
                }
            }
        }

        // Tag exclusion (character must NOT have any of the excluded tags)
        if (exclude) {
            const excludeList = exclude.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            if (excludeList.length > 0) {
                // Get excluded tag IDs
                const { data: excludeTagData, error: excludeTagError } = await supabase
                    .from('tags')
                    .select('id')
                    .in('name', excludeList);

                if (excludeTagError) throw excludeTagError;

                if (excludeTagData && excludeTagData.length > 0) {
                    const excludeTagIds = excludeTagData.map(t => t.id);
                    // Get character IDs that have any of these excluded tags
                    const { data: excludeCharTagData, error: excludeCharTagError } = await supabase
                        .from('character_tags')
                        .select('character_id')
                        .in('tag_id', excludeTagIds);

                    if (excludeCharTagError) throw excludeCharTagError;

                    if (excludeCharTagData && excludeCharTagData.length > 0) {
                        const excludedCharIds = [...new Set(excludeCharTagData.map(ct => ct.character_id))];
                        // Filter out excluded characters
                        if (eligibleCharIds) {
                            eligibleCharIds = eligibleCharIds.filter(id => !excludedCharIds.includes(id));
                        } else {
                            // If no tag inclusion filter, get all characters and exclude these
                            const { data: allChars, error: allCharsError } = await supabase
                                .from('characters')
                                .select('id');
                            if (allCharsError) throw allCharsError;
                            eligibleCharIds = allChars ? allChars.map(c => c.id).filter(id => !excludedCharIds.includes(id)) : [];
                        }
                    }
                }
            }
        }

        // Exclude already seen characters
        if (excludeIds) {
            const ids = excludeIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            if (ids.length > 0) {
                if (eligibleCharIds) {
                    eligibleCharIds = eligibleCharIds.filter(id => !ids.includes(id));
                } else {
                    // If no other filters, get all characters and exclude these
                    const { data: allChars, error: allCharsError } = await supabase
                        .from('characters')
                        .select('id');
                    if (allCharsError) throw allCharsError;
                    eligibleCharIds = allChars ? allChars.map(c => c.id).filter(id => !ids.includes(id)) : [];
                }
            }
        }

        // If no filters applied, get all character IDs
        if (!eligibleCharIds) {
            const { data: allChars, error: allCharsError } = await supabase
                .from('characters')
                .select('id');
            if (allCharsError) throw allCharsError;
            eligibleCharIds = allChars ? allChars.map(c => c.id) : [];
        }

        if (eligibleCharIds.length === 0) {
            return res.status(404).json({ error: 'No character found' });
        }

        // Pick a random character ID
        const randomIndex = Math.floor(Math.random() * eligibleCharIds.length);
        const characterId = eligibleCharIds[randomIndex];

        // Fetch the character by ID
        const { data: character, error: charError } = await supabase
            .from('characters')
            .select('*')
            .eq('id', characterId)
            .single();

        if (charError) throw charError;
        if (!character) {
            return res.status(404).json({ error: 'Character not found' });
        }

        // Fetch tags for the found character
        const { data: tagRows, error: tagRowsError } = await supabase
            .from('character_tags')
            .select('tag_id')
            .eq('character_id', character.id);

        if (tagRowsError) throw tagRowsError;

        let tagNames = [];
        if (tagRows && tagRows.length > 0) {
            const tagIds = tagRows.map(tr => tr.tag_id);
            const { data: tagsData, error: tagsError } = await supabase
                .from('tags')
                .select('name')
                .in('id', tagIds);
            
            if (tagsError) throw tagsError;
            tagNames = tagsData ? tagsData.map(t => t.name) : [];
        }
        res.json({ ...character, tags: tagNames });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// POST /api/character/:id/vote
router.post('/character/:id/vote', async (req, res) => {
    try {
        const characterId = parseInt(req.params.id);
        const { sessionId, voteType } = req.body; // voteType: true for yes, false for no

        if (!sessionId || typeof voteType !== 'boolean') {
            return res.status(400).json({ error: 'sessionId and voteType (boolean) required' });
        }

        // Get current vote stats for majority calculation
        const { data: statsData, error: statsError } = await supabase
            .from('user_interactions')
            .select('vote_type')
            .eq('character_id', characterId)
            .not('vote_type', 'is', null);

        if (statsError) throw statsError;

        const yesVotes = statsData ? statsData.filter(s => s.vote_type === true).length : 0;
        const noVotes = statsData ? statsData.filter(s => s.vote_type === false).length : 0;
        const totalVotes = yesVotes + noVotes + 1; // +1 for this vote

        const newYesVotes = voteType ? yesVotes + 1 : yesVotes;
        const newNoVotes = voteType ? noVotes : noVotes + 1;

        // Insert interaction
        const { data: insertData, error: insertError } = await supabase
            .from('user_interactions')
            .insert({
                character_id: characterId,
                session_id: sessionId,
                action_type: 'vote',
                vote_type: voteType
            })
            .select()
            .single();

        if (insertError) throw insertError;

        res.json({
            success: true,
            characterId,
            voteType,
            totalVotes,
            newYesVotes,
            newNoVotes
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// POST /api/character/:id/skip
router.post('/character/:id/skip', async (req, res) => {
    try {
        const characterId = parseInt(req.params.id);
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId required' });
        }

        const { data, error } = await supabase
            .from('user_interactions')
            .insert({
                character_id: characterId,
                session_id: sessionId,
                action_type: 'skip',
                vote_type: null
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, characterId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// GET /api/character/:id/results
// Useful for getting the results without altering the vote count, for example when the user skips a character
router.get('/character/:id/results', async (req, res) => {
    try {
        const characterId = parseInt(req.params.id);

        const { data: character, error: charError } = await supabase
            .from('characters')
            .select('*')
            .eq('id', characterId)
            .single();

        if (charError) throw charError;
        if (!character) {
            return res.status(404).json({ error: 'Character not found' });
        }

        const { data: statsData, error: statsError } = await supabase
            .from('user_interactions')
            .select('vote_type')
            .eq('character_id', characterId)
            .not('vote_type', 'is', null);

        if (statsError) throw statsError;

        const totalVotes = statsData ? statsData.length : 0;
        const yesVotes = statsData ? statsData.filter(s => s.vote_type === true).length : 0;
        const noVotes = statsData ? statsData.filter(s => s.vote_type === false).length : 0;

        res.json({
            character,
            voteStats: {
                totalVotes,
                yesVotes,
                noVotes
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

module.exports = router;
