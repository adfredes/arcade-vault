import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type ContactPayload = {
  name: string;
  email: string;
  msg: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ContactPayload;
  const { name, email, msg } = body;

  if (!name || !email || !msg) {
    return Response.json({ error: "Todos los campos son requeridos." }, { status: 400 });
  }

  const { error } = await resend.emails.send({
    from: "Arcade Vault <onboarding@resend.dev>",
    to: ["adfredes@gmail.com"],
    subject: "Nuevo mensaje de contacto — Arcade Vault",
    text: `Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${msg}`,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
