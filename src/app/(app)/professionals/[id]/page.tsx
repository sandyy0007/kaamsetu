import { ProfessionalProfileView } from "@/components/features/professional-profile";

export default async function ProfessionalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfessionalProfileView id={id} />;
}
