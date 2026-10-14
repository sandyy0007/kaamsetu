import { QuestionDetail } from "@/components/features/experts";

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuestionDetail id={id} />;
}

export async function generateStaticParams() {
  return [{ id: "_default" }];
}
