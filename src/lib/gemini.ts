import { ReportMetadata } from "../types";

/**
 * Saves a manually entered API key in local storage.
 * The client will automatically pass this in headers to proxy server endpoints.
 */
export function setApiKey(newKey: string) {
  localStorage.setItem("AIEDU_GEMINI_API_KEY", newKey);
}

/**
 * Utility to construct fetch requests headers, adding custom set x-api-key if available.
 */
const getHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = localStorage.getItem("AIEDU_GEMINI_API_KEY");
  if (key) {
    headers["x-api-key"] = key;
  }
  return headers;
};

/**
 * Helper to extract and format clean, actionable error messages from the server response.
 */
async function handleResponseError(res: Response, defaultMessage: string): Promise<never> {
  let detail = "";
  try {
    const text = await res.clone().text();
    try {
      const data = JSON.parse(text);
      detail = data.error || data.message || JSON.stringify(data);
    } catch {
      detail = text.substring(0, 300);
    }
  } catch {
    detail = "No se pudo leer la respuesta del servidor.";
  }
  throw new Error(`${defaultMessage}. Detalles: ${detail}`);
}

/**
 * Proxy function to extract competence data from base64 image on the server.
 */
export async function extractDataFromImage(imageBase64: string, competenceNumber: number): Promise<string> {
  const res = await fetch("/api/gemini/extract-data", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ imageBase64, competenceNumber }),
  });
  
  if (!res.ok) {
    await handleResponseError(res, "Error al extraer datos cuantitativos de competencia");
  }
  
  const data = await res.json();
  return data.text;
}

/**
 * Proxy function to extract capacity stats from base64 image on the server.
 */
export async function extractCapacitiesFromImage(imageBase64: string): Promise<string> {
  const res = await fetch("/api/gemini/extract-capacities", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ imageBase64 }),
  });
  
  if (!res.ok) {
    await handleResponseError(res, "Error al extraer estadísticas de capacidades");
  }
  
  const data = await res.json();
  return data.text;
}

/**
 * Proxy function to identify image and parse it accordingly.
 */
export async function identifyAndExtractImage(imageBase64: string): Promise<any> {
  const res = await fetch("/api/gemini/identify-image", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ imageBase64 }),
  });
  
  if (!res.ok) {
    await handleResponseError(res, "Error al procesar e identificar la imagen");
  }
  
  return await res.json();
}

/**
 * Proxy function to generate the final pedagogical diagnosis report.
 */
export async function generateFinalReport(metadata: ReportMetadata, competences: any[]): Promise<string> {
  const res = await fetch("/api/gemini/generate-report", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ metadata, competences }),
  });
  
  if (!res.ok) {
    await handleResponseError(res, "Error al procesar el Informe Diagnostico");
  }
  
  const data = await res.json();
  return data.text;
}

/**
 * Proxy function to generate customized planning documents (Programación Anual, Unidad de Aprendizaje, o Sesión).
 */
export async function generatePedagogicalDocument(
  metadata: ReportMetadata,
  reportContext: string,
  request: string,
  calendarImage: string | null = null
): Promise<string> {
  const res = await fetch("/api/gemini/generate-pedagogical-doc", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ metadata, reportContext, request, calendarImage }),
  });
  
  if (!res.ok) {
    await handleResponseError(res, "Error al generar el documento pedagógico");
  }
  
  const data = await res.json();
  return data.text;
}
