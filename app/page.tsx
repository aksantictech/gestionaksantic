import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase";
import Gestion from "@/components/gestion";
import type { Profile } from "@/lib/types";

export default async function Page() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profil } = await supabase
    .from("profiles").select("*").eq("id", user.id).single<Profile>();

  if (!profil || !profil.is_active) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return <Gestion profil={profil} />;
}
