import { BuyerProfileView } from "@/components/features/other-profiles";

export default async function BuyerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BuyerProfileView id={id} />;
}

export async function generateStaticParams() {
  return [{ id: "_default" }];
}
