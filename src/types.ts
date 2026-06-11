export interface ProductItem {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  valueUnit: number;
  valueTotal: number;
  weightEstimatePerUnit: number; // raw rating estimate from Gemini
  calculatedWeight?: number;    // deterministic normalized weight based on distribution mode
}

export interface InvoiceData {
  invoiceNumber: string;
  totalGrossWeight: number;
  totalNetWeight: number;
  items: ProductItem[];
  dataEmissao?: string;
  emitente?: string;
  destino?: string;
  placaCavalo?: string;
  placaCarreta?: string;
  observacoes?: string;
  rawGrossWeightStr?: string;
}

export type DistributionMode = "original" | "gemini" | "proportional" | "equal" | "manual";
export type WeightTarget = "gross" | "net";

export interface ZplCargoData {
  transporte: string;
  lote: string;
  volumes?: number;
}
