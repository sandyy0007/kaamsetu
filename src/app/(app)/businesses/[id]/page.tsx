import { BusinessDetailView } from "@/components/features/businesses";

export const metadata = { title: "Business" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BusinessDetailView id={id} />;
}

export async function generateStaticParams() {
  return [{ id: "_default" }];
}
