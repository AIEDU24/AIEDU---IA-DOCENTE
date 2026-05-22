/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  Loader2, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Download,
  AlertCircle,
  AlertTriangle,
  Settings,
  School,
  User,
  Calendar,
  BookOpen,
  Layers,
  Copy,
  Check,
  Sparkles,
  Wand2,
  MessageSquare,
  Lightbulb
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import * as mammoth from 'mammoth';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { cn, resizeImage } from './lib/utils';
import { 
  extractDataFromImage, 
  extractCapacitiesFromImage, 
  generateFinalReport,
  generatePedagogicalDocument,
  identifyAndExtractImage,
  setApiKey
} from './lib/gemini';
import { ReportMetadata, AppState, CompetenceEntry } from './types';

export default function App() {
  const [state, setState] = useState<AppState>('INITIAL');
  const [copied, setCopied] = useState(false);
  const [metadata, setMetadata] = useState<ReportMetadata>({
    institution: '',
    reportNumber: 'INFORME N° 001-2026-IE-DOCENTE',
    to: 'DIRECTOR(A) DE LA INSTITUCIÓN EDUCATIVA',
    from: 'ciproture@gmail.com',
    subject: 'INFORME DE RESULTADOS DE LA EVALUACIÓN DIAGNÓSTICA 2026',
    area: '',
    grade: '',
    level: '',
    sections: '',
    date: new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }),
    unitCount: '8',
    thematicField: ''
  });

  const [competences, setCompetences] = useState<CompetenceEntry[]>([
    { id: 1, competenceImage: null, capacitiesImage: null, competenceData: null, capacitiesData: null, status: 'idle' }
  ]);

  const [finalReport, setFinalReport] = useState<string>('');
  const [pedagogicalDoc, setPedagogicalDoc] = useState<string>('');
  const [lastUnitDoc, setLastUnitDoc] = useState<string>('');
  const [calendarImage, setCalendarImage] = useState<string | null>(null);
  const [docRequest, setDocRequest] = useState<string>('');
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReadingWord, setIsReadingWord] = useState(false);
  const [isUploadedDoc, setIsUploadedDoc] = useState(false);
  const [lastGeneratedType, setLastGeneratedType] = useState<string | null>(null);
  const [currentUnit, setCurrentUnit] = useState<number>(0);
  const [currentSession, setCurrentSession] = useState<number>(0);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [manualApiKey, setManualApiKey] = useState(localStorage.getItem('AIEDU_GEMINI_API_KEY') || '');

  const handleSaveApiKey = () => {
    setApiKey(manualApiKey);
    setShowSettings(false);
    setError(null);
  };

  const handleMetadataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setMetadata(prev => ({ ...prev, [name]: value }));
  };

  const addCompetence = () => {
    setCompetences(prev => [...prev, { id: prev.length + 1, competenceImage: null, capacitiesImage: null, competenceData: null, capacitiesData: null, status: 'idle' }]);
  };

  const removeCompetence = (id: number) => {
    if (competences.length > 1) {
      setCompetences(prev => prev.filter(c => c.id !== id).map((c, i) => ({ ...c, id: i + 1 })));
    }
  };

  const handleCompetenceImageUpload = async (id: number, file: File) => {
    try {
      setCompetences(prev => prev.map(c => c.id === id ? { ...c, status: 'uploading' } : c));
      
      const base64 = await resizeImage(file);
      
      setCompetences(prev => prev.map(c => c.id === id ? { ...c, competenceImage: base64 } : c));
      
      const extractedData = await extractDataFromImage(base64, id);
      const cleanJson = extractedData.replace(/```json\n?|```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);
      
      setCompetences(prev => prev.map(c => c.id === id ? { 
        ...c, 
        competenceData: parsedData, 
        status: c.capacitiesData ? 'done' : 'uploading' 
      } : c));
    } catch (err) {
      console.error("Error extracting competence data:", err);
      setCompetences(prev => prev.map(c => c.id === id ? { ...c, status: 'error' } : c));
      setError(err instanceof Error ? err.message : "Error al procesar la imagen de la Competencia " + id);
    }
  };

  const handleCapacitiesImageUpload = async (id: number, file: File) => {
    try {
      setCompetences(prev => prev.map(c => c.id === id ? { ...c, status: 'uploading' } : c));
      
      const base64 = await resizeImage(file);
      
      setCompetences(prev => prev.map(c => c.id === id ? { ...c, capacitiesImage: base64 } : c));
      
      const extractedData = await extractCapacitiesFromImage(base64);
      const cleanJson = extractedData.replace(/```json\n?|```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);
      
      setCompetences(prev => prev.map(c => c.id === id ? { 
        ...c, 
        capacitiesData: parsedData, 
        status: c.competenceData ? 'done' : 'uploading' 
      } : c));
    } catch (err) {
      console.error("Error extracting capacities data:", err);
      setCompetences(prev => prev.map(c => c.id === id ? { ...c, status: 'error' } : c));
      setError(err instanceof Error ? err.message : "Error al procesar la estadística de capacidades de la Competencia " + id);
    }
  };

  const generateReport = async () => {
    if (!metadata.level) {
      setError("Por favor, selecciona el nivel (Primaria o Secundaria).");
      return;
    }
    if (competences.some(c => !c.competenceData || !c.capacitiesData)) {
      setError("Por favor, sube y procesa ambas imágenes (Competencia y Estadística) para cada competencia.");
      return;
    }

    setIsGenerating(true);
    setState('GENERATING');
    setError(null);

    try {
      const report = await generateFinalReport(metadata, competences);
      setFinalReport(report);
      setPedagogicalDoc('');
      setIsUploadedDoc(false);
      setState('COMPLETED');
    } catch (err) {
      console.error("Error generating report:", err);
      setError(err instanceof Error ? err.message : "Error al generar el informe final.");
      setState('COLLECTING');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePedagogicalDoc = async (customRequest?: string) => {
    const request = customRequest || docRequest;
    if (!request) return;
    setIsGeneratingDoc(true);
    setError(null);
    try {
      const doc = await generatePedagogicalDocument(metadata, finalReport, request, calendarImage);
      setPedagogicalDoc(doc);
      
      // Identify what was generated to show suggestions - PRIORITY: SESSION > UNIT
      const lowerRequest = request.toLowerCase();
      const lowerDoc = doc.toLowerCase();
      
      if (lowerRequest.includes('sesión') || lowerRequest.includes('sesion') || lowerDoc.includes('sesión') || lowerDoc.includes('sesion')) {
        setLastGeneratedType('SESSION');
        
        // Find session number
        let sessionMatch = doc.match(/sesión\s*(?:de\s+aprendizaje)?\s*(?:n°|nro|#)?\s*(\d+)/i) || 
                           doc.match(/S(\d+)/i) ||
                           doc.match(/sesión\s+(\d+)/i);
                           
        if (!sessionMatch) {
          sessionMatch = request.match(/sesión\s*(?:n°|nro|#)?\s*(\d+)/i) || 
                         request.match(/S(\d+)/i);
        }
        
        if (sessionMatch) setCurrentSession(parseInt(sessionMatch[1]));

        // Also try to update unit number if present in session document
        const unitInSession = doc.match(/unidad(?:\s+de\s+aprendizaje)?\s*(?:n°|nro|#)?\s*(\d+)/i) || 
                              doc.match(/U(\d+)/i);
        if (unitInSession) setCurrentUnit(parseInt(unitInSession[1]));
      }
      else if (lowerRequest.includes('unidad') || lowerDoc.includes('unidad')) {
        setLastGeneratedType('UNIT');
        setLastUnitDoc(doc); // Save unit doc for session extraction
        
        // Find unit number
        let unitMatch = doc.match(/unidad(?:\s+de\s+aprendizaje)?\s*(?:n°|nro|#)?\s*(\d+)/i) || 
                        doc.match(/U(\d+)/i);
        if (!unitMatch) {
          unitMatch = request.match(/unidad\s*(?:n°|nro|#)?\s*(\d+)/i) || 
                      request.match(/U(\d+)/i);
        }
        
        if (unitMatch) setCurrentUnit(parseInt(unitMatch[1]));
      }
      else if (lowerRequest.includes('programación') || lowerRequest.includes('programacion')) {
        setLastGeneratedType('PLANNING');
      } else {
        setLastGeneratedType(null);
      }
      
    } catch (err) {
      console.error("Error generating pedagogical document:", err);
      setError(err instanceof Error ? err.message : "Error al generar el documento pedagógico.");
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  const handleWordUpload = async (file: File, type: 'REPORT' | 'PLANNING' | 'UNIT') => {
    setIsReadingWord(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;
      
      // All uploaded docs act as context for the assistant
      setFinalReport(text);
      setPedagogicalDoc('');
      if (type === 'UNIT') setLastUnitDoc(text);
      setIsUploadedDoc(true);
      
      setState('COMPLETED');
    } catch (err) {
      console.error("Error reading Word file:", err);
      setError("Error al leer el archivo Word. Asegúrate de que sea un archivo .docx válido.");
    } finally {
      setIsReadingWord(false);
    }
  };

  const handleCalendarUpload = async (file: File) => {
    try {
      const base64 = await resizeImage(file);
      setCalendarImage(base64);
    } catch (err) {
      console.error(err);
      setError("Error al procesar la imagen de calendarización.");
    }
  };

  const handleBulkUpload = async (files: FileList) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsBulkProcessing(true);
    setBulkProgress({ current: 0, total: fileArray.length });
    setError(null);

    const processFile = async (file: File) => {
      try {
        const base64 = await resizeImage(file);
        const result = await identifyAndExtractImage(base64);
        
        setCompetences(prev => {
          let targetId = result.competenceNumber;
          
          // If no competence number was identified, try to find an empty slot
          if (!targetId) {
            const emptySlot = prev.find(c => 
              result.type === 'RESULTS' ? !c.competenceImage : !c.capacitiesImage
            );
            targetId = emptySlot ? emptySlot.id : prev.length + 1;
          }

          const existing = prev.find(c => c.id === targetId);
          
          if (existing) {
            return prev.map(c => c.id === targetId ? {
              ...c,
              ...(result.type === 'RESULTS' ? {
                competenceImage: base64,
                competenceData: result.data,
              } : {
                capacitiesImage: base64,
                capacitiesData: result.data,
              }),
              status: (result.type === 'RESULTS' ? (c.capacitiesData ? 'done' : 'uploading') : (c.competenceData ? 'done' : 'uploading'))
            } : c);
          } else {
            // Create new competence
            return [...prev, {
              id: targetId,
              competenceImage: result.type === 'RESULTS' ? base64 : null,
              competenceData: result.type === 'RESULTS' ? result.data : null,
              capacitiesImage: result.type === 'CAPACITIES' ? base64 : null,
              capacitiesData: result.type === 'CAPACITIES' ? result.data : null,
              status: 'uploading'
            }];
          }
        });
      } catch (err) {
        console.error("Error processing bulk file:", err);
        setError(err instanceof Error ? err.message : "Error al procesar uno de los archivos.");
      } finally {
        setBulkProgress(p => ({ ...p, current: p.current + 1 }));
      }
    };

    // Process in batches of 3 to avoid hitting rate limits too hard
    const batchSize = 3;
    for (let i = 0; i < fileArray.length; i += batchSize) {
      const batch = fileArray.slice(i, i + batchSize);
      await Promise.all(batch.map(processFile));
    }

    setIsBulkProcessing(false);
  };

  const getOrdinal = (n: number) => {
    const ordinals: { [key: number]: string } = {
      1: '1ra', 2: '2da', 3: '3ra', 4: '4ta', 5: '5ta', 
      6: '6ta', 7: '7ta', 8: '8ta', 9: '9na', 10: '10ma'
    };
    return ordinals[n] || `${n}ta`;
  };

  const extractSessionDetailsFromUnit = (doc: string, sessionNum: number) => {
    // Attempt to find session details in the Unit document
    // Look for patterns like "Sesión 2 (3 horas): ..."
    const sessionRegex = new RegExp(`Sesión\\s*${sessionNum}\\s*\\(?(\\d+)?\\s*horas?\\)?:?\\s*["'«]?(.*?)["'»]?\\s*(?:\\n|$)`, 'i');
    const match = doc.match(sessionRegex);
    
    if (!match) return null;

    const hours = match[1] || '';
    const title = match[2] || '';
    
    // Try to find thematic field and activities after the session title
    const sectionAfterSession = doc.substring(doc.indexOf(match[0])).split(/Sesión\s*\d+/i)[0];
    
    const themeMatch = sectionAfterSession.match(/Campo\s+temático:?\s*(.*)/i);
    const activityMatch = sectionAfterSession.match(/Actividades:?\s*([\s\S]*?)(?:\n\n|\nSesión|$)/i);
    
    return {
      num: sessionNum,
      hours: hours ? `${hours} h` : '',
      title: title.trim(),
      theme: themeMatch ? themeMatch[1].trim() : '',
      activities: activityMatch ? activityMatch[1].trim() : ''
    };
  };

  const handleNextSessionClick = () => {
    const nextSession = currentSession + 1;
    const ordinal = getOrdinal(nextSession);
    const details = extractSessionDetailsFromUnit(lastUnitDoc || pedagogicalDoc, nextSession);
    
    let req = `Elabora la ${ordinal} Sesión de Aprendizaje detallada con procesos pedagógicos y didácticos.`;
    
    if (details) {
      req += `\n\nDebes tomar la siguiente información de la unidad:\n` +
             `Sesión ${details.num}${details.hours ? ` (${details.hours})` : ''}: "${details.title}"\n` +
             `${details.theme ? `Campo temático: ${details.theme}\n` : ''}` +
             `${details.activities ? `Actividades:\n${details.activities}` : ''}`;
    } else {
      req += ` de la unidad que se viene desarrollando.`;
    }
    
    setDocRequest(req);
    handleGeneratePedagogicalDoc(req);
  };

  const copyToClipboard = () => {
    const strippedReport = finalReport.replace(/<contexto_interno>[\s\S]*?<\/contexto_interno>/g, '').trim();
    navigator.clipboard.writeText(strippedReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadWord = (elementId: string, defaultFilename: string) => {
    // Convert Markdown tables to HTML for Word
    const element = document.getElementById(elementId);
    if (!element) return;

    let filename = defaultFilename;
    
    // Attempt to extract nomenclature for pedagogical documents
    if (elementId === 'pedagogical-doc-content') {
      const text = element.innerText || element.textContent || '';
      
      // Try to find the explicit nomenclature line first
      const nomenclatureMatch = text.match(/U(\d+)-S(\d+)-(.*)/i);
      
      let unit = currentUnit || 'X';
      let session = currentSession || 'X';
      let title = '';

      if (nomenclatureMatch) {
        unit = nomenclatureMatch[1];
        session = nomenclatureMatch[2];
        title = nomenclatureMatch[3].split('\n')[0].trim();
      } else {
        // Fallback extraction
        const uMatch = text.match(/Unidad(?:\s+de\s+aprendizaje)?\s*(?:n°|nro|#)?\s*(\d+)/i) || 
                       text.match(/U(\d+)/i);
        if (uMatch) unit = uMatch[1];
        
        const sMatch = text.match(/Sesión\s*(?:de\s+aprendizaje)?\s*(?:n°|nro|#)?\s*(\d+)/i) || 
                       text.match(/S(\d+)/i);
        if (sMatch) session = sMatch[1];
        
        const titleMatch = text.match(/Título de la sesión:\s*(.*)/i) || 
                           text.match(/Título de la unidad:\s*(.*)/i) ||
                           text.match(/^#\s+(.*)/m);
        if (titleMatch) title = titleMatch[1].trim();
      }
      
      // Clean and format title
      title = title.replace(/[<>:"/\\|?*]/g, '').trim();
      if (title.length > 50) title = title.substring(0, 47) + '...';

      if (lastGeneratedType === 'SESSION') {
        filename = `U${unit}-S${session}-${title || 'Sesion'}`;
      } else if (lastGeneratedType === 'UNIT') {
        filename = `U${unit}-${title || 'Unidad'}`;
      }
    }

    const htmlContent = element.innerHTML;
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${filename}</title>
      <style>
        body { 
          font-family: 'Arial', sans-serif; 
          line-height: 1.6; 
          text-align: justify; 
        }
        p, li { text-align: justify; }
        table { 
          border-collapse: collapse; 
          width: 100%; 
          margin-bottom: 20px; 
          table-layout: auto; 
          border: 1px solid #000;
        }
        th, td { 
          border: 1px solid #000; 
          padding: 8px; 
          text-align: left; 
          vertical-align: top; 
          word-wrap: break-word; 
        }
        th { background-color: #f2f2f2; font-weight: bold; }
        h1, h2, h3 { color: #000; margin-top: 1.5em; margin-bottom: 0.5em; text-align: center; }
        h1 { font-size: 16pt; }
        h2 { font-size: 14pt; }
        h3 { font-size: 12pt; }
        ul, ol { margin-bottom: 1em; padding-left: 2em; }
        li { margin-bottom: 0.5em; }
        @page {
          size: 21cm 29.7cm;
          margin: 2.5cm 2.5cm 2.5cm 2.5cm;
        }
      </style>
      </head><body>
    `;
    const footer = "</body></html>";
    const source = header + htmlContent + footer;

    const blob = new Blob(['\ufeff', source], {
      type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Lightbulb size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 uppercase">AIEDU - IA DOCENTE</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Apoyo a la Labor Docente</p>
                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-tighter">Asesor MINEDU</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              title="Configurar API Key"
            >
              <Settings size={20} />
            </button>
            {state === 'COMPLETED' && (
              <>
                <button 
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all shadow-sm font-medium text-sm"
                >
                  {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
                <button 
                  onClick={() => downloadWord('report-content', `Informe_Diagnostico_${metadata.area}_${metadata.grade}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm font-medium text-sm"
                >
                  <Download size={18} />
                  Descargar Word
                </button>
              </>
            )}
            {state !== 'INITIAL' && (
              <button 
                onClick={() => {
                  setState('INITIAL');
                  setFinalReport('');
                  setPedagogicalDoc('');
                  setDocRequest('');
                  setMetadata(prev => ({ ...prev, level: '' }));
                  setCompetences([{ id: 1, competenceImage: null, capacitiesImage: null, competenceData: null, capacitiesData: null, status: 'idle' }]);
                }}
                className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                Reiniciar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {state === 'INITIAL' && (
            <motion.div 
              key="initial"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl font-extrabold text-slate-900 mb-3">AIEDU - IA DOCENTE</h2>
                <p className="text-slate-600">Optimiza tu tiempo pedagógico con nuestra plataforma de innovación educativa.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <label className="flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors mb-3">
                    <Upload size={24} />
                  </div>
                  <span className="text-sm font-bold text-slate-700">Subir Informe (Word)</span>
                  <span className="text-xs text-slate-500 mt-1">Diagnóstico elaborado</span>
                  <input 
                    type="file" 
                    accept=".docx" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && handleWordUpload(e.target.files[0], 'REPORT')}
                  />
                </label>
                <label className="flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors mb-3">
                    <Upload size={24} />
                  </div>
                  <span className="text-sm font-bold text-slate-700">Subir Programación (Word)</span>
                  <span className="text-xs text-slate-500 mt-1">Insumo de planificación</span>
                  <input 
                    type="file" 
                    accept=".docx" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && handleWordUpload(e.target.files[0], 'PLANNING')}
                  />
                </label>
                <label className="flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors mb-3">
                    <Upload size={24} />
                  </div>
                  <span className="text-sm font-bold text-slate-700">Subir Unidad (Word)</span>
                  <span className="text-xs text-slate-500 mt-1">Para generar sesiones</span>
                  <input 
                    type="file" 
                    accept=".docx" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && handleWordUpload(e.target.files[0], 'UNIT')}
                  />
                </label>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8 flex gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-100">
                  <BookOpen size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-indigo-900">¿Cómo empezar?</h3>
                  <p className="text-sm text-indigo-700 leading-relaxed">
                    Nuestra plataforma te apoya en cada etapa. Puedes subir archivos Word para continuar tu planificación o imágenes para un nuevo diagnóstico:
                  </p>
                  <ul className="text-sm text-indigo-700 list-disc list-inside space-y-1 mt-2">
                    <li><strong>Word:</strong> Sube informes, programaciones o unidades ya elaboradas.</li>
                    <li><strong>Imágenes:</strong> Sube resultados y estadísticas por competencia.</li>
                  </ul>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <School size={16} className="text-indigo-500" />
                        Institución Educativa
                      </label>
                      <input 
                        type="text" 
                        name="institution"
                        value={metadata.institution}
                        onChange={handleMetadataChange}
                        placeholder="Ej. I.E. Emblemática San Juan"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <User size={16} className="text-indigo-500" />
                        Docente Responsable
                      </label>
                      <input 
                        type="text" 
                        name="from"
                        value={metadata.from}
                        onChange={handleMetadataChange}
                        placeholder="Tu nombre completo"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <BookOpen size={16} className="text-indigo-500" />
                        Área Curricular
                      </label>
                      <input 
                        type="text" 
                        name="area"
                        value={metadata.area}
                        onChange={handleMetadataChange}
                        placeholder="Ej. Matemática, Comunicación"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Layers size={16} className="text-indigo-500" />
                        Grado, Secciones y Nivel
                      </label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          name="grade"
                          value={metadata.grade}
                          onChange={handleMetadataChange}
                          placeholder="Grado"
                          className="w-1/4 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                        />
                        <input 
                          type="text" 
                          name="sections"
                          value={metadata.sections}
                          onChange={handleMetadataChange}
                          placeholder="Secciones"
                          className="w-1/4 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                        />
                        <select
                          name="level"
                          value={metadata.level}
                          onChange={(e) => setMetadata(prev => ({ ...prev, level: e.target.value as any }))}
                          className="w-2/4 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                        >
                          <option value="">Seleccionar Nivel</option>
                          <option value="Primaria">Primaria</option>
                          <option value="Secundaria">Secundaria</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Calendar size={16} className="text-indigo-500" />
                        Cantidad de Unidades
                      </label>
                      <input 
                        type="number" 
                        name="unitCount"
                        value={metadata.unitCount}
                        onChange={handleMetadataChange}
                        min="1"
                        max="12"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                      />
                      <p className="text-[10px] text-slate-500 italic">Incluyendo el tiempo de diagnóstico en la primera unidad.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Calendar size={16} className="text-indigo-500" />
                      Fecha del Informe
                    </label>
                    <input 
                      type="text" 
                      name="date"
                      value={metadata.date}
                      onChange={handleMetadataChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                    />
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Fecha del Informe</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          name="date"
                          value={metadata.date}
                          onChange={handleMetadataChange}
                          placeholder="Ej. 03 de abril de 2026"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                  <button 
                    onClick={() => setState('COLLECTING')}
                    disabled={!metadata.institution || !metadata.area || !metadata.grade}
                    className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 font-bold"
                  >
                    Continuar
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {state === 'COLLECTING' && (
            <motion.div 
              key="collecting"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900">Carga de Resultados</h2>
                  <p className="text-slate-600">Sube una imagen por cada competencia y la estadística de capacidades del área de {metadata.area}.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setState('INITIAL')}
                    className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-800 font-medium text-sm transition-colors"
                  >
                    <ArrowRight size={18} className="rotate-180" />
                    Editar Datos
                  </button>
                  <button 
                    onClick={addCompetence}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all shadow-sm font-semibold text-sm"
                  >
                    <Plus size={18} className="text-indigo-600" />
                    Añadir Competencia
                  </button>
                </div>
              </div>

              {/* Bulk Upload Zone */}
              <div className="bg-indigo-50/50 border-2 border-dashed border-indigo-200 rounded-3xl p-8 text-center transition-all hover:bg-indigo-50 hover:border-indigo-400 group relative overflow-hidden">
                <input 
                  type="file" 
                  multiple 
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  onChange={(e) => e.target.files && handleBulkUpload(e.target.files)}
                  disabled={isBulkProcessing}
                />
                <div className="relative z-0 space-y-4">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 mx-auto shadow-sm group-hover:scale-110 transition-transform">
                    {isBulkProcessing ? (
                      <Loader2 size={32} className="animate-spin" />
                    ) : (
                      <Upload size={32} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-indigo-900">Carga Masiva de Imágenes</h3>
                    <p className="text-sm text-indigo-700 max-w-md mx-auto mt-1">
                      Selecciona o arrastra múltiples imágenes de resultados y estadísticas. El sistema las identificará y organizará automáticamente.
                    </p>
                  </div>
                  {isBulkProcessing && (
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="flex justify-between text-xs font-bold text-indigo-600">
                        <span>Procesando...</span>
                        <span>{bulkProgress.current} / {bulkProgress.total}</span>
                      </div>
                      <div className="w-full bg-indigo-100 h-2 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-indigo-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-6 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-2">
                  <School size={14} className="text-indigo-500" />
                  <span>{metadata.institution || 'I.E. No especificada'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-indigo-500" />
                  <span>{metadata.area || 'Área no especificada'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-indigo-500" />
                  <span>{metadata.grade} - {metadata.sections}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-indigo-500" />
                  <span>{metadata.date}</span>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-800">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <p className="text-sm font-medium whitespace-pre-line">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {competences.map((comp) => (
                  <div 
                    key={comp.id}
                    className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col"
                  >
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                          {comp.id}
                        </div>
                        <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">Competencia {comp.id}</span>
                      </div>
                      {competences.length > 1 && (
                        <button 
                          onClick={() => removeCompetence(comp.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    
                    <div className="p-6 space-y-6 flex-grow">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Competence Results Upload */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Resultados Competencia</label>
                          {!comp.competenceImage ? (
                            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-all group/label">
                              <div className="flex flex-col items-center justify-center p-4 text-center">
                                <Upload size={20} className="text-slate-400 group-hover/label:text-indigo-500 mb-2 transition-colors" />
                                <p className="text-xs text-slate-600 font-semibold">Subir Resultados</p>
                              </div>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleCompetenceImageUpload(comp.id, file);
                                }}
                              />
                            </label>
                          ) : (
                            <div className="relative group/img h-40">
                              <img 
                                src={comp.competenceImage} 
                                alt={`Competencia ${comp.id}`} 
                                className="w-full h-full object-cover rounded-2xl border border-slate-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                <button 
                                  onClick={() => setCompetences(prev => prev.map(c => c.id === comp.id ? { ...c, competenceImage: null, competenceData: null, status: 'idle' } : c))}
                                  className="px-3 py-1.5 bg-white text-slate-900 rounded-lg font-bold text-xs shadow-lg"
                                >
                                  Cambiar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Capacities Statistics Upload */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Estadística Capacidades</label>
                          {!comp.capacitiesImage ? (
                            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-all group/label">
                              <div className="flex flex-col items-center justify-center p-4 text-center">
                                <Upload size={20} className="text-slate-400 group-hover/label:text-indigo-500 mb-2 transition-colors" />
                                <p className="text-xs text-slate-600 font-semibold">Subir Estadística</p>
                              </div>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleCapacitiesImageUpload(comp.id, file);
                                }}
                              />
                            </label>
                          ) : (
                            <div className="relative group/img h-40">
                              <img 
                                src={comp.capacitiesImage} 
                                alt={`Estadística ${comp.id}`} 
                                className="w-full h-full object-cover rounded-2xl border border-slate-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                <button 
                                  onClick={() => setCompetences(prev => prev.map(c => c.id === comp.id ? { ...c, capacitiesImage: null, capacitiesData: null, status: 'idle' } : c))}
                                  className="px-3 py-1.5 bg-white text-slate-900 rounded-lg font-bold text-xs shadow-lg"
                                >
                                  Cambiar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2">
                        {comp.status === 'uploading' && (
                          <div className="flex items-center gap-3 text-indigo-600 bg-indigo-50/50 p-3 rounded-xl">
                            <Loader2 size={18} className="animate-spin" />
                            <span className="text-sm font-bold">Procesando imágenes...</span>
                          </div>
                        )}
                        {comp.status === 'done' && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 text-emerald-600 bg-emerald-50/50 p-3 rounded-xl">
                              <CheckCircle2 size={18} />
                              <span className="text-sm font-bold">Todo listo para esta competencia</span>
                            </div>
                            <details className="group/details">
                              <summary className="text-xs font-bold text-slate-400 uppercase cursor-pointer hover:text-slate-600 transition-colors list-none flex items-center gap-2">
                                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                Ver datos extraídos
                              </summary>
                              <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-mono text-slate-500 overflow-auto max-h-32">
                                <pre>{JSON.stringify({ results: comp.competenceData?.resultados, capacities: comp.capacitiesData?.resultados }, null, 2)}</pre>
                              </div>
                            </details>
                          </div>
                        )}
                        {comp.status === 'error' && (
                          <div className="flex items-center gap-3 text-red-600 bg-red-50/50 p-3 rounded-xl">
                            <AlertCircle size={18} />
                            <span className="text-sm font-bold">Error en el proceso</span>
                          </div>
                        )}
                        {comp.status === 'idle' && (
                          <div className="flex items-center gap-3 text-slate-400 bg-slate-50/50 p-3 rounded-xl">
                            <div className="w-2 h-2 bg-slate-300 rounded-full animate-pulse" />
                            <span className="text-sm italic">Esperando archivos...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-center pt-8">
                <button 
                  onClick={generateReport}
                  disabled={competences.some(c => c.status !== 'done') || isGenerating}
                  className="flex items-center gap-3 px-12 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-indigo-200 font-black text-lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={24} className="animate-spin" />
                      Generando Informe...
                    </>
                  ) : (
                    <>
                      Generar Informe Completo
                      <ArrowRight size={24} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {state === 'GENERATING' && (
            <motion.div 
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 space-y-8"
            >
              <div className="relative">
                <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                  <FileText size={32} />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Redactando Informe Institucional</h2>
                <p className="text-slate-500 max-w-md mx-auto">
                  Gemini está analizando los datos de las {competences.length} competencias para generar un análisis cualitativo y cuantitativo detallado.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-sm">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tip Pedagógico</h4>
                <p className="text-sm text-slate-600 italic">
                  "La evaluación diagnóstica no es solo un registro de resultados, es el punto de partida para una mediación pedagógica diferenciada que atienda las necesidades reales de cada estudiante."
                </p>
              </div>
              <div className="w-full max-w-md bg-slate-100 h-2 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 15, ease: "linear" }}
                  className="h-full bg-indigo-600"
                />
              </div>
            </motion.div>
          )}

          {state === 'COMPLETED' && (
            <motion.div 
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {!isUploadedDoc ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-extrabold text-slate-900">Informe Generado</h2>
                      <p className="text-slate-600">Revisa el informe completo a continuación. Puedes copiarlo o descargarlo en formato Word.</p>
                    </div>
                  </div>

                  {/* Statistical Chart Section */}
                  <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                        <Layers size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Distribución por Competencia</h3>
                        <p className="text-sm text-slate-500">Porcentaje de estudiantes por nivel de logro</p>
                      </div>
                    </div>
                    
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={competences.map(comp => {
                            if (!comp.competenceData) return null;
                            const totals = comp.competenceData.resultados.reduce((acc: any, curr: any) => {
                              acc.inicio += curr.inicio.n;
                              acc.proceso += curr.proceso.n;
                              acc.logrado += curr.logrado.n;
                              acc.destacado += curr.destacado.n;
                              acc.total += curr.evaluados;
                              return acc;
                            }, { inicio: 0, proceso: 0, logrado: 0, destacado: 0, total: 0 });
                            
                            return {
                              name: `Comp. ${comp.id}`,
                              'Inicio': parseFloat(((totals.inicio / totals.total) * 100).toFixed(1)),
                              'Proceso': parseFloat(((totals.proceso / totals.total) * 100).toFixed(1)),
                              'Logrado': parseFloat(((totals.logrado / totals.total) * 100).toFixed(1)),
                              'Destacado': parseFloat(((totals.destacado / totals.total) * 100).toFixed(1)),
                            };
                          }).filter(Boolean)}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} unit="%" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: '#f8fafc' }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                          <Bar dataKey="Inicio" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Proceso" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Logrado" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Destacado" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Heat Map Style Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                      <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-center gap-3">
                        <div className="text-2xl">🟥</div>
                        <div>
                          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Inicio</p>
                          <p className="text-sm font-bold text-red-900">Requiere Refuerzo</p>
                        </div>
                      </div>
                      <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex items-center gap-3">
                        <div className="text-2xl">🟧</div>
                        <div>
                          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Proceso</p>
                          <p className="text-sm font-bold text-orange-900">En Consolidación</p>
                        </div>
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
                        <div className="text-2xl">🟩</div>
                        <div>
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Logrado</p>
                          <p className="text-sm font-bold text-emerald-900">Nivel Esperado</p>
                        </div>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
                        <div className="text-2xl">🟦</div>
                        <div>
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Destacado</p>
                          <p className="text-sm font-bold text-blue-900">Nivel Superior</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    <div id="report-content" className="p-8 md:p-12 prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-table:border prose-table:border-slate-200 prose-th:bg-slate-50 prose-th:p-3 prose-td:p-3 prose-img:rounded-xl">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkBreaks]} 
                        rehypePlugins={[rehypeRaw]}
                      >
                        {finalReport.replace(/<contexto_interno>[\s\S]*?<\/contexto_interno>/g, '').trim()}
                      </ReactMarkdown>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-indigo-900">Documento Cargado Correctamente</h2>
                    <p className="text-indigo-700">El contenido ha sido procesado. Ahora puedes usar el Asistente de Innovación Pedagógica para generar nuevos documentos basados en este archivo.</p>
                  </div>
                </div>
              )}

              {/* Pedagogical Assistant Section */}
              <div className="mt-12 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Asistente de Innovación Pedagógica</h2>
                    <p className="text-slate-500">Genera documentos curriculares basados en tus insumos y el CNEB.</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">¿Qué documento necesitas elaborar?</label>
                    
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Calendarización 2026 (Opcional para Programación Anual)</label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-slate-50 transition-colors">
                          <Upload size={14} className="text-slate-500" />
                          {calendarImage ? 'Cambiar Imagen' : 'Subir Imagen de Calendarización'}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => e.target.files?.[0] && handleCalendarUpload(e.target.files[0])}
                          />
                        </label>
                        {calendarImage && (
                          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                            <CheckCircle2 size={14} />
                            Cargada
                            <button 
                              onClick={() => setCalendarImage(null)}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {[
                        { name: 'Programación Anual', icon: <Calendar size={14} />, prompt: 'Elabora una Programación Anual detallada basada en el diagnóstico.' },
                        { name: 'Unidad de Aprendizaje', icon: <Layers size={14} />, prompt: 'Elabora una Unidad de Aprendizaje completa basada en la programación.' },
                        { name: 'Sesión de Aprendizaje', icon: <BookOpen size={14} />, prompt: 'Elabora una Sesión de Aprendizaje detallada con procesos pedagógicos y didácticos.' },
                        { name: 'Desarrollo Total de Sesión', icon: <Wand2 size={14} />, prompt: 'Desarrolla de manera completa y exhaustiva la sesión de aprendizaje, incluyendo todos los materiales, lecturas y actividades paso a paso.' },
                        { name: 'Evaluación de Unidad', icon: <CheckCircle2 size={14} />, prompt: 'Diseña una evaluación para la unidad de aprendizaje. Pregunta al usuario qué tipo de evaluación desea (Escrita, Desempeño, Portafolio, etc.) antes de proceder.' },
                        { name: 'Rúbrica de Evaluación', icon: <Check size={14} />, prompt: 'Elabora una Rúbrica de Evaluación con criterios e indicadores precisos.' },
                        { name: 'Lista de Cotejo', icon: <Check size={14} />, prompt: 'Elabora una Lista de Cotejo para evaluar la evidencia de aprendizaje.' },
                        { name: 'Actividad de Refuerzo', icon: <Plus size={14} />, prompt: 'Diseña una actividad de refuerzo para los estudiantes en nivel de inicio/proceso.' }
                      ].map((item) => (
                        <button
                          key={item.name}
                          onClick={() => setDocRequest(item.prompt)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-medium transition-colors border border-slate-200"
                        >
                          {item.icon}
                          {item.name}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-500" />
                        Campo Temático / Eje Articulador (Para Programación Anual)
                      </label>
                      <input 
                        type="text" 
                        name="thematicField"
                        value={metadata.thematicField}
                        onChange={handleMetadataChange}
                        placeholder="Ej. Identidad Cultural, Desarrollo Sostenible..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                      />
                    </div>
                    <textarea
                      value={docRequest}
                      onChange={(e) => setDocRequest(e.target.value)}
                      placeholder="Ej: Elabora una sesión de aprendizaje para fortalecer la capacidad crítica identificada en la competencia 1..."
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none min-h-[120px]"
                    />
                  </div>
                  
                  {error && error.includes('API Key') && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm whitespace-pre-line font-medium shadow-sm">
                      <div className="flex items-center gap-2 mb-2 font-bold text-amber-900 uppercase tracking-tight">
                        <AlertTriangle size={18} />
                        Acción Requerida
                      </div>
                      {error}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleGeneratePedagogicalDoc()}
                      disabled={!docRequest || isGeneratingDoc}
                      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 font-bold"
                    >
                      {isGeneratingDoc ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <Wand2 size={20} />
                          Generar Documento
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {pedagogicalDoc && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
                  >
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <FileText size={18} className="text-indigo-600" />
                        Documento Pedagógico Generado
                      </span>
                      <div className="flex items-center gap-2">
                        {lastGeneratedType === 'UNIT' && (
                          <button
                            onClick={() => {
                              const nextUnit = currentUnit + 1;
                              const req = `Elabora la Unidad de Aprendizaje N° ${nextUnit.toString().padStart(2, '0')} siguiendo la secuencia de la programación anual.`;
                              setDocRequest(req);
                              handleGeneratePedagogicalDoc(req);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm font-bold text-sm"
                          >
                            <ArrowRight size={18} />
                            Siguiente Unidad (Unidad { (currentUnit + 1).toString().padStart(2, '0') })
                          </button>
                        )}
                        {lastGeneratedType === 'SESSION' && (
                          <button
                            onClick={handleNextSessionClick}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm font-bold text-sm"
                          >
                            <ArrowRight size={18} />
                            Siguiente Sesión (Sesión { (currentSession + 1).toString().padStart(2, '0') })
                          </button>
                        )}
                        <button
                          onClick={() => downloadWord('pedagogical-doc-content', `Documento_Pedagogico_${metadata.area}_${metadata.grade}`)}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm font-bold text-sm"
                        >
                          <Download size={18} />
                          DESCARGA WORD
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(pedagogicalDoc);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                          title="Copiar al portapapeles"
                        >
                          {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                        </button>
                      </div>
                    </div>
                    <div id="pedagogical-doc-content" className="p-8 md:p-12 prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-table:border prose-table:border-slate-200 prose-th:bg-slate-50 prose-th:p-3 prose-td:p-3">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkBreaks]} 
                        rehypePlugins={[rehypeRaw]}
                      >
                        {pedagogicalDoc}
                      </ReactMarkdown>
                    </div>

                    {/* Suggestions Section */}
                    <div className="p-6 bg-indigo-50 border-t border-slate-200">
                      <div className="flex items-start gap-3">
                        <Sparkles className="text-indigo-600 shrink-0 mt-1" size={20} />
                        <div className="space-y-3">
                          <h4 className="font-bold text-indigo-900 text-sm">Sugerencias de Innovación Educativa:</h4>
                          
                          {lastGeneratedType === 'UNIT' && (
                            <div className="space-y-2">
                              <p className="text-sm text-indigo-700">Has generado la Unidad {currentUnit}. ¿Deseas elaborar la <strong>Unidad {(currentUnit + 1).toString().padStart(2, '0')}</strong> de la programación anual?</p>
                              <button 
                                onClick={() => {
                                  const nextUnit = currentUnit + 1;
                                  const req = `Elabora la Unidad de Aprendizaje N° ${nextUnit.toString().padStart(2, '0')} siguiendo la secuencia de la programación anual.`;
                                  setDocRequest(req);
                                  handleGeneratePedagogicalDoc(req);
                                }}
                                className="text-xs font-bold text-indigo-600 hover:underline"
                              >
                                Generar Unidad {(currentUnit + 1).toString().padStart(2, '0')}
                              </button>
                            </div>
                          )}

                          {lastGeneratedType === 'SESSION' && (
                            <div className="space-y-3">
                              <p className="text-sm text-indigo-700">Has generado la Sesión {currentSession}. ¿Deseas continuar con la <strong>Sesión {(currentSession + 1).toString().padStart(2, '0')}</strong> de la unidad?</p>
                              <div className="flex gap-4">
                                <button 
                                  onClick={handleNextSessionClick}
                                  className="text-xs font-bold text-indigo-600 hover:underline"
                                >
                                  Generar Sesión {(currentSession + 1).toString().padStart(2, '0')}
                                </button>
                                <button 
                                  onClick={() => setDocRequest('Elabora una Rúbrica de Evaluación detallada para esta sesión.')}
                                  className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                                >
                                  <Check size={12} />
                                  Acompañar con Rúbrica
                                </button>
                                <button 
                                  onClick={() => setDocRequest('Elabora una Lista de Cotejo para esta sesión.')}
                                  className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                                >
                                  <Check size={12} />
                                  Acompañar con Lista de Cotejo
                                </button>
                              </div>
                            </div>
                          )}

                          {lastGeneratedType === 'PLANNING' && (
                            <div className="space-y-2">
                              <p className="text-sm text-indigo-700">Has generado la Programación Anual. El siguiente paso recomendado es elaborar la <strong>primera Unidad de Aprendizaje</strong>.</p>
                              <button 
                                onClick={() => setDocRequest('Elabora la Unidad de Aprendizaje N° 01 basada en la programación anual generada.')}
                                className="text-xs font-bold text-indigo-600 hover:underline"
                              >
                                Generar Unidad N° 01
                              </button>
                            </div>
                          )}

                          {!lastGeneratedType && (
                            <p className="text-sm text-indigo-700">Documento generado con éxito. Puedes seguir solicitando más documentos curriculares arriba.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-12 border-t border-slate-200 mt-12 text-center">
        <p className="text-sm text-slate-500 font-medium">
          &copy; 2026 AIEDU - IA DOCENTE. Apoyando el desarrollo de la labor docente con excelencia pedagógica.
        </p>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="text-indigo-600" size={24} />
                  Configuración
                </h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                >
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Gemini API Key
                  </label>
                  <input 
                    type="password"
                    value={manualApiKey}
                    onChange={(e) => setManualApiKey(e.target.value)}
                    placeholder="Pega aquí tu clave de API (AI Studio)"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  />
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                    Si no tienes una clave, puedes obtenerla gratis en <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold hover:underline">Google AI Studio</a>. Esta clave se guardará solo en tu navegador.
                  </p>
                </div>
                
                <div className="pt-2">
                  <button 
                    onClick={handleSaveApiKey}
                    className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Guardar Configuración
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
