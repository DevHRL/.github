// Cliente mínimo de la API de Docmost (edición gratuita).
//
// Docmost Community no trae API keys: se inicia sesión con correo y contraseña
// y se reutiliza la cookie `authToken` (válida 24 h) como token Bearer.
// Ojo: es la API interna que usa el propio frontend, no una API pública con
// versiones. Fijar la versión de la imagen y probar antes de actualizar.

export class Docmost {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = null;
  }

  async login(email, password) {
    const res = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new Error(`login ${email}: HTTP ${res.status} ${await res.text()}`);
    }
    this.token = leerCookie(res, 'authToken');
    if (!this.token) {
      throw new Error(`login ${email}: Docmost no devolvió authToken (¿MFA activo?)`);
    }
    return this;
  }

  /**
   * La sesión viaja como cookie `authToken` (Docmost la lee antes que la
   * cabecera). Detrás de oauth2-proxy con --pass-basic-auth, la cabecera
   * Authorization se reemplaza incluso en las rutas liberadas para el bot, así
   * que un token Bearer no llegaría. El Bearer queda para cuando no hay proxy.
   */
  credenciales() {
    return this.token
      ? { cookie: `authToken=${this.token}`, authorization: `Bearer ${this.token}` }
      : {};
  }

  /** POST JSON a /api/<ruta>; devuelve `data` de la respuesta. */
  async post(ruta, cuerpo = {}) {
    const res = await fetch(`${this.baseUrl}/api/${ruta}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.credenciales(),
      },
      body: JSON.stringify(cuerpo),
    });
    const texto = await res.text();
    if (!res.ok) {
      const err = new Error(`${ruta}: HTTP ${res.status} ${texto.slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    if (!texto) return null;
    const json = JSON.parse(texto);
    return json && 'data' in json ? json.data : json;
  }

  /** Recorre un listado paginado por cursor y devuelve todos los elementos. */
  async todos(ruta, cuerpo = {}) {
    const items = [];
    let cursor;
    do {
      const pagina = await this.post(ruta, { limit: 100, ...cuerpo, ...(cursor ? { cursor } : {}) });
      items.push(...(pagina?.items ?? []));
      cursor = pagina?.meta?.hasNextPage ? pagina.meta.nextCursor : undefined;
    } while (cursor);
    return items;
  }

  /**
   * Sube un archivo a una página. Si se pasa `attachmentId`, reemplaza ese
   * adjunto en lugar de crear otro (así las sincronizaciones no acumulan copias).
   */
  async subirArchivo({ pageId, nombre, contenido, tipo, attachmentId }) {
    const form = new FormData();
    // Los campos deben ir antes del archivo: el servidor los lee en orden.
    form.append('pageId', pageId);
    if (attachmentId) form.append('attachmentId', attachmentId);
    form.append('file', new Blob([contenido], { type: tipo }), nombre);
    const res = await fetch(`${this.baseUrl}/api/files/upload`, {
      method: 'POST',
      headers: this.credenciales(),
      body: form,
    });
    const texto = await res.text();
    if (!res.ok) throw new Error(`files/upload ${nombre}: HTTP ${res.status} ${texto.slice(0, 300)}`);
    const json = JSON.parse(texto);
    return json && 'data' in json ? json.data : json;
  }
}

export function leerCookie(res, nombre) {
  const cookies = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
  for (const c of cookies) {
    const m = c.match(new RegExp(`(?:^|;\\s*)${nombre}=([^;]+)`));
    if (m) return m[1];
  }
  return null;
}

export function requerir(nombres) {
  const faltan = nombres.filter((n) => !process.env[n]);
  if (faltan.length) {
    console.error(`Faltan variables de entorno: ${faltan.join(', ')}`);
    process.exit(1);
  }
  return Object.fromEntries(nombres.map((n) => [n, process.env[n]]));
}
