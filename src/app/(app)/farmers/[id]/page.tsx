import { redirect } from "next/navigation";

/** Old farmer profile URLs keep working — they land on the universal professional profile (same ID). */
export default async function FarmerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/professionals/${encodeURIComponent(id)}`);
}
