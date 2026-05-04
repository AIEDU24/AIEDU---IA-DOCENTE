export interface AchievementLevel {
  count: number;
  percentage: number;
}

export interface SectionResult {
  section: string;
  evaluatedCount: number;
  inicio: AchievementLevel;
  proceso: AchievementLevel;
  logrado: AchievementLevel;
  destacado: AchievementLevel;
}

export interface CapacityResult {
  section: string;
  capacities: {
    name: string;
    percentage: number;
  }[];
}

export interface CompetenceEntry {
  id: number;
  competenceImage: string | null;
  capacitiesImage: string | null;
  competenceData: any | null;
  capacitiesData: any | null;
  status: 'idle' | 'uploading' | 'done' | 'error';
}

export interface ReportMetadata {
  institution: string;
  reportNumber: string;
  to: string;
  from: string;
  subject: string;
  area: string;
  grade: string;
  level: 'Primaria' | 'Secundaria' | '';
  sections: string;
  date: string;
  unitCount: string;
  thematicField: string;
}

export type AppState = 'INITIAL' | 'COLLECTING' | 'GENERATING' | 'COMPLETED';
