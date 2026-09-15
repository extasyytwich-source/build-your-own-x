import Anthropic from '@anthropic-ai/sdk';
import { getSetting } from './db.js';

// La API key puede venir de .env (uso como servidor/dev) o haberse guardado
// desde Ajustes en la base de datos (uso como app de escritorio, donde no hay
// un .env que el dueño de la tienda pueda editar). La de la base de datos
// gana si ambas están presentes, para que cambiarla desde la UI funcione de
// inmediato sin reiniciar el programa.
export async function getEffectiveApiKey(businessId) {
  const stored = await getSetting(businessId, 'anthropic_api_key');
  return stored || process.env.ANTHROPIC_API_KEY || null;
}

async function getClient(businessId) {
  const apiKey = await getEffectiveApiKey(businessId);
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

const SYSTEM_PROMPT = `Eres un asesor de negocio para el dueño de una tienda pequeña.
Recibes datos en JSON con las ganancias del mes, productos que hay que reponer,
alertas críticas de inventario, y una comparación entre el dinero que se
registró en caja contra las ventas calculadas del sistema.

Responde en español, en texto plano (sin markdown ni títulos), con un análisis
breve y directo de máximo 200 palabras que cubra en este orden:
1. Un resumen claro de las ganancias del mes.
2. Qué productos hay que reponer con más urgencia y por qué.
3. Las alertas críticas de inventario que no deberían ignorarse.
4. Si el dinero registrado en caja coincide con las ventas calculadas o si hay
   una diferencia/faltante que merezca atención.
5. Dos o tres recomendaciones concretas y accionables para el próximo mes.

Tono profesional pero cercano, como si le hablaras directamente al dueño de la
tienda. No inventes datos que no estén en el JSON.`;

export async function generateMonthlyAnalysis(businessId, stats, month) {
  const anthropic = await getClient(businessId);
  if (!anthropic) {
    const err = new Error(
      'Configura tu API key de Anthropic en Ajustes para habilitar el análisis con IA'
    );
    err.status = 400;
    throw err;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Mes analizado: ${month}\n\nDatos del mes:\n${JSON.stringify(stats, null, 2)}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.text?.trim() || '';
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      const e = new Error('La ANTHROPIC_API_KEY configurada no es válida');
      e.status = 401;
      throw e;
    }
    if (err instanceof Anthropic.RateLimitError) {
      const e = new Error('Se alcanzó el límite de uso de la API de IA, intenta más tarde');
      e.status = 429;
      throw e;
    }
    if (err instanceof Anthropic.APIError) {
      const e = new Error(`Error de la API de IA: ${err.message}`);
      e.status = 502;
      throw e;
    }
    throw err;
  }
}
