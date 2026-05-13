"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string } | undefined;

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Authentication is not configured." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/");
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Authentication is not configured." };

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  redirect("/");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  await supabase!.auth.signOut();
  redirect("/login");
}
