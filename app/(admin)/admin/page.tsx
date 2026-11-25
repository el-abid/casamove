import { listTickets } from "@/lib/agent/tickets";
import { AdminConsole } from "@/components/admin/AdminConsole";
import "@/components/admin/admin.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const tickets = await listTickets();
  return <AdminConsole initialTickets={tickets} />;
}
