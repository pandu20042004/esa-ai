import { WorkbenchView } from "@/components/esai/workbench/WorkbenchView";

export default async function WorkbenchCompetitionPage(props: PageProps<"/workbench/[competitionId]">) {
  const { competitionId } = await props.params;
  return <WorkbenchView competitionId={competitionId} />;
}
