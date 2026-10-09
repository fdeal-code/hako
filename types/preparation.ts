// HAKO — Préparatifs : tâches d'orga du groupe (« Louer la voiture »)
// Stockées dans wishes (type = 'orga') : done + assigned_to (qui s'en occupe).

export interface PrepTask {
  id: string;
  title: string;
  note: string | null;
  done: boolean;
  assignedTo: string | null;
  addedBy: string;
  createdAt: string;
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
  myOpenTasks: number;
}
