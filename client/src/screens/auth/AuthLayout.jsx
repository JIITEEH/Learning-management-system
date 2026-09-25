// The centred card that the signed-out screens (and the front page) sit in, under the logo
import { Link } from 'react-router';
import BrandMark from '../../ui-pieces/basics/BrandMark.jsx';

export default function AuthLayout({ children }) {
  return (
    <main className="centred">
      <div className="centred-card">
        <Link className="centred-brand" to="/">
          <BrandMark />
        </Link>
        <section className="card">{children}</section>
      </div>
    </main>
  );
}
