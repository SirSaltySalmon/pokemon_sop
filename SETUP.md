# Salmon's Pokemon SoP Setup Guide

This guide will walk you through setting up Salmon's Pokemon SoP from scratch.

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to finish provisioning (takes a few minutes)

### Get Your Supabase Credentials

1. Go to **Settings** > **API**
2. Copy the **Project URL** (this is your `SUPABASE_URL`)
3. Go to **Settings** > **Database**
4. Copy the **Secret Key** (this is your `SUPABASE_SERVICE_ROLE_KEY` - keep this secret!)

### Set Up Database Schema

1. In Supabase, go to **SQL Editor**
2. Click **New Query**
3. Open the file `supabase/schema.sql` from this project
4. Copy the entire contents and paste into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned"

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your Supabase credentials:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

## Step 4: Run the Development Server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Troubleshooting

### "Invalid API key" error
- Make sure your `.env` file has the correct values
- Restart the server after changing environment variables
- Verify you're using the `service_role` key, not the `anon` key

### Database errors
- Make sure you ran the `schema.sql` script in Supabase SQL Editor
- Check that all tables were created (go to **Table Editor** in Supabase)