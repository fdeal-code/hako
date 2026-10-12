// HAKO — Préparatifs : tâches d'orga du groupe (« Louer la voiture »)
// Stockées dans wishes (type = 'orga') : done + assigned_to (qui s'en occupe)
// + is_private (visible seulement par son auteur, garanti par la RLS).

export interface PrepTask {
  id: string;
  title: string;
  note: string | null;
  done: boolean;
  assignedTo: string | null;
  addedBy: string;
  createdAt: string;
  /** Visible seulement par la personne qui l'a créée */
  isPrivate: boolean;
}

export interface PrepMember {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

/** Résumé pour la bande « Préparatifs » (dashboard, documents). */
export interface PrepSummary {
  essentialsDone: number;
  essentialsTotal: number;
  openTasks: number;
  /** Tâches qui m'attendent : assignées à moi ou dans ma liste perso */
  myOpenTasks: number;
  /** eSIM cochée dans les essentiels */
  esimDone: boolean;
}
