import { ExpertProfileView } from "@/components/features/other-profiles";

export default async function ExpertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExpertProfileView id={id} />;
}
