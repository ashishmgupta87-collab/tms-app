#!/bin/bash
# Replace placeholders in config.js with actual environment variables
sed -i "s|%%SUPABASE_URL%%|$SUPABASE_URL|g" config.js
sed -i "s|%%SUPABASE_ANON_KEY%%|$SUPABASE_ANON_KEY|g" config.js
echo "Config built successfully"
