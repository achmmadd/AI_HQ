import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WorkspaceStub({
  title,
  description = "Deze module wordt binnenkort toegevoegd.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <Card className="max-w-lg border-border/60 bg-surface/80">
      <CardHeader>
        <CardTitle className="text-lg text-ws-accent">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[15px] text-text-secondary">{description}</p>
      </CardContent>
    </Card>
  );
}
