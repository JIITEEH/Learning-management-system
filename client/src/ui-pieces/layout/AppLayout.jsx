// The frame around every signed-in screen: the bar across the top, then the screen itself
// (<Outlet /> is where react-router puts it).
import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { initials, roleLabel } from '../../helpers/format.js';
import BrandMark from '../basics/BrandMark.jsx';

// The navigation, in order. `needs` is a permission code: the link only shows for an account that
// holds it. Hiding a link stops nobody typing the address, which is why the server checks the
// same permission on every request.
const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/courses', label: 'Courses', needs: 'course.read' },
  { to: '/admin', label: 'Administration', needs: 'role.manage' },
];

export default function AppLayout() {
  const { user, can, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef(null);
  const navRef = useRef(null);

  // Opening another screen closes the menu
  useEffect(() => setMenuOpen(false), [location.pathname]);

  // On narrow screens the links fold into a menu. Escape closes it and returns focus to the button
  // that opened it; a tap anywhere outside it closes it too, as a menu is expected to behave.
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    }
    function onPointer(event) {
      if (!navRef.current?.contains(event.target) && !toggleRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="shell">
        <header className="topbar">
          <Link className="brand" to="/">
            <BrandMark />
          </Link>

          <button
            ref={toggleRef}
            className="icon-btn nav-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="visually-hidden">Menu</span>
            <Menu aria-hidden="true" />
          </button>

          {/* data-open drives the fold-out styling on narrow screens */}
          <nav ref={navRef} className="navpill" id="primary-nav" aria-label="Primary" data-open={menuOpen || undefined}>
            {NAV.filter((item) => !item.needs || can(item.needs)).map((item) => (
              <NavLink key={item.to} className="navpill-item" to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="topbar-actions">
            <Link className="account-btn" to="/account">
              <span className="avatar" aria-hidden="true">
                {initials(user.fullName)}
              </span>
              <span className="account-name">{user.fullName}</span>
              <span className="visually-hidden">Your account — {roleLabel(user.role)}</span>
              <ChevronDown aria-hidden="true" />
            </Link>
            <button className="icon-btn" type="button" onClick={handleSignOut}>
              <span className="visually-hidden">Sign out</span>
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Screens loaded on demand (see App.jsx) show nothing for the moment they take to arrive */}
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </div>
    </>
  );
}
