// The LearnHub logo: the mark in its tile, then the name. Kept in step with the icon in index.html.
export default function BrandMark() {
  return (
    <>
      <span className="brand-mark">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 5.5 12 12l8-6.5M4 18.5 12 12l8 6.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      LearnHub
    </>
  );
}
