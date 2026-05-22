import { GoogleGenAI, Type } from "@google/genai";
import { ReportMetadata } from "../types";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in the environment.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export async function extractDataFromImage(imageBase64: string, competenceNumber: number): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Actúa como un especialista en análisis de datos pedagógicos. 
    Extrae con precisión todos los datos numéricos de esta imagen de resultados de evaluación diagnóstica para la Competencia ${competenceNumber}.
    La imagen contiene una tabla con:
    - Secciones del grado
    - N° de estudiantes evaluados
    - Resultados por nivel de logro: En inicio, En proceso, Logrado y Destacado (con N° y %).

    Devuelve los datos en un formato estructurado (JSON) que incluya:
    - competencia: ${competenceNumber}
    - resultados: un array de objetos por sección con { seccion, evaluados, inicio: { n, pct }, proceso: { n, pct }, logrado: { n, pct }, destacado: { n, pct } }
    
    Verifica internamente que los porcentajes sean coherentes con el N° de estudiantes evaluados. 
    Si detectas inconsistencias menores, ajústalos y añade una nota explicativa.
  `;

  const imagePart = {
    inlineData: {
      mimeType: "image/png", // Assuming PNG, but could be dynamic
      data: imageBase64.split(",")[1] || imageBase64,
    },
  };

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [imagePart, { text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          competence: { type: Type.NUMBER },
          resultados: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                seccion: { type: Type.STRING },
                evaluados: { type: Type.NUMBER },
                inicio: {
                  type: Type.OBJECT,
                  properties: { n: { type: Type.NUMBER }, pct: { type: Type.NUMBER } },
                  required: ["n", "pct"]
                },
                proceso: {
                  type: Type.OBJECT,
                  properties: { n: { type: Type.NUMBER }, pct: { type: Type.NUMBER } },
                  required: ["n", "pct"]
                },
                logrado: {
                  type: Type.OBJECT,
                  properties: { n: { type: Type.NUMBER }, pct: { type: Type.NUMBER } },
                  required: ["n", "pct"]
                },
                destacado: {
                  type: Type.OBJECT,
                  properties: { n: { type: Type.NUMBER }, pct: { type: Type.NUMBER } },
                  required: ["n", "pct"]
                },
              },
              required: ["seccion", "evaluados", "inicio", "proceso", "logrado", "destacado"]
            }
          },
          notas: { type: Type.STRING, description: "Notas sobre correcciones o inconsistencias detectadas" }
        },
        required: ["competence", "resultados"]
      }
    }
  });

  return response.text || "";
}

export async function extractCapacitiesFromImage(imageBase64: string): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Actúa como un especialista en análisis de datos pedagógicos. 
    Extrae con precisión todos los datos numéricos de esta imagen de la "Estadística de las capacidades según competencia".
    La imagen contiene una tabla con:
    - Secciones del grado
    - Capacidades evaluadas por competencia
    - Porcentajes (%) de logro por cada capacidad y sección.

    Devuelve los datos en un formato estructurado (JSON) que incluya:
    - resultados: un array de objetos por sección con { seccion, capacidades: [{ nombre, porcentaje }] }
  `;

  const imagePart = {
    inlineData: {
      mimeType: "image/png",
      data: imageBase64.split(",")[1] || imageBase64,
    },
  };

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [imagePart, { text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          resultados: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                seccion: { type: Type.STRING },
                capacities: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      nombre: { type: Type.STRING },
                      porcentaje: { type: Type.NUMBER }
                    },
                    required: ["nombre", "porcentaje"]
                  }
                }
              },
              required: ["seccion", "capacities"]
            }
          }
        },
        required: ["resultados"]
      }
    }
  });

  return response.text || "";
}

export async function identifyAndExtractImage(imageBase64: string): Promise<any> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Actúa como un especialista en análisis de datos pedagógicos. 
    Analiza esta imagen y determina si es:
    1. Una tabla de "Resultados por nivel de logro" (contiene secciones, N° de estudiantes, y niveles Inicio, Proceso, Logrado, Destacado).
    2. Una tabla de "Estadística de las capacidades" (contiene secciones y porcentajes por capacidades específicas).

    Luego, extrae los datos según el tipo identificado.
    
    Si es TIPO 1 (Resultados):
    - Extrae el número de competencia si aparece (ej. "Competencia 1").
    - Extrae los resultados por sección: { seccion, evaluados, inicio: { n, pct }, proceso: { n, pct }, logrado: { n, pct }, destacado: { n, pct } }.

    Si es TIPO 2 (Capacidades):
    - Extrae los resultados por sección: { seccion, capacidades: [{ nombre, porcentaje }] }.

    Devuelve un JSON con:
    {
      "type": "RESULTS" | "CAPACITIES",
      "competenceNumber": number | null,
      "data": { ...datos extraídos... }
    }
  `;

  const imagePart = {
    inlineData: {
      mimeType: "image/png",
      data: imageBase64.split(",")[1] || imageBase64,
    },
  };

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [imagePart, { text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["RESULTS", "CAPACITIES"] },
          competenceNumber: { type: Type.NUMBER, nullable: true },
          data: { type: Type.OBJECT }
        },
        required: ["type", "data"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function generateFinalReport(metadata: ReportMetadata, competences: any[]): Promise<string> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `
    Actúa como un ESPECIALISTA EXPERTO EN PLANIFICACIÓN CURRICULAR Y GESTIÓN PEDAGÓGICA DEL MINEDU – PERÚ. 
    Tu dominio incluye el Currículo Nacional de la Educación Básica (CNEB), evaluación formativa, competencias, capacidades, estándares de aprendizaje, enfoques transversales, evidencias de aprendizaje, criterios de evaluación e instrumentos de evaluación.

    TU FUNCIÓN: Elaborar un Informe de Evaluación Diagnóstica con redacción técnica, clara, coherente, contextualizada y lista para usar.

    CONDICIONES DE TRABAJO:
    1. ENFOQUE GENERAL: Alineado al CNEB, lenguaje pedagógico profesional, preciso y actualizado.
    2. CONTEXTUALIZACIÓN: Basado en los datos reales extraídos de las imágenes.
    3. COHERENCIA: Asegura coherencia entre competencia, capacidades, desempeños, propósito, criterios, evidencias e instrumentos.

    DATOS DE ENTRADA:
    Metadatos: ${JSON.stringify(metadata)}
    Datos de Competencias y Capacidades Extraídos: ${JSON.stringify(competences)}

    ESTRUCTURA OBLIGATORIA DEL INFORME (NIVEL 0 - ANÁLISIS Y PRIORIZACIÓN):
    
    1. ENCABEZADO INSTITUCIONAL (Institución, N° de informe, Para/De, Asunto, Área, Fecha)
    2. I. DATOS INFORMATIVOS (Tabla resumida: I.E., Área, Docente, Grado, Secciones)
    
    3. II. FUENTES DE DATOS (OBLIGATORIO)
       - Especificar si es: Evaluación diagnóstica actual, Porcentajes de logro año anterior, o Combinada.
    
    4. III. RESULTADOS CUANTITATIVOS CONSOLIDADOS (ESTILO MAPA DE CALOR E ICONOS)
       - **Consolidado General**: Tabla de porcentajes por competencia (C/B/A/AD) validando que sumen 100%.
       - **Mapa de Calor de Logros (Consolidado)**: Usa una tabla donde cada celda represente el nivel de logro con iconos/emojis de colores:
         * 🟦 Destacado (AD)
         * 🟩 Logrado (A)
         * 🟧 En Proceso (B)
         * 🟥 En Inicio (C)
       - **Distribución por Competencia**: Representa el avance con barras de iconos (ej. 🟦🟦🟩🟩🟧🟥) para una visualización rápida y atractiva.

    5. IV. ANÁLISIS DETALLADO Y RECOMENDACIONES POR SECCIÓN (MAPA DE CALOR INDIVIDUAL)
       - **IMPORTANTE**: Genera una subsección por cada sección evaluada (ej. Sección A, Sección B, etc.).
       - Para cada sección, incluye:
         1. **Tabla de Resultados de la Sección**: Una tabla con mapa de calor (iconos 🟦🟩🟧🟥) que muestre el desempeño de esa sección específica en las competencias evaluadas.
         2. **Recomendaciones Pedagógicas Específicas**: 2-3 recomendaciones concretas basadas únicamente en los resultados de esa sección (ej. "En la Sección A, se requiere enfatizar la capacidad X debido al alto porcentaje en Inicio").

    6. V. ANÁLISIS CUALITATIVO GENERAL Y PATRONES DE APRENDIZAJE
       - Interpreta qué capacidades específicas fallan a nivel de todo el grado.
       - Detecta patrones comunes (¿resolución?, ¿razonamiento?, ¿comunicación?).

    7. VI. MATRIZ DE PRIORIZACIÓN CURRICULAR (Regla de decisión: ≥50% en C/B = REFUERZO)
       | Competencia | % C+B | Clasificación | Justificación |
       |-------------|-------|---------------|---------------|
       - Clasificaciones: REFUERZO INTENSIVO (≥50% C/B), CONSOLIDACIÓN (30-49% C/B), MANTENIMIENTO (≥70% A/AD), AMPLIACIÓN (≥40% AD).

    8. VII. RECOMENDACIONES GENERALES Y DISTRIBUCIÓN EN UNIDADES (${metadata.unitCount} UNIDADES)
       - **Recomendación General**: Estrategia macro para el grado/área basada en el diagnóstico consolidado.
       - **Distribución en Unidades**:
         * La Unidad 1 DEBE incluir el tiempo de evaluación diagnóstica.
         * Distribuye las competencias en las ${metadata.unitCount} unidades solicitadas.
         * Asigna máximo 2 competencias por unidad.
         * Distribuye REFUERZO en las primeras unidades según prioridad.
         * Acompaña refuerzo con una competencia sólida.
    
    9. VIII. CONCLUSIONES Y ALERTAS TEMPRANAS
       - Resumen ejecutivo (1 párrafo).
       - Alertas de seguimiento (qué observar).
    
    10. IX. INSUMO PARA NIVEL 1 (PROGRAMACIÓN ANUAL)
       - IMPORTANTE: Esta sección NO debe ser visible para el usuario final. Envuélvela OBLIGATORIAMENTE entre las etiquetas <contexto_interno> y </contexto_interno>.
       - Incluye el código o resumen ejecutivo listo para ser usado por el Asistente de Planificación.

    CRITERIOS TÉCNICOS DE PRIORIZACIÓN:
    - C (Inicio): Saberes previos insuficientes. PRIORIDAD MÁXIMA (3+ unidades).
    - B (Proceso): En construcción. PRIORIDAD ALTA (2-3 unidades).
    - A (Esperado): Lograda. PRIORIDAD ESTÁNDAR (1-2 unidades).
    - AD (Destacado): Supera lo esperado. PRIORIDAD MÍNIMA (1 unidad).

    REGLAS INQUEBRANTABLES:
    - TODA competencia de refuerzo debe justificarse con el % en C/B.
    - Las visualizaciones deben ser interpretables en Markdown.
    - Redacción: Técnico-pedagógica peruana (CNEB).
    - Formato: Markdown limpio con tablas alineadas.

    IMPORTANTE: PROHIBIDO SIMULAR DATOS. Usa solo lo extraído de las imágenes.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text || "";
}

export async function generatePedagogicalDocument(metadata: ReportMetadata, reportContext: string, request: string, calendarImage: string | null = null): Promise<string> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `
    Actúa como un ESPECIALISTA EXPERTO EN PLANIFICACIÓN CURRICULAR Y GESTIÓN PEDAGÓGICA DEL MINEDU – PERÚ.
    
    CONTEXTO DEL INFORME DIAGNÓSTICO (USA ESTA INFORMACIÓN COMO BASE PARA IDENTIFICAR NECESIDADES Y PRIORIDADES):
    ${reportContext}

    DATOS INSTITUCIONALES:
    ${JSON.stringify(metadata)}
    NIVEL: ${metadata.level}

    SOLICITUD DEL USUARIO:
    ${request}

    INSTRUCCIONES GENERALES:
    - Todo debe estar alineado al Currículo Nacional del Perú (CNEB) y al nivel especificado (${metadata.level}).
    - Usa lenguaje pedagógico profesional, preciso y actualizado.
    - Contextualiza la propuesta a la realidad de la I.E., grado, ciclo, nivel y área.
    - Prioriza la evaluación formativa.
    - Asegura coherencia entre competencia, capacidades, desempeños, propósito, criterios, evidencias e instrumentos.
    - Si se solicita "PROGRAMACIÓN ANUAL" (Nivel 1):
      * Utiliza obligatoriamente la "RECOMENDACIÓN DE DISTRIBUCIÓN DE COMPETENCIAS" y la "MATRIZ DE PRIORIZACIÓN" del Informe Diagnóstico (Nivel 0).
      * Considera un total de ${metadata.unitCount} unidades.
      * La UNIDAD 1 debe contemplar el tiempo de evaluación diagnóstica.
      * El campo temático / eje articulador principal es: ${metadata.thematicField}.
      * Justifica cada unidad de la Programación Anual mencionando: "Esta unidad prioriza [competencia X] por diagnóstico que mostró [% en C/B]".
      * RELACIONA LOS PRODUCTOS DE CADA UNIDAD con la temática propia para el grado (${metadata.grade}) y el nivel (${metadata.level}). Los productos deben ser auténticos y retadores.
      * Si se proporciona una imagen de calendarización, úsala para definir las fechas de inicio y término de las unidades.

    ESTRUCTURAS OBLIGATORIAS SEGÚN EL PRODUCTO:
    - PROGRAMACIÓN ANUAL (Nivel 1): Debe seguir estrictamente esta estructura de 13 secciones basada en el esquema oficial:
      1. I. DATOS INFORMATIVOS (GERENCIA REGIONAL, UGEL, I.E., CICLO, ÁREA, GRADO Y SECCIÓN, HORAS SEMANALES, DOCENTE, AÑO).
      2. II. POTENCIALIDADES Y/O PROBLEMÁTICAS DEL CONTEXTO (Descripción detallada del entorno local y regional).
      3. III. OPORTUNIDADES Y/O PROBLEMÁTICAS EN LA IE (Descripción de la realidad institucional).
      4. IV. CARACTERIZACIÓN DE LOS ESTUDIANTES SEGÚN CICLO (Tabla de 2 columnas: CRITERIOS | Ciclo VI. Filas: ASPECTO COGNITIVO, ASPECTO FÍSICO, ASPECTO EMOCIONAL, INTERESES/GUSTOS, APRENDIZAJES DE LA COMUNIDAD).
      5. V. DESCRIPCIÓN GENERAL DEL ÁREA (Propósito y enfoque del área según el CNEB).
      6. VI. PROPÓSITO DE APRENDIZAJE (Tabla: COMPETENCIAS-CAPACIDADES | ESTÁNDARES -VI CICLO. Incluye competencias de área, transversales y enfoques transversales).
      7. VII. METAS DE APRENDIZAJE E IDENTIFICACIÓN DE NECESIDADES POR SECCIONES (IMPORTANTE: Genera una tabla detallada por CADA SECCIÓN [A, B, C, etc.] identificada en el informe. Cada tabla debe incluir por competencia: Resultados cuantitativos, Meta 2026, Análisis cualitativo, Necesidades de aprendizaje, Propuesta de mejora. Utiliza los datos específicos de cada sección del Informe Nivel 0).
      8. VIII. TEMPORALIZACIÓN (Tabla: UNIDAD | INICIO | TÉRMINO | N.° SEMANAS | N.° HORAS | BIMESTRE (I, II, III, IV) | ENTREGA DE UNIDADES. Incluye Situación diagnóstica en la Unidad 1, y el resto de unidades hasta completar las ${metadata.unitCount} solicitadas).
      9. IX. ORGANIZACIÓN DE LAS UNIDADES DIDÁCTICAS (Incluye dos matrices: A. Matriz de unidades (Título, Situación, Evidencia, Competencias) y B. Matriz de Enfoques Transversales por unidad).
      10. X. ESTRATEGIAS METODOLÓGICAS (Metodologías activas: ABP, Aprendizaje basado en retos, Indagación, etc.).
      11. XI. RECURSOS Y MATERIALES (Tipos de recursos y materiales según la NT-RM 501-MINEDU).
      12. XII. EVALUACIÓN FORMATIVA (Orientaciones para la evaluación Diagnóstica, Formativa y Certificadora).
      13. XIII. REFERENCIAS (Bibliografía para el estudiante y el docente).
      
      REGLAS DE FIDELIDAD PARA PROGRAMACIÓN ANUAL:
      - NO resumas, NO parafrasees, NO agregues contenido nuevo innecesario.
      - Respeta mayúsculas, acentos, numeración, espacios y repeticiones literales.
      - Usa Markdown para tablas; emplea <br> para saltos de línea dentro de celdas.
      - Si una celda debe estar vacía, déjala vacía: |  |.
      - Mantén la estructura jerárquica de secciones (1 a 13) con títulos exactos.
      - Al final, incluye: "Fecha: San Pedro de Lloc, …de marzo de 2026".

    - UNIDAD DE APRENDIZAJE: Debe seguir estrictamente esta estructura de 11 secciones basada en el esquema oficial referencial para Ciencia y Tecnología. IMPORTANTE: Solo debes incluir las competencias que fueron asignadas a esta unidad específica en la "Distribución de Competencias" de la Programación Anual o el Informe Diagnóstico.
      1. I. DATOS INFORMATIVOS (I.E., Área: Ciencia y Tecnología, Grado/Sección, Horas semanales, Duración [Fecha de Inicio y Término], Docente responsable).
      2. II. SITUACIÓN SIGNIFICATIVA (Planteamiento del problema o reto contextualizado).
      3. III. PRODUCTO IMPORTANTE (Evidencia principal o prototipo a desarrollar).
      4. IV. NECESIDADES DE APRENDIZAJE (Tabla: Competencia | Necesidades de Aprendizaje. Incluye "Capacidades prioritarias" como lista de viñetas dentro de la celda de necesidades).
      5. V. PROPÓSITO Y EVALUACIÓN DE APRENDIZAJE (Genera una tabla por cada competencia del área. Columnas: CAPACIDADES, CRITERIOS DE EVALUACIÓN, EVIDENCIA, INSTRUMENTO. Incluye el ESTÁNDAR del ciclo arriba de la tabla).
      6. VI. COMPETENCIAS TRANSVERSALES (Tabla: COMPETENCIAS TRANSVERSALES/CAPACIDADES | ESTANDAR. Incluye "Se desenvuelve en entornos virtuales" y "Gestiona su aprendizaje").
      7. VII. ENFOQUES TRANSVERSALES PARA EL DESARROLLO DEL PERFIL DE EGRESO (Tabla: ENFOQUE, VALORES, ACTITUDES).
      8. VIII. SECUENCIA DIDÁCTICA DE SESIONES (Mínimo 6 sesiones. Cada una con: Sesión # [horas], Título, Campo temático, Actividades [lista de viñetas]).
      9. IX. ESTRATEGIAS METODOLÓGICAS (Lista de metodologías activas: Aula invertida, ABP, Trabajo colaborativo, Evaluación formativa, etc.).
      10. X. RECURSOS (Tabla: RECURSOS | MATERIALES. Categoriza por Humanos, Tecnológicos, Impresos, etc.).
      11. XI. REFERENCIAS (Bibliografía para el docente y estudiante siguiendo formato APA).
    - SESIÓN DE APRENDIZAJE: Debe seguir estrictamente esta estructura de 5 secciones y cierre:
      * 📋 ENCABEZADO GENERAL:
        - Institución: "INSTITUCIÓN EDUCATIVA EMBLEMÁTICA JOSÉ ANDRÉS RÁZURI"
        - Título del Documento (Nomenclatura): **U[N° Unidad]-S[N° Sesión]-[Título]** (Ej: U1-S1-Explorando los números).
        - Título de la sesión: [Línea punteada para completar]
        - Identificador: "SESIÓN N° X/Y" (donde X es el número de sesión y Y el total).
      * 1️⃣ SECCIÓN: DATOS INFORMATIVOS (Usa lista estructurada con etiquetas y dos puntos, NO tabla):
        - 1.a Unidad de Gestión Local: Pacasmayo
        - 1.b Institución Educativa: "José Andrés Rázuri"
        - 1.c Área: [Área correspondiente]
        - 1.d Grado: [Grado]
        - 1.e Sección: [Sección]
        - 1.f Docente Responsable: [espacio en blanco]
        - 1.g Fecha: [espacio en blanco]
        - 1.h Duración: [Ej: 3h]
      * 2️⃣ SECCIÓN: PROPÓSITO DE APRENDIZAJE (Tres tablas diferenciadas):
        - A. Tabla Principal de Competencia Específica (5 columnas: COMPETENCIA, CAPACIDAD, CRITERIO DE EVALUACIÓN, EVIDENCIA, INSTRUMENTO). IMPORTANTE: Usa fusión vertical visual para la COMPETENCIA. Los criterios deben ser detallados y vinculados al contexto del informe diagnóstico.
        - B. Tabla de Competencia Transversal (3 columnas: COMPETENCIA TRANSVERSAL, CAPACIDAD, DESEMPEÑO DEL GRADO).
        - C. Tabla de Enfoque Transversal (3 columnas: ENFOQUE TRANSVERSAL, VALORES, ACTITUDES). La numeración de actitudes debe ser correlativa a los valores.
      * 3️⃣ SECCIÓN: SECUENCIA DIDÁCTICA (Tabla de 3 columnas: MOMENTO, ACTIVIDADES, T):
        - MOMENTO: INICIO, DESARROLLO, CIERRE.
        - ACTIVIDADES: 
          * INICIO: Debe incluir subsecciones: PRECLASE, Motivación, Saberes previos, Problematización, Propósito de aprendizaje.
          * DESARROLLO: "Gestión y acompañamiento del desarrollo de la competencia".
          * CIERRE: "Evaluación / Metacognición".
        - T: Columna para el tiempo en minutos.
      * 4️⃣ SECCIÓN: MATERIALES Y RECURSOS DIDÁCTICOS (Tabla de 2 columnas: RECURSOS, MATERIALES).
      * 5️⃣ SECCIÓN: REFERENCIAS (Tabla de 2 columnas: Para el docente, Para el estudiante. Usa numeración "1." en las celdas).
      * 📝 PIE DE PÁGINA Y CIERRE: 
        - Líneas de firma: "DOCENTE V°B°" y "COORDINADOR PEDAGÓGICO".
        - Referencia final: "INSTRUMENTO DE EVALUACIÓN" (al final del documento).
    - INSTRUMENTOS (RÚBRICA/LISTA DE COTEJO): Título, competencia, evidencia, criterios de evaluación, niveles de logro/descriptores precisos y observables.

    FORMATO: Markdown profesional listo para copiar a Word. Usa tablas donde sea necesario. 
    ESTILO: El texto debe estar redactado para ser JUSTIFICADO. Las tablas deben estar diseñadas para ocupar todo el ancho de la página. 
    No incluyas charla adicional.
  `;

  const contents: any[] = [{ text: prompt }];
  if (calendarImage) {
    contents.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: calendarImage.split(',')[1]
      }
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contents },
  });

  return response.text || "";
}
