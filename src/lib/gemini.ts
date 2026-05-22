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
 * Proxy function to extract competence data from base64 image on the server.
 */
export async function extractDataFromImage(imageBase64: string, competenceNumber: number): Promise<string> {
  const res = await fetch("/api/gemini/extract-data", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ imageBase64, competenceNumber }),
  });
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al extraer datos cuantitativos de competencia");
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
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al extraer estadísticas de capacidades");
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
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al procesar e identificar la imagen");
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
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al procesar el Informe Diagnostico");
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
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al generar el documento pedagógico");
  }
  
  const data = await res.json();
  return data.text;
}
