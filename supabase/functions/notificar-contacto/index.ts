/**
 * CAP — aviso por email de nuevo contacto.
 *
 * Se dispara con un Database Webhook de Supabase: cada INSERT en
 * `clientes_web` llama a esta función, que envía un email a AVISO_PARA con los
 * datos del formulario.
 *
 * El webhook manda el registro completo en `record`. Los nombres de columna
 * son los que escribe assets/js/contact-form.js:
 *
 *   nombre_contacto · nombre_negocio · email · mensaje · origen
 *
 * Variables de entorno (Supabase → Edge Functions → Secrets):
 *
 *   RESEND_API_KEY    obligatoria — clave de Resend (re_...)
 *   AVISO_PARA        destino del aviso (por defecto lluismoxo@gmail.com)
 *   AVISO_DESDE       remitente; debe ser de un dominio verificado en Resend.
 *                     Sin dominio propio verificado, usa onboarding@resend.dev
 *   WEBHOOK_SECRET    obligatorio: la función
 *                     rechaza las peticiones que no lleven esa cabecera
 *
 * Devuelve siempre 200 cuando el registro llega bien, aunque falle el email:
 * el contacto ya está guardado en la base de datos y no queremos que Supabase
 * reintente el webhook indefinidamente. Los fallos quedan en los logs.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

interface ContactoRecord {
  id?: number | string;
  nombre_contacto?: string | null;
  nombre_negocio?: string | null;
  email?: string | null;
  mensaje?: string | null;
  origen?: string | null;
  created_at?: string | null;
}

/** Escapa el texto del usuario antes de meterlo en el HTML del email. */
function esc(value: unknown): string {
  const s = value == null ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fecha(iso?: string | null): string {
  const candidate = iso ? new Date(iso) : new Date();
  const d = Number.isNaN(candidate.getTime()) ? new Date() : candidate;
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(d);
}

function construirEmail(r: ContactoRecord) {
  const nombre = (r.nombre_contacto || "").trim() || "Sin nombre";
  const empresa = (r.nombre_negocio || "").trim();
  const email = (r.email || "").trim();
  const mensaje = (r.mensaje || "").trim();

  const fila = (etiqueta: string, valor: string) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eceff1;color:#61707a;
                 font-size:13px;width:150px;vertical-align:top">${esc(etiqueta)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eceff1;color:#0c0d0d;
                 font-size:15px;vertical-align:top">${valor}</td>
    </tr>`;

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#f5f7f8;
     font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#0c0d0d;border-radius:12px 12px 0 0;padding:22px 26px">
      <p style="margin:0;color:#00e599;font-size:11px;letter-spacing:.12em;
                text-transform:uppercase;font-weight:600">CAP Consultor</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:600">
        Nuevo contacto desde la web</h1>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;padding:8px 26px 26px">
      <table style="width:100%;border-collapse:collapse">
        ${fila("Nombre", esc(nombre))}
        ${empresa ? fila("Empresa", esc(empresa)) : ""}
        ${email ? fila("Email", `<a href="mailto:${esc(email)}" style="color:#0a7d5a">${esc(email)}</a>`) : ""}
        ${fila("Recibido", esc(fecha(r.created_at)))}
        ${r.origen ? fila("Origen", esc(r.origen)) : ""}
      </table>
      ${
        mensaje
          ? `<p style="margin:22px 0 6px;color:#61707a;font-size:13px">Mensaje</p>
             <div style="background:#f5f7f8;border-radius:8px;padding:14px 16px;
                         color:#0c0d0d;font-size:15px;line-height:1.55;
                         white-space:pre-wrap">${esc(mensaje)}</div>`
          : `<p style="margin:22px 0 0;color:#8b979e;font-size:14px;font-style:italic">
               No ha dejado mensaje.</p>`
      }
      ${
        email
          ? `<a href="mailto:${esc(email)}"
                style="display:inline-block;margin-top:24px;background:#0c0d0d;color:#fff;
                       text-decoration:none;padding:11px 20px;border-radius:999px;
                       font-size:14px;font-weight:500">Responder a ${esc(nombre)}</a>`
          : ""
      }
    </div>
    <p style="margin:18px 0 0;color:#8b979e;font-size:12px;text-align:center">
      Aviso automático · tabla clientes_web · capconsultor.eu</p>
  </div>
</body></html>`;

  const texto = [
    "Nuevo contacto desde la web",
    "",
    `Nombre:   ${nombre}`,
    empresa ? `Empresa:  ${empresa}` : null,
    email ? `Email:    ${email}` : null,
    `Recibido: ${fecha(r.created_at)}`,
    r.origen ? `Origen:   ${r.origen}` : null,
    "",
    mensaje ? `Mensaje:\n${mensaje}` : "No ha dejado mensaje.",
  ]
    .filter(Boolean)
    .join("\n");

  return { html, texto, nombre, empresa, email };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Fail closed if authentication configuration is missing.
  const secret = Deno.env.get("WEBHOOK_SECRET");
  const supplied = req.headers.get("x-webhook-secret") || "";
  const encoder = new TextEncoder();
  const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  const [expected, received] = await Promise.all([hash(secret || ""), hash(supplied)]);
  let difference = 0;
  for (let i=0; i<expected.length; i++) difference |= expected[i] ^ received[i];
  if (!secret || !supplied || difference !== 0) {
    return Response.json({error:"no autorizado"}, {status:401});
  }
  if (!/^application\/json(?:;|$)/i.test(req.headers.get("content-type") || "")) return Response.json({error:"formato inválido"},{status:415});
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("Falta RESEND_API_KEY en los secrets de la función");
    return new Response(JSON.stringify({ error: "sin configurar" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const para = Deno.env.get("AVISO_PARA") || "lluismoxo@gmail.com";
  const desde = Deno.env.get("AVISO_DESDE") || "onboarding@resend.dev";

  let payload: { type?: string; table?: string; record?: ContactoRecord };
  try {
    const reader = req.body?.getReader();
    if (!reader) throw new Error("Empty body");
    const chunks: Uint8Array[] = []; let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>131072){await reader.cancel();return Response.json({error:"demasiado grande"},{status:413});}chunks.push(value);}
    const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
    payload = JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    return new Response(JSON.stringify({ error: "cuerpo no es JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!payload || typeof payload!=="object" || (payload.table && payload.table!=="clientes_web")) return Response.json({error:"evento inválido"},{status:400});
  const record = payload.record;
  if (!record || typeof record!=="object" || Array.isArray(record)) {
    return new Response(JSON.stringify({ error: "falta record" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // El webhook se configura solo para INSERT, pero si alguien lo amplía a
  // UPDATE no queremos un aviso por cada edición.
  if (payload.type && payload.type !== "INSERT") {
    return new Response(JSON.stringify({ ok: true, ignorado: payload.type }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  for(const [key,max] of Object.entries({nombre_contacto:120,nombre_negocio:160,email:254,mensaje:4000,origen:40,created_at:64})){
    const value=record[key as keyof ContactoRecord];
    if(value!=null && (typeof value!=="string" || value.length>max))return Response.json({error:"registro inválido"},{status:400});
  }
  if(record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(record.email))return Response.json({error:"email inválido"},{status:400});
  const { html, texto, nombre, empresa, email } = construirEmail(record);
  const asunto = empresa
    ? `Nuevo contacto: ${nombre} (${empresa})`.replace(/[\r\n]/g," ")
    : `Nuevo contacto: ${nombre}`.replace(/[\r\n]/g," ");

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        from: `CAP Consultor <${desde}>`,
        to: [para],
        subject: asunto,
        html,
        text: texto,
        // Responder al email va directo al cliente, no a Resend.
        ...(email ? { reply_to: email } : {}),
      }),
    });

    await res.text();
    if (!res.ok) {
      // 200 a propósito: el contacto ya está guardado y reintentar no ayuda.
      console.error("Resend ha fallado", res.status);
      return new Response(
        JSON.stringify({ ok: false, email_enviado: false, estado: res.status }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log("Aviso enviado");
    return new Response(JSON.stringify({ ok: true, email_enviado: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error llamando a Resend");
    return new Response(
      JSON.stringify({ ok: false, email_enviado: false, error: "proveedor no disponible" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
});
