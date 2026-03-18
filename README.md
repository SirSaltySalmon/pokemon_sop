# Salmon's Pokemon Smash or Pass

## About
A game where you can ask yourself a very simple question about randomly selected Pokemons associated with tags, and see if your opinions can be validated by comparing it with others'. Points are awarded depending on your taste.

### Future plans:
1. Link rule34.xxx posts and comments for humorous purposes
2. Allow posting comments on each pokemon

## Quick start:
Detailed instructions available in SETUP.md
1. Use npm install for dependencies
2. Fill out your Supabase keys
3. Set up Supabase databsse schema
3. Run and access on localhost or preferred deployment platform eg. Vercel

## Client / server flow (performance)

1. **Eligible IDs** — When you load the page or click **Apply Filters**, the server returns a sorted list of character IDs matching your tag include/exclude rules (one DB round-trip, no per-Pokémon work).
2. **Next Pokémon** — The browser picks the next ID from that list using your local `interactedCharacters` (random or Dex order). No server call until you need the full record.
3. **Detail** — `GET /api/characters/:id` loads that Pokémon’s row + tags (indexed lookup).
4. **Votes / skips** — Still posted to the server so global stats stay accurate. **Reset Stats** clears the local interacted list so you can run through the same pool again without refetching IDs unless filters change.

## Q&A

### ...But why?
I made this website to learn about Node.js and SQLite. I thought this would be funny. After developing another project with Supabase, I've decided to migrate the database handling there instead for easier cloud deployment.

### Did you use AI?
I had AI assistance as I was not familiar with the syntax and rules of the new languages and tools I had to learn. AI is not used for any other purpose than code generation.

### I want to donate!
If you would like to support the upkeep of the site, you can buy me a coffee here: https://ko-fi.com/sirsalmon