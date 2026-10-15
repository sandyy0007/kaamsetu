import { FarmerProfileRedirect } from "@/components/features/farmer-redirect";

/** Old farmer profile URLs keep working — they land on the universal professional profile (same ID). */
export default async function FarmerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FarmerProfileRedirect initialId={id} />;
}

export async function generateStaticParams() {
  return [{ id: "_default" }];
}
