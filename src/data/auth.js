import { supabase } from './supabaseClient.js';

// Users are created in the Supabase dashboard (Authentication -> Add user), so there is no sign-up screen.
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
