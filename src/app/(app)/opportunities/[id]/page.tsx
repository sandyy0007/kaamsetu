import { WorkDetailView } from "@/components/features/work-opportunities";

export const metadata = { title: "Opportunity" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkDetailView id={id} />;
}
