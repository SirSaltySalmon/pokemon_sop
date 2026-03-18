const express = require('express');
const router = express.Router();
const supabase = require('../database');

/**
 * Returns character IDs matching tag include/exclude and not in excludeIds (interacted).
 * Order is arbitrary; caller may sort for sequential mode.
 */
async function getEligibleCharacterIds(tags, exclude, excludeIds) {
    let eligibleCharIds = null;

    if (tags) {
        const tagList = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        if (tagList.length > 0) {
            const { data: tagData, error: tagError } = await supabase
                .from('tags')
                .select('id')
                .in('name', tagList);

            if (tagError) throw tagError;

            if (tagData && tagData.length > 0) {
                const tagIds = tagData.map(t => t.id);
                const { data: charTagData, error: charTagError } = await supabase
                    .from('character_tags')
                    .select('character_id')
                    .in('tag_id', tagIds);

                if (charTagError) throw charTagError;

                if (charTagData && charTagData.length > 0) {
                    eligibleCharIds = [...new Set(charTagData.map(ct => ct.character_id))];
                } else {
                    return [];
                }
            } else {
                return [];
            }
        }
    }

    if (exclude) {
        const excludeList = exclude.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        if (excludeList.length > 0) {
            const { data: excludeTagData, error: excludeTagError } = await supabase
                .from('tags')
                .select('id')
                .in('name', excludeList);

            if (excludeTagError) throw excludeTagError;

            if (excludeTagData && excludeTagData.length > 0) {
                const excludeTagIds = excludeTagData.map(t => t.id);
                const { data: excludeCharTagData, error: excludeCharTagError } = await supabase
                    .from('character_tags')
                    .select('character_id')
                    .in('tag_id', excludeTagIds);

                if (excludeCharTagError) throw excludeCharTagError;

                if (excludeCharTagData && excludeCharTagData.length > 0) {
                    const excludedCharIds = [...new Set(excludeCharTagData.map(ct => ct.character_id))];
                    if (eligibleCharIds) {
                        eligibleCharIds = eligibleCharIds.filter(id => !excludedCharIds.includes(id));
                    } else {
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

    if (excludeIds) {
        const ids = excludeIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (ids.length > 0) {
            if (eligibleCharIds) {
                eligibleCharIds = eligibleCharIds.filter(id => !ids.includes(id));
            } else {
                const { data: allChars, error: allCharsError } = await supabase
                    .from('characters')
                    .select('id');
                if (allCharsError) throw allCharsError;
                eligibleCharIds = allChars ? allChars.map(c => c.id).filter(id => !ids.includes(id)) : [];
            }
        }
    }

    if (!eligibleCharIds) {
        const { data: allChars, error: allCharsError } = await supabase
            .from('characters')
            .select('id');
        if (allCharsError) throw allCharsError;
        eligibleCharIds = allChars ? allChars.map(c => c.id) : [];
    }

    return eligibleCharIds;
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
        const tagIds = tagRows.map(tr => tr.tag_id);
        const { data: tagsData, error: tagsError } = await supabase
            .from('tags')
            .select('name')
            .in('id', tagIds);

        if (tagsError) throw tagsError;
        tagNames = tagsData ? tagsData.map(t => t.name) : [];
    }
    return { ...character, tags: tagNames };
}

// GET /api/character/random?tags=tag1,tag2&exclude=tag3&excludeIds=1,2,3
router.get('/character/random', async (req, res) => {
    try {
        const { tags, exclude, excludeIds } = req.query;
        const eligibleCharIds = await getEligibleCharacterIds(tags, exclude, excludeIds);

        if (eligibleCharIds.length === 0) {
            return res.status(404).json({ error: 'No character found' });
        }

        const randomIndex = Math.floor(Math.random() * eligibleCharIds.length);
        const characterId = eligibleCharIds[randomIndex];

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

// GET /api/character/next?afterId=5&tags=&exclude=&excludeIds=
// afterId omitted: lowest eligible ID. afterId set: next higher eligible ID (by national dex order within filtered set).
router.get('/character/next', async (req, res) => {
    try {
        const { tags, exclude, excludeIds, afterId } = req.query;
        let eligibleCharIds = await getEligibleCharacterIds(tags, exclude, excludeIds);

        if (eligibleCharIds.length === 0) {
            return res.status(404).json({ error: 'No character found' });
        }

        eligibleCharIds.sort((a, b) => a - b);

        const after = afterId !== undefined && afterId !== '' ? parseInt(afterId, 10) : NaN;
        let characterId;
        if (!isNaN(after)) {
            characterId = eligibleCharIds.find(id => id > after);
        } else {
            characterId = eligibleCharIds[0];
        }

        if (characterId === undefined) {
            return res.status(404).json({ error: 'No character found' });
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
