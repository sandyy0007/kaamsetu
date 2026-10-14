import { EventDetail } from "@/components/features/events";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventDetail id={id} />;
}

export async function generateStaticParams() {
  return [{ id: "_default" }];
}
