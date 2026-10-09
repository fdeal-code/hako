// HAKO — Album souvenir imprimé

export type PrintFormat = 'square' | 'landscape';

export interface PrintFormatOption {
  id: PrintFormat;
  label: string;          // « Carré 20 × 20 »
  pages: number;
  photosPerPage: number;
  priceFrom: number;      // € indicatif (impression + livraison)
}

export const PRINT_FORMATS: readonly PrintFormatOption[] = [
  { id: 'square',    label: 'Carré 20 × 20',  pages: 24, photosPerPage: 2, priceFrom: 29 },
  { id: 'landscape', label: 'Paysage A4',     pages: 36, photosPerPage: 3, priceFrom: 45 },
];

export interface PrintAlbumRequest {
  format: PrintFormat;
  photo_count: number;
  created_at: string;
}
