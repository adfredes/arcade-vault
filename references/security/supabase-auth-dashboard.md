# Ajustes manuales de Supabase Auth (dashboard)

> Estos ajustes **no** se pueden aplicar vía MCP/SQL — viven en la config de Auth
> del dashboard de Supabase. Forman parte de SPEC 14 (hardening de seguridad).
> La verificación de cada uno se hace re-corriendo `get_advisors(security)`.

## Pasos (Authentication)

1. **Minimum password length = 8.**
   Authentication → Sign In / Providers → (Email) Password → `Minimum password length` = **8**.
   - Nota: el dashboard solo fuerza la **longitud**. La política de **complejidad**
     (mayúscula/minúscula/dígito/símbolo) es client-side en `app/auth/page.tsx`
     (regex `STRONG_PASSWORD`), porque Supabase no la expone por categorías vía MCP.

2. **Leaked Password Protection = ON (HaveIBeenPwned).**
   Authentication → Sign In / Providers → Password → activar
   `Leaked password protection`.
   - Apaga el advisor `auth_leaked_password_protection`.

3. **Max signup rate (anti-bot).**
   Authentication → Rate Limits → ajustar el límite de **signups** por hora a un
   valor acorde al tráfico esperado, para frenar registros masivos automatizados.
   - El SMTP de prueba de Supabase tiene rate limit bajo; para volumen real,
     configurar SMTP propio (fuera de scope).

## Verificación

```
get_advisors(security)  →  no debe devolver `auth_leaked_password_protection`
```

Los advisors `anon_security_definer_function_executable` y
`authenticated_security_definer_function_executable` se cerraron por la migración
`drop_rls_auto_enable` (no son de dashboard).
