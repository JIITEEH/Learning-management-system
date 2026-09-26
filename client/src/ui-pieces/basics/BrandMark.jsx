// The LearnHub logo: an open book in its tile, then the name. Kept in step with the icon in
// index.html. (The earlier mark, two chevrons meeting, read as a "close" button beside the menu.)
export default function BrandMark() {
  return (
    <>
      <span className="brand-mark">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 7c-1.9-1.4-4.4-2-7.5-2v12.5c3.1 0 5.6.6 7.5 2 1.9-1.4 4.4-2 7.5-2V5c-3.1 0-5.6.6-7.5 2Z" />
          <path d="M12 7v12.5" />
        </svg>
      </span>
      LearnHub
    </>
  );
}
