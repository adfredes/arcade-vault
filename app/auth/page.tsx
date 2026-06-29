'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Solo para el registro: ≥8 caracteres con minúscula, mayúscula, dígito y símbolo.
const STRONG_PASSWORD =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function isStrongPassword(pass: string): boolean {
  return STRONG_PASSWORD.test(pass);
}

const PASSWORD_HINT =
  'Mínimo 8 caracteres e incluir mayúscula, minúscula, número y símbolo.';

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials'))
    return 'Email o contraseña incorrectos.';
  if (m.includes('already registered') || m.includes('already exists'))
    return 'Ese email ya tiene una cuenta. Iniciá sesión.';
  if (m.includes('email not confirmed'))
    return 'Confirmá tu email antes de entrar (revisá tu correo).';
  if (m.includes('password')) return 'La contraseña no cumple los requisitos.';
  return message;
}

export default function AuthPage() {
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === 'in') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });
        if (error) {
          setError(friendlyError(error.message));
          return;
        }
        router.push('/');
        router.refresh();
      } else {
        if (!isStrongPassword(pass)) {
          setError(`La contraseña debe tener ${PASSWORD_HINT.toLowerCase()}`);
          return;
        }
        const displayName = (username || 'PLAYER1').toUpperCase().slice(0, 10);
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          setError(friendlyError(error.message));
          return;
        }
        // Email ya registrado: Supabase devuelve user con identities vacío
        // (anti-enumeración) y NO envía mail. Hay que avisarlo explícito.
        if (data.user && data.user.identities?.length === 0) {
          setError('Ese email ya tiene una cuenta. Iniciá sesión.');
          return;
        }
        // Confirm email OFF: el usuario queda logueado al instante.
        if (data.session) {
          router.push('/');
          router.refresh();
          return;
        }
        // Verificación por email requerida: mostrar panel "revisa tu correo".
        setSentTo(email);
      }
    } finally {
      setLoading(false);
    }
  };

  const playAsGuest = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const signInWith = async (provider: 'google' | 'github') => {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // Si arranca el redirect el navegador ya navega; solo llegamos acá si falla.
    if (error) {
      setError(friendlyError(error.message));
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="mark" />
            <h2 className="neon-cyan">REVISÁ TU CORREO</h2>
          </div>
          <div className="auth-note">
            <p>
              Enviamos un enlace de verificación a{' '}
              <span className="email-hi">{sentTo}</span>.
            </p>
            <p
              className="mono"
              style={{ color: 'var(--ink-faint)', marginTop: 12 }}
            >
              Abrí el correo y hacé clic en el enlace para activar tu cuenta y
              entrar al Vault.
            </p>
          </div>

          <button
            className="btn ghost"
            style={{ width: '100%', marginTop: 18 }}
            onClick={() => {
              setSentTo(null);
              setTab('in');
            }}
          >
            VOLVER A INICIAR SESIÓN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--ink-faint)',
              letterSpacing: '0.16em',
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === 'in' ? 'on' : ''}
            onClick={() => {
              setTab('in');
              setError(null);
            }}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={tab === 'up' ? 'on' : ''}
            onClick={() => {
              setTab('up');
              setError(null);
            }}
          >
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit}>
          {tab === 'up' && (
            <div className="field slide-in">
              <label>Usuario</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="px_kai"
              />
            </div>
          )}

          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
            />
          </div>

          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              required
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
            {tab === 'up' && (
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: 'var(--ink-faint)',
                  letterSpacing: '0.04em',
                  marginTop: 6,
                }}
              >
                {PASSWORD_HINT}
              </div>
            )}
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            className="btn lg"
            type="submit"
            disabled={loading}
            style={{ width: '100%', marginTop: 8 }}
          >
            {loading
              ? 'PROCESANDO…'
              : tab === 'in'
                ? 'ENTRAR AL VAULT'
                : 'CREAR Y JUGAR'}
          </button>
        </form>

        <button
          className="btn ghost"
          style={{ width: '100%', marginTop: 10 }}
          onClick={playAsGuest}
          disabled={loading}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            disabled={loading}
            onClick={() => signInWith('google')}
          >
            ◆&nbsp; GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={loading}
            onClick={() => signInWith('github')}
          >
            ▣&nbsp; GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--ink-faint)',
            letterSpacing: '0.1em',
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
