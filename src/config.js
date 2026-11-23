// Supabase -> Settings -> API Keys (the old "Settings -> API" page no longer exists).
// Project URL is at the top of that page. Use the publishable key (sb_publishable_...),
// never the secret key: it bypasses row level security and must not ship in a browser.
export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'YOUR-PUBLISHABLE-KEY';
export const IMAGE_BUCKET = 'question-images';
