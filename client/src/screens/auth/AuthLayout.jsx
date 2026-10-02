// The centred card that the signed-out screens (and the front page) sit in, under the logo.
// `title` names the browser tab: "Sign in — LearnHub".
import { Link } from 'react-router';
import BrandMark from '../../ui-pieces/basics/BrandMark.jsx';

export default function AuthLayout({ title, children }) {
  return (
    <main className="centred">
      {title && <title>{`${title} — LearnHub`}</title>}
      <div className="centred-card">
        <Link className="centred-brand" to="/">
          <BrandMark />
        </Link>
        <section className="card">{children}</section>
      </div>
    </main>
  );
}
