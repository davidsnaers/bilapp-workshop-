import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import DashboardSidebar from "@/components/DashboardSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workshop } = await supabase
    .from("workshops")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!workshop) redirect("/onboarding");

  return (
    <ThemeProvider>
      <div className="ws-layout">
        <DashboardSidebar workshop={workshop} />
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>
    </ThemeProvider>
  );
}
