// HAKO — Hook Import de réservations (app/trip/[id]/import.tsx)
// source (texte collé, PDF, capture) → lecture par parse-booking →
// vérification (on corrige, on choisit planning / dépense) → c'est rangé.

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/contexts/AuthContext';
import { useTripOverview } from '@/hooks/useTripOverview';
import { useTripStops } from '@/hooks/useTripStops';
import { getBudget } from '@/services/budgetService';
import { getImportedReferences, importBookings, parseBookings } from '@/services/bookingImportService';
import { BookingDraft, ImportResult, ImportSource, ParsedBooking } from '@/types/bookingImport';
import { bookingWarnings, BookingWarning, isDuplicate } from '@/utils/bookingImport';
import { tripEvents } from '@/utils/events';

export type ImportStep = 'source' | 'reading' | 'review' | 'saving' | 'done';
type PickedFile = Extract<ImportSource, { type: 'file' }>;

const IMAGE_QUALITY = 0.85;
const PDF_MIME = 'application/pdf';

// Fichier ou texte reçu par le menu Partager (app/share.tsx) avant d'ouvrir l'import
let pendingSource: ImportSource | null = null;
export function setPendingImport(source: ImportSource) { pendingSource = source; }
function takePendingImport(): ImportSource | null {
  const s = pendingSource;
  pendingSource = null;
  return s;
}

function toDraft(b: ParsedBooking, i: number): BookingDraft {
  return { ...b, key: `${i}-${b.title}`, include: true, addPlanning: !!(b.start_date ?? b.end_date), addExpense: b.total_price !== null };
}

export function useBookingImport(tripId: string) {
  const { session } = useAuth();
  const me = session?.user?.id ?? '';
  const { overview } = useTripOverview(tripId);
  const { stops } = useTripStops(tripId);

  const [initial] = useState(takePendingImport);
  const [step, setStep] = useState<ImportStep>('source');
  const [text, setText] = useState(initial?.type === 'text' ? initial.text : '');
  const [file, setFile] = useState<PickedFile | null>(initial?.type === 'file' ? initial : null);
  const [drafts, setDrafts] = useState<BookingDraft[]>([]);
  const [existing, setExisting] = useState<{ reference: string | null; day: string | null }[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    void getBudget(tripId).then(({ data }) => setMemberIds((data?.members ?? []).map(m => m.id)));
    void getImportedReferences(tripId).then(({ data }) => setExisting(data ?? []));
  }, [tripId]);

  const source = useMemo<ImportSource | null>(
    () => file ?? (text.trim() ? { type: 'text', text: text.trim() } : null),
    [file, text],
  );

  const paste = useCallback(async () => {
    const value = await Clipboard.getStringAsync();
    if (value.trim()) { setText(value); setFile(null); }
  }, []);

  const pickPdf = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: PDF_MIME, copyToCacheDirectory: true });
    const asset = res.canceled ? null : res.assets[0];
    if (asset) setFile({ type: 'file', uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? PDF_MIME });
  }, []);

  const pickImage = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: IMAGE_QUALITY });
    const asset = res.canceled ? null : res.assets[0];
    if (asset) {
      setFile({ type: 'file', uri: asset.uri, name: asset.fileName ?? 'capture.jpg', mimeType: asset.mimeType ?? 'image/jpeg' });
    }
  }, []);

  const analyze = useCallback(async () => {
    if (!source) return;
    setError(null);
    setStep('reading');
    const { data, error: err } = await parseBookings(tripId, source);
    if (err !== null) { setError(err); setStep('source'); return; }
    if (data.length === 0) {
      setError('Aucune réservation trouvée. Vérifie que c’est bien la confirmation (avec les dates et la référence).');
      setStep('source');
      return;
    }
    setDrafts(data.map(toDraft));
    setStep('review');
  }, [source, tripId]);

  const update = useCallback((key: string, patch: Partial<BookingDraft>) => {
    setDrafts(prev => prev.map(d => (d.key === key ? { ...d, ...patch } : d)));
  }, []);

  const warningsOf = useCallback((d: BookingDraft): (BookingWarning | 'duplicate')[] => [
    ...(isDuplicate(d, existing) ? ['duplicate' as const] : []),
    ...bookingWarnings(d, overview?.start_date ?? null, overview?.end_date ?? null),
  ], [existing, overview?.start_date, overview?.end_date]);

  const chosen = useMemo(() => drafts.filter(d => d.include), [drafts]);

  const confirm = useCallback(async () => {
    if (!source || !me || chosen.length === 0) return;
    setError(null);
    setStep('saving');
    const { data, error: err } = await importBookings({ tripId, userId: me, source, drafts, memberIds, stops });
    if (err !== null) { setError(err); setStep('review'); return; }
    tripEvents.emit();
    setResult(data);
    setStep('done');
  }, [source, me, chosen.length, tripId, drafts, memberIds, stops]);

  const restart = useCallback(() => {
    setText(''); setFile(null); setDrafts([]); setResult(null); setError(null); setStep('source');
  }, []);

  return {
    step, text, setText, file, clearFile: () => setFile(null), paste, pickPdf, pickImage,
    canAnalyze: !!source, analyze, drafts, update, warningsOf, chosen, confirm, result, error, restart,
    memberCount: memberIds.length,
  };
}
