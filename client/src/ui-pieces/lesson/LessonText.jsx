// A lesson's text. Lessons are plain text: a blank line starts a new paragraph, line breaks are
// kept (the .prose style), and web addresses become links. Nothing typed can become HTML or run
// as code: React puts every piece on the page as text, and only http(s) addresses become links.
const WEB_ADDRESS = /(https?:\/\/[^\s<>"]+)/g;

function withLinks(text) {
  // split() with a capturing group keeps the addresses, at odd positions in the result
  return text.split(WEB_ADDRESS).map((piece, index) =>
    index % 2 === 1 ? (
      <a key={index} href={piece} target="_blank" rel="noopener noreferrer">{piece}</a>
    ) : (
      piece
    ),
  );
}

// Also used for assignment instructions and announcements, which pass their own `emptyText`
// ('' shows nothing at all when there is no text)
export default function LessonText({ text, emptyText = 'This lesson has no text yet.' }) {
  const paragraphs = text.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
  if (paragraphs.length === 0) return emptyText ? <p className="placeholder">{emptyText}</p> : null;
  return (
    <div className="lesson-text">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="prose">{withLinks(paragraph)}</p>
      ))}
    </div>
  );
}
