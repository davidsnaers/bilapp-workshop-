// @ts-nocheck
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import CustomersClient from "./CustomersClient";

export default async function CustomersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workshop } = await supabase
    .from("workshops")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!workshop) redirect("/onboarding");

  // Get unique customers from bookings at this workshop
  const { data: bookings } = await (supabase as any)
    .from("bookings_workshop")
    .select("id, customer_name, customer_phone, customer_plate, customer_car_make, customer_car_model, customer_car_year, start_time, status, service:service_id(name_is), service_label")
    .eq("workshop_id", workshop.id)
    .not("customer_name", "is", null)
    .order("start_time", { ascending: false });

  // Group by customer phone or name
  const customerMap = new Map<string, any>();
  for (const b of (bookings ?? [])) {
    const key = b.customer_phone ?? b.customer_name ?? "unknown";
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        name: b.customer_name,
        phone: b.customer_phone,
        plate: b.customer_plate,
        carMake: b.customer_car_make,
        carModel: b.customer_car_model,
        bookings: [],
      });
    }
    customerMap.get(key).bookings.push(b);
  }

  const customers = Array.from(customerMap.values());

  return <CustomersClient customers={customers} />;
}
