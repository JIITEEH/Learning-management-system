// Small pieces for telling the person what is happening.

// A message above a form. Unlike a toast it stays on screen, which is what a failed sign-in
// needs: the reason must still be there while the person fixes the field it refers to.
// Renders nothing when there is no message.
export function Notice({ tone = 'error', children }) {
  if (!children) return null;
  return <p className={`notice notice-${tone}`}>{children}</p>;
}

// Shown while the first answer from the server is on its way
export function PageLoader() {
  return (
    <main className="centred" aria-busy="true">
      <p className="placeholder">Loading…</p>
    </main>
  );
}

// A card saying there is nothing to show, with an optional icon
export function EmptyState({ icon: Icon, children, card = false }) {
  return (
    <div className={card ? 'card empty' : 'empty'}>
      {Icon && (
        <span className="empty-mark">
          <Icon aria-hidden="true" />
        </span>
      )}
      <p>{children}</p>
    </div>
  );
}
