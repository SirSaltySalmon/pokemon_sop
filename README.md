# Salmon's Pokemon Smash or Pass

## About
A game where you can ask yourself a very simple question about randomly selected Pokemons associated with tags, and see if your opinions can be validated by comparing it with others'. Points are awarded depending on your taste.

### Future plans:
Accurately add all tags to all pokemon
Link rule34.xxx posts and comments for humorous purposes
Allow posting comments on each pokemon

## Quick start

See **SETUP.md** for database schema. This app is **Next.js** (App Router).

1. `npm install`
2. Copy `.env` or create `.env.local` with:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose as `NEXT_PUBLIC_*`)
3. `npm run dev` → http://localhost:3000
4. **Vercel**: connect the repo and set the same env vars; framework preset Next.js.

## Q&A

### ...But why?
I made this website to learn about Node.js and SQLite. I thought this would be funny. After developing another project with Supabase, I've decided to migrate the database handling there instead for easier cloud deployment.

### Did you use AI?
I had AI assistance as I was not familiar with the syntax and rules of the new languages and tools I had to learn. AI is not used for any other purpose than code generation.

### I want to donate!
If you would like to support the upkeep of the site, you can buy me a coffee here: https://ko-fi.com/sirsalmon