export function ChatSkeleton() {
  return (
    <div className="space-y-3 py-4" aria-hidden>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded-2xl bg-surface-elevated/80"
          style={{ width: `${60 + i * 10}%`, maxWidth: "100%" }}
        />
      ))}
      <p className="text-center text-xs text-text-secondary">
        Geschiedenis laden…
      </p>
    </div>
  );
}
