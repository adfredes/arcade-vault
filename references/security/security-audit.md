# Estado de seguridad — Arcade Vault

> Mantenido por el agente `security-auditor` — solo lectura, no edita código ni base. Alcance: checklist de SPEC 13/14.

## Estado por ítem

| Ítem                                                       | Frente | Estado | Evidencia                                                              | Última auditoría |
| ---------------------------------------------------------- | ------ | ------ | ---------------------------------------------------------------------- | ---------------- |
| RLS en games/scores                                        | DB     | ✅     | list_tables: rls_enabled true en ambas + policies presentes            | 2026-06-29       |
| Advisor anon_security_definer_function_executable          | DB     | ✅     | get_advisors: ausente                                                  | 2026-06-29       |
| Advisor authenticated_security_definer_function_executable | DB     | ✅     | get_advisors: ausente                                                  | 2026-06-29       |
| Advisor auth_leaked_password_protection                    | DB     | ❌     | get_advisors: PRESENTE (WARN) — protección OFF                         | 2026-06-29       |
| Policies de scores sin huecos                              | DB     | ✅     | pg_policies: select public (using true) + insert self-or-guest         | 2026-06-29       |
| rls_auto_enable / ensure_rls eliminados                    | DB     | ✅     | pg_proc: [] · pg_event_trigger: sin ensure_rls (solo triggers sistema) | 2026-06-29       |
| 3 headers de seguridad                                     | App    | ✅     | next.config.ts:9-14 headers() en source '/(.\*)'                       | 2026-06-29       |
| Password policy en registro                                | App    | ✅     | app/auth/page.tsx:8-9,59-62 STRONG_PASSWORD solo tab 'up'              | 2026-06-29       |
| Ajustes de Auth (length/leaked/rate)                       | App    | 🟡     | leaked OFF por advisor; min length/rate no auditables (dashboard)      | 2026-06-29       |
| Protección de rutas                                        | App    | ✅     | proxy.ts:62-66 matcher excl. estáticos + getUser por request           | 2026-06-29       |
| Sin secrets filtrados                                      | App    | ✅     | lib/supabase/*: solo NEXT*PUBLIC**PUBLISHABLE_KEY; .env\* gitignored   | 2026-06-29       |

Leyenda: ✅ OK · 🟡 parcial/pendiente verificación · ❌ falla

## Notas de la corrida 2026-06-29

- **Veredicto: 🟡 ámbar.** Un solo desvío: `Leaked Password Protection` sigue desactivada (advisor `auth_leaked_password_protection` en WARN). Es un toggle de dashboard, no de SQL/MCP.
- Los 2 advisors de `rls_auto_enable()` (anon/authenticated SECURITY DEFINER) ya **no aparecen** → la migración `drop_rls_auto_enable` cerró ese frente. Confirmado por `pg_proc` vacío.
- `scores` no tiene policies de UPDATE/DELETE → con RLS ON eso es deny-by-default (correcto).
- `.env.local` contiene secretos server-only (`RESEND_API_KEY`, `SUPABASE_DB_PASSWORD`) pero NO son `NEXT_PUBLIC_*` y `.env*` está en `.gitignore` (`!.env.template`). Sin fuga client-side.
