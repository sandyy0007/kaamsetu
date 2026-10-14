import { ListingDetail } from "@/components/features/market";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingDetail id={id} />;
}

export async function generateStaticParams() {
  return [{ id: "_default" }];
}
