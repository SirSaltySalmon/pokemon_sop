const express = require('express');
const router = express.Router();
const supabase = require('../database');

/**
 * All character IDs matching tag include/exclude (no "already seen" filter — client handles that).
 * Returned sorted ascending for O(log n) sequential picks client-side.
 */
async function getFilteredCharacterIds(tags, exclude) {
    let eligibleCharIds = null;

    if (tags) {
        const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
        if (tagList.length > 0) {
            const { data: tagData, error: tagError } = await supabase
                .from('tags')
                .select('id')
                .in('name', tagList);
            if (tagError) throw tagError;

            if (tagData && tagData.length > 0) {
                const tagIds = tagData.map((t) => t.id);
                const { data: charTagData, error: charTagError } = await supabase
                    .from('character_tags')
                    .select('character_id')
                    .in('tag_id', tagIds);
                if (charTagError) throw charTagError;

                if (charTagData && charTagData.length > 0) {
                    eligibleCharIds = [...new Set(charTagData.map((ct) => ct.character_id))];
                } else {
                    return [];
                }
            } else {
                return [];
            }
        }
    }

    if (exclude) {
        const excludeList = exclude.split(',').map((t) => t.trim()).filter(Boolean);
        if (excludeList.length > 0) {
            const { data: excludeTagData, error: excludeTagError } = await supabase
                .from('tags')
                .select('id')
                .in('name', excludeList);
            if (excludeTagError) throw excludeTagError;

            if (excludeTagData && excludeTagData.length > 0) {
                const excludeTagIds = excludeTagData.map((t) => t.id);
                const { data: excludeCharTagData, error: excludeCharTagError } = await supabase
                    .from('character_tags')
                    .select('character_id')
                    .in('tag_id', excludeTagIds);
                if (excludeCharTagError) throw excludeCharTagError;

                if (excludeCharTagData && excludeCharTagData.length > 0) {
                    const excludedCharIds = new Set(excludeCharTagData.map((ct) => ct.character_id));
                    if (eligibleCharIds) {
                        eligibleCharIds = eligibleCharIds.filter((id) => !excludedCharIds.has(id));
                    } else {
                        const { data: allChars, error: allCharsError } = await supabase
                            .from('characters')
                            .select('id');
                        if (allCharsError) throw allCharsError;
                        eligibleCharIds = (allChars || [])
                            .map((c) => c.id)
                            .filter((id) => !excludedCharIds.has(id));
                    }
                }
            }
        }
    }

    if (!eligibleCharIds) {
        const { data: allChars, error: allCharsError } = await supabase
            .from('characters')
            .select('id');
        if (allCharsError) throw allCharsError;
        eligibleCharIds = allChars ? allChars.map((c) => c.id) : [];
    }

    return [...new Set(eligibleCharIds)].sort((a, b) => a - b);
}

async function fetchCharacterWithTagsById(characterId) {
    const { data: character, error: charError } = await supabase
        .from('characters')
        .select('*')
        .eq('id', characterId)
        .single();

    if (charError) throw charError;
    if (!character) return null;

    const { data: tagRows, error: tagRowsError } = await supabase
        .from('character_tags')
        .select('tag_id')
        .eq('character_id', character.id);
    if (tagRowsError) throw tagRowsError;

    let tagNames = [];
    if (tagRows && tagRows.length > 0) {
        const tagIds = tagRows.map((tr) => tr.tag_id);
        const { data: tagsData, error: tagsError } = await supabase
            .from('tags')
            .select('name')
            .in('id', tagIds);
        if (tagsError) throw tagsError;
        tagNames = tagsData ? tagsData.map((t) => t.name) : [];
    }
    return { ...character, tags: tagNames };
}

// GET /api/characters/eligible-ids?tags=a,b&exclude=c — one call when filters are applied / page load
router.get('/characters/eligible-ids', async (req, res) => {
    try {
        const { tags, exclude } = req.query;
        const ids = await getFilteredCharacterIds(tags, exclude);
        res.json({ ids });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// GET /api/characters/:id — single indexed lookup + tags (called per Pokémon shown)
router.get('/characters/:id', async (req, res) => {
    try {
        const characterId = parseInt(req.params.id, 10);
        if (Number.isNaN(characterId)) {
            return res.status(400).json({ error: 'Invalid character id' });
        }
        const character = await fetchCharacterWithTagsById(characterId);
        if (!character) {
            return res.status(404).json({ error: 'Character not found' });
        }
        res.json(character);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// POST /api/character/:id/vote
router.post('/character/:id/vote', async (req, res) => {
    try {
        const characterId = parseInt(req.params.id);
        const { sessionId, voteType } = req.body;

        if (!sessionId || typeof voteType !== 'boolean') {
            return res.status(400).json({ error: 'sessionId and voteType (boolean) required' });
        }

        const { data: statsData, error: statsError } = await supabase
            .from('user_interactions')
            .select('vote_type')
            .eq('character_id', characterId)
            .not('vote_type', 'is', null);
        if (statsError) throw statsError;

        const yesVotes = statsData ? statsData.filter((s) => s.vote_type === true).length : 0;
        const noVotes = statsData ? statsData.filter((s) => s.vote_type === false).length : 0;
        const totalVotes = yesVotes + noVotes + 1;

        const newYesVotes = voteType ? yesVotes + 1 : yesVotes;
        const newNoVotes = voteType ? noVotes : noVotes + 1;

        const { error: insertError } = await supabase.from('user_interactions').insert({
            character_id: characterId,
            session_id: sessionId,
            action_type: 'vote',
            vote_type: voteType,
        });
        if (insertError) throw insertError;

        res.json({
            success: true,
            characterId,
            voteType,
            totalVotes,
            newYesVotes,
            newNoVotes,
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

        const { error } = await supabase.from('user_interactions').insert({
            character_id: characterId,
            session_id: sessionId,
            action_type: 'skip',
            vote_type: null,
        });
        if (error) throw error;

        res.json({ success: true, characterId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// GET /api/character/:id/results
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
        const yesVotes = statsData ? statsData.filter((s) => s.vote_type === true).length : 0;
        const noVotes = statsData ? statsData.filter((s) => s.vote_type === false).length : 0;

        res.json({
            character,
            voteStats: { totalVotes, yesVotes, noVotes },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

module.exports = router;
