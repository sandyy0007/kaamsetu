import { LiveSession } from "@/components/features/events";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveSession id={id} />;
}
