import { FarmDetailView } from "@/components/features/farm-views";

export default async function FarmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FarmDetailView id={id} />;
}

export async function generateStaticParams() {
  return [{ id: "_default" }];
}
