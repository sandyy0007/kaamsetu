import { SchemeDetail } from "@/components/features/government";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SchemeDetail id={id} />;
}
