export function SettingsPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="space-y-1">
      <h2 className="text-xl font-semibold tracking-tight text-text-primary">{title}</h2>
      <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
    </header>
  );
}
