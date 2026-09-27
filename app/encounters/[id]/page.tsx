import { EncounterEditor } from '../../components/EncounterEditor';

export default async function EncounterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EncounterEditor id={id} />;
}
