import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import MenuIcon from '../assets/icons/menu';
import CloseIcon from '../assets/icons/close';

export const Layout = () => {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-neutral-950">
      <header className="md:hidden fixed top-0 left-0 right-0 z-[60] flex h-14 items-center border-b border-[rgba(255,255,255,0.1)] bg-neutral-950/95 px-4 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-[12px] text-white hover:bg-[rgba(255,255,255,0.08)]"
          aria-label="Open navigation menu"
        >
          <MenuIcon width={22} height={22} color="#fff" />
        </button>
        <span className="flex-1 text-center font-teachers text-[14px] font-medium text-white">
          Admin
        </span>
        <span className="w-10" aria-hidden />
      </header>

      {mobileNavOpen && (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-[70] bg-black/60"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[80] flex w-[min(280px,88vw)] shrink-0 transition-transform duration-200 ease-out md:static md:z-auto md:w-[248px] md:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="relative flex h-full w-full shadow-2xl md:shadow-none">
          <button
            type="button"
            className="md:hidden absolute right-3 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-white hover:bg-[rgba(255,255,255,0.12)]"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <CloseIcon width={20} height={20} color="#fff" />
          </button>
          <Sidebar onNavigate={() => setMobileNavOpen(false)} className="pt-12 md:pt-8" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-neutral-950 pt-14 md:pt-0">
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
