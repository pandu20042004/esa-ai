import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data?.user) redirect("/");
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <LoginForm />
      </div>
    </main>
  );
}
