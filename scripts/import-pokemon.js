require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables. Please check your .env file.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getAllPokemonImageFiles(imageDirectory) {
    try {
        const files = fs.readdirSync(imageDirectory);
        const imageFiles = files.filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file));
        return imageFiles;
    } catch (error) {
        console.error('Error reading image directory:', error);
        return [];
    }
}

async function ensureTagExists(tagName) {
    // Check if tag exists
    const { data: existingTag, error: checkError } = await supabase
        .from('tags')
        .select('id')
        .eq('name', tagName)
        .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
        throw checkError;
    }

    if (existingTag) {
        return existingTag.id;
    }

    // Create tag if it doesn't exist
    const { data: newTag, error: insertError } = await supabase
        .from('tags')
        .insert({ name: tagName })
        .select('id')
        .single();

    if (insertError) {
        throw insertError;
    }

    return newTag.id;
}

async function insertCharacterWithTags(name, imageUrl, tagNames) {
    // Check if character already exists by image_url
    const { data: existingChar, error: checkError } = await supabase
        .from('characters')
        .select('id')
        .eq('image_url', imageUrl)
        .single();

    let characterId;

    if (existingChar) {
        console.log(`  Character "${name}" already exists, updating tags...`);
        characterId = existingChar.id;
        
        // Delete existing character_tags for this character
        const { error: deleteError } = await supabase
            .from('character_tags')
            .delete()
            .eq('character_id', characterId);
        
        if (deleteError) {
            console.error(`  Error deleting existing tags:`, deleteError);
        }
    } else {
        // Insert new character
        const { data: newChar, error: insertError } = await supabase
            .from('characters')
            .insert({
                name: name,
                image_url: imageUrl
            })
            .select('id')
            .single();

        if (insertError) {
            throw insertError;
        }

        characterId = newChar.id;
        console.log(`  ✓ Inserted character "${name}" (ID: ${characterId})`);
    }

    // Ensure all tags exist and get their IDs
    const tagIds = [];
    for (const tagName of tagNames) {
        try {
            const tagId = await ensureTagExists(tagName);
            tagIds.push(tagId);
        } catch (error) {
            console.error(`  Error ensuring tag "${tagName}":`, error);
        }
    }

    // Insert character_tags relationships
    if (tagIds.length > 0) {
        const characterTags = tagIds.map(tagId => ({
            character_id: characterId,
            tag_id: tagId
        }));

        const { error: tagsError } = await supabase
            .from('character_tags')
            .insert(characterTags);

        if (tagsError) {
            console.error(`  Error inserting character tags:`, tagsError);
        } else {
            console.log(`  ✓ Linked ${tagIds.length} tag(s) to character`);
        }
    }

    return characterId;
}

async function main() {
    console.log('Starting Pokemon import script...\n');

    const folder = path.resolve(__dirname, '../public/pokemon');
    
    if (!fs.existsSync(folder)) {
        console.error(`Error: Pokemon image folder not found at ${folder}`);
        process.exit(1);
    }

    const imageFiles = await getAllPokemonImageFiles(folder);
    console.log(`Found ${imageFiles.length} Pokemon images\n`);

    const failed_images_by_name = [];
    const failed_images = [];
    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        const image_name = path.parse(imageFile).name; // filename without extension
        console.log(`[${i + 1}/${imageFiles.length}] Processing: ${imageFile}`);

        let is_mega = false;
        let is_male = false;
        let is_female = false;
        let real_name = image_name.toLowerCase();
        
        // Extract ID from first 4 characters
        const id = parseInt(image_name.substring(0, 4));
        
        // Remove ID prefix and clean up name
        real_name = real_name.substring(5);
        real_name = real_name.replace(/ /g, "-");

        if (real_name.includes("mega")) {
            is_mega = true;
        }
        if (real_name.includes("male")) {
            is_male = true;
        }
        if (real_name.includes("female")) {
            is_female = true;
        }

        let json;
        try {
            // Try fetching by name first
            let response = await fetch("https://pokeapi.co/api/v2/pokemon/" + real_name);
            if (!response.ok) {
                console.log(`  Not found by name, trying ID...`);
                failed_images_by_name.push(imageFile);
                // Try again by fetching by ID
                response = await fetch("https://pokeapi.co/api/v2/pokemon/" + id);
                if (!response.ok) {
                    console.log(`  ✗ Not found by ID either`);
                    failed_images.push(imageFile);
                    continue;
                }
            }
            json = await response.json();
        } catch (error) {
            console.log(`  ✗ Error fetching: ${error.message}`);
            failed_images.push(imageFile);
            continue;
        }

        if (!json) {
            console.log(`  ✗ No data returned`);
            failed_images.push(imageFile);
            continue;
        }

        // Extract Pokemon name and types
        const pokemonName = json.name.charAt(0).toUpperCase() + json.name.slice(1);
        const types = [];
        
        if (json.types && Array.isArray(json.types)) {
            json.types.forEach(typeObj => {
                if (typeObj.type && typeObj.type.name) {
                    types.push(typeObj.type.name);
                }
            });
        }

        // Add male/female/mega tags if applicable
        if (is_mega) {
            types.push('mega');
        }
        if (is_male) {
            types.push('male');
        }
        if (is_female) {
            types.push('female');
        }

        // Build image URL (relative path from public folder)
        const imageUrl = `/pokemon/${imageFile}`;

        try {
            await insertCharacterWithTags(pokemonName, imageUrl, types);
            successCount++;
        } catch (error) {
            console.error(`  ✗ Error inserting character:`, error.message);
            failed_images.push(imageFile);
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(50));
    console.log('Import Summary:');
    console.log(`  ✓ Successfully imported: ${successCount}`);
    console.log(`  ✗ Failed: ${failed_images.length}`);
    console.log(`  ⊘ Skipped (already exists): ${skipCount}`);
    
    if (failed_images_by_name.length > 0) {
        console.log(`\nFailed to find by name (but found by ID): ${failed_images_by_name.length}`);
    }
    
    if (failed_images.length > 0) {
        console.log(`\nFailed images:`);
        failed_images.forEach(img => console.log(`  - ${img}`));
    }
    
    console.log('='.repeat(50));
}

// Run the script
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
