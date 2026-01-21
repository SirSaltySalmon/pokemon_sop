import fs from 'fs';
import path from 'path';

async function getAllPokemonImageNames(imageDirectory) {
    try {
        const files = fs.readdirSync(imageDirectory);
        const imageNames = files
            .filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file))
            .map(file => path.parse(file).name);
        return imageNames;
    } catch (error) {
        console.error('Error reading image directory:', error);
        return [];
    }
}

const folder = './public/pokemon';
const imageNames = await getAllPokemonImageNames(folder);

var failed_images_by_name = [];
var failed_images = [];

for (const image_name of imageNames) {
    let is_mega = false;
    let is_male = false;
    let is_female = false;
    let real_name = image_name.toLowerCase();
    real_name = real_name.substring(5);
    real_name = real_name.replace(/ /g, "-");

    let id = parseInt(image_name.substring(0, 4));
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
        const response = await fetch("https://pokeapi.co/api/v2/pokemon/" + real_name);
        if (!response.ok) {
            console.log(real_name, "- Not Found");
            failed_images_by_name.push(image_name);
            // Try again by fetching by ID
            try {
                const response = await fetch("https://pokeapi.co/api/v2/pokemon/" + id);
                if (!response.ok) {
                    console.log(real_name, "- Not Found by ID");
                    failed_images.push(image_name);
                    continue;
                }
            } catch (error) {
                console.log(real_name, "- Error fetching by ID:", error.message);
                continue;
            }
        }
        json = await response.json();
    } catch (error) {
        console.log(real_name, "- Error fetching:", error.message);
        continue;
    }
    
    if (!json) {
        console.log(real_name);
        continue;
    }

    let types = [];
    let types_json = json.types;
    if (types_json["0"] != null) {
        types.push(types_json["0"]["type"]["name"]);
    }
    if (types_json["1"] != null) {
        types.push(types_json["1"]["type"]["name"]);
    }

    console.log(real_name, is_mega, is_male, is_female, id, types);
}

console.log("Failed images by name:", failed_images_by_name);
console.log("Failed images by ID:", failed_images);