// HAKO — Chemin d'un fichier dans un bucket Supabase (fonction pure)
// documents.file_url contient le chemin (« <trip_id>/<fichier> ») depuis que
// le bucket est privé ; les anciennes lignes avaient une URL publique ou
// signée. Aucun import local : testable avec node --test.

/** Chemin dans `bucket`, ou null si c'est une URL externe (hors Supabase). */
export function storagePath(fileUrl: string, bucket: string): string | null {
  const value = fileUrl.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, '');
  const marker = new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${bucket}/([^?#]+)`);
  const match = value.match(marker);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
