// Wrapper centralizado de fetch con autenticacion JWT.
// Todas las llamadas a la API pasan por aqui para inyectar el token automaticamente.

const TOKEN_KEY = 'myecommerce_token';
const USER_KEY = 'myecommerce_user';

/**
 * Obtiene el token JWT almacenado.
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Guarda el token JWT y los datos del usuario.
 */
export function storeSession(token: string, user: Record<string, unknown>): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Limpia la sesion almacenada.
 */
export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Obtiene el usuario almacenado.
 */
export function getStoredUser<T>(): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Fetch autenticado que inyecta el token JWT en el header Authorization.
 * Si la respuesta es 401, ejecuta el callback onUnauthorized (normalmente logout).
 */
export async function authFetch(
  url: string,
  options: RequestInit = {},
  onUnauthorized?: () => void
): Promise<Response> {
  const token = getStoredToken();

  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Content-Type por defecto para POST/PUT/PATCH
  // NO inyectar Content-Type si el body es FormData (el navegador lo hace automaticamente con boundary correcto)
  if (!headers.has('Content-Type') && options.method && options.method !== 'GET' && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Si el token expiro o es invalido, ejecutar callback
  if (response.status === 401 && onUnauthorized) {
    // Solo si el error es de sesion (no login)
    const cloned = response.clone();
    try {
      const data = await cloned.json();
      if (data.code === 'SESSION_EXPIRED' || data.code === 'UNAUTHORIZED') {
        onUnauthorized();
      }
    } catch {
      // No se pudo leer el body, ejecutar callback de todas formas
      onUnauthorized();
    }
  }

  return response;
}
