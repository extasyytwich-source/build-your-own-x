// Correo transaccional (por ahora, solo el de "recuperar contraseña") vía la
// API de Resend (resend.com) — un solo POST HTTP, sin SDK ni dependencia
// nueva. Sin RESEND_API_KEY configurado, el enlace queda solo en el log del
// servidor en vez de enviarse: alcanza para probar el flujo completo en
// desarrollo, pero en producción hace falta la llave real.
const RESEND_API = 'https://api.resend.com/emails';

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

// Nunca debe reventar el flujo que la llama (pedir un enlace no debe fallar
// visiblemente por un problema del proveedor de correo) — el error queda
// solo en el log, y el llamador ya responde un mensaje genérico igual.
export async function sendEmail({ to, subject, html }) {
  if (!isEmailConfigured()) {
    console.log(`[email] RESEND_API_KEY no configurado — no se envió correo a ${to}. Asunto: "${subject}"`);
    return;
  }
  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Mostrador <onboarding@resend.dev>',
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error('Error enviando correo:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Error enviando correo:', err.message);
  }
}
