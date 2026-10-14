import { OrgProfileView } from "@/components/features/other-profiles";

export default async function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrgProfileView id={id} />;
}

export async function generateStaticParams() {
  return [{ id: "_default" }];
}
