import { CommunityDetail } from "@/components/features/communities";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CommunityDetail id={id} />;
}

export async function generateStaticParams() {
  return [{ id: "_default" }];
}
