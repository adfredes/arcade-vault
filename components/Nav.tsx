'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useUser } from '@/context/UserContext';

export default function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useUser();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleSignOut = () => {
    signOut();
    router.push('/');
  };

  return (
    <>
      <nav className="av-nav">
        <div className="logo" onClick={() => go('/')} style={{ cursor: 'pointer' }}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </div>

        <div className="links">
          <Link href="/" className={isActive('/') ? 'active' : ''}>
            Inicio
          </Link>
          <Link href="/games" className={isActive('/games') ? 'active' : ''}>
            Biblioteca
          </Link>
          <Link href="/hall-of-fame" className={isActive('/hall-of-fame') ? 'active' : ''}>
            Salón de la Fama
          </Link>
          <Link href="/about" className={isActive('/about') ? 'active' : ''}>
            Acerca de
          </Link>
        </div>

        <div className="spacer" />

        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>

        {user ? (
          <button className="btn ghost auth-btn" onClick={handleSignOut}>
            {user.name} ▾
          </button>
        ) : (
          <button className="btn auth-btn" onClick={() => go('/auth')}>
            Iniciar Sesión
          </button>
        )}

        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={'av-mobile-backdrop' + (open ? ' open' : '')}
        onClick={() => setOpen(false)}
      />
      <aside className={'av-mobile-panel' + (open ? ' open' : '')}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <a
          className={isActive('/') ? 'active' : ''}
          onClick={() => go('/')}
          style={{ cursor: 'pointer' }}
        >
          Inicio
        </a>
        <a
          className={isActive('/games') ? 'active' : ''}
          onClick={() => go('/games')}
          style={{ cursor: 'pointer' }}
        >
          Biblioteca
        </a>
        <a
          className={isActive('/hall-of-fame') ? 'active' : ''}
          onClick={() => go('/hall-of-fame')}
          style={{ cursor: 'pointer' }}
        >
          Salón de la Fama
        </a>
        <a
          className={isActive('/about') ? 'active' : ''}
          onClick={() => go('/about')}
          style={{ cursor: 'pointer' }}
        >
          Acerca de
        </a>
        <a
          className={isActive('/auth') ? 'active' : ''}
          onClick={() => go('/auth')}
          style={{ cursor: 'pointer' }}
        >
          {user ? 'Cuenta' : 'Iniciar Sesión'}
        </a>
        <div style={{ flex: 1 }} />
        <div className="pixel" style={{ fontSize: 9, color: 'var(--ink-faint)', letterSpacing: '0.16em' }}>
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
