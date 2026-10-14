import { CourseDetail } from "@/components/features/learning";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseDetail id={id} />;
}

export async function generateStaticParams() {
  return [{ id: "_default" }];
}
