require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables. Please check your .env file.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test connection
supabase.from('characters').select('id').limit(1)
    .then(() => {
        console.log('Connected to Supabase database');
    })
    .catch((err) => {
        console.error('Could not connect to Supabase database', err);
    });

module.exports = supabase;
