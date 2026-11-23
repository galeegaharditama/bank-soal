import { supabase } from './supabaseClient.js';
import { IMAGE_BUCKET } from '../config.js';

export async function uploadImage(file) {
  const extension = file.name.split('.').pop() || 'png';
  const path = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export function publicImageUrl(path) {
  if (!path) return null;
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
