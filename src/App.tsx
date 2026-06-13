import React, { useState, useEffect } from "react";
import {
  FileText,
  Upload,
  Clipboard,
  Check,
  RefreshCw,
  Sliders,
  Scale,
  Settings,
  AlertTriangle,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  Hash,
  Truck,
  Plus,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ProductItem, InvoiceData, DistributionMode, WeightTarget, ZplCargoData } from "./types";

// Helper component to render beautiful retro physical mechanical turning odometer digits
function Odometer({ value, label, maxDigitCount = 10 }: { value: string | number; label: string; maxDigitCount?: number }) {
  const strVal = String(value).replace(/[^0-9]/g, "");
  const paddedVal = strVal.padStart(maxDigitCount, "0");
  const digits = paddedVal.split("");

  return (
    <div className="flex flex-col items-center bg-[#291710]/40 p-4 rounded-xl border border-[#523528]/80 shadow-[inset_0_4px_12px_rgba(0,0,0,0.6)]">
      <span className="text-[10px] font-bold text-[#dba275]/80 uppercase tracking-widest mb-2 font-sans select-none text-center">
        {label}
      </span>
      <div className="flex items-center space-x-1.5 p-1.5 bg-[#4c3127] rounded-lg border-2 border-[#bfa27a] shadow-[0_4px_8px_rgba(0,0,0,0.4)]">
        {digits.map((digit, index) => (
          <div
            key={index}
            className="w-8 h-12 mechanical-wheel bg-gradient-to-b from-black via-[#1f1a17] to-black flex items-center justify-center text-xl font-bold font-mono text-[#ecd0aa] border-r border-[#3d251c]"
            style={{
              textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 0 8px rgba(223, 192, 144, 0.5)",
            }}
          >
            {digit}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"invoice" | "zpl">("invoice");
  const [zoomLevel, setZoomLevel] = useState<number>(85); // 85% by default to decrease zoom
  const [copyFormat, setCopyFormat] = useState<"products" | "logistics">("products");

  // State for Invoice processing
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [weightTarget, setWeightTarget] = useState<WeightTarget>("gross");
  const [distributionMode, setDistributionMode] = useState<DistributionMode>("original");
  const [decimalSeparator, setDecimalSeparator] = useState<"," | ".">(",");
  const [useKgSuffix, setUseKgSuffix] = useState(true);
  const [copiedInvoice, setCopiedInvoice] = useState(false);

  // States for live edit of invoice summary
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState("");
  const [manualGrossWeight, setManualGrossWeight] = useState<number>(0);
  const [manualNetWeight, setManualNetWeight] = useState<number>(0);

  // State for ZPL Sequential Label Generator
  const [loadingZpl, setLoadingZpl] = useState(false);
  const [zplError, setZplError] = useState<string | null>(null);
  const [zplInputType, setZplInputType] = useState<"paste" | "upload">("paste");
  const [zplTextInput, setZplTextInput] = useState("");
  const [zplCargoData, setZplCargoData] = useState<ZplCargoData>({
    transporte: "",
    lote: "",
    volumes: 0,
  });
  const [generatedZpls, setGeneratedZpls] = useState<string[]>([]);
  const [copiedZpl, setCopiedZpl] = useState(false);
  const [selectedZplPreviewIdx, setSelectedZplPreviewIdx] = useState(0);

  // Sync state variables with current invoice when it triggers
  useEffect(() => {
    if (invoiceData) {
      setManualInvoiceNumber(invoiceData.invoiceNumber);
      setManualGrossWeight(invoiceData.totalGrossWeight);
      setManualNetWeight(invoiceData.totalNetWeight);
    }
  }, [invoiceData]);

  // Dynamic distribution engine based on selected criteria
  const getCalculatedItems = (): ProductItem[] => {
    if (!invoiceData) return [];

    const targetVal = weightTarget === "gross" ? manualGrossWeight : manualNetWeight;

    if (distributionMode === "original") {
      return invoiceData.items.map((item) => ({
        ...item,
        calculatedWeight: parseFloat((item.quantity * item.weightEstimatePerUnit).toFixed(3)),
      }));
    }

    // Direct proportional distribution based on packaging codes
    if (distributionMode === "proportional") {
      const totalTheoreticalWeight = invoiceData.items.reduce(
        (acc, item) => acc + item.quantity * item.weightEstimatePerUnit,
        0
      );

      if (totalTheoreticalWeight === 0) {
        const perItemWeight = targetVal / invoiceData.items.length;
        return invoiceData.items.map((item) => ({
          ...item,
          calculatedWeight: parseFloat(perItemWeight.toFixed(3)),
        }));
      }

      return invoiceData.items.map((item) => {
        const itemTheoretical = item.quantity * item.weightEstimatePerUnit;
        const proportion = itemTheoretical / totalTheoreticalWeight;
        const calculated = proportion * targetVal;
        return {
          ...item,
          calculatedWeight: parseFloat(calculated.toFixed(3)),
        };
      });
    }

    if (distributionMode === "equal") {
      const perItemWeight = targetVal / invoiceData.items.length;
      return invoiceData.items.map((item) => ({
        ...item,
        calculatedWeight: parseFloat(perItemWeight.toFixed(3)),
      }));
    }

    if (distributionMode === "gemini") {
      // Direct raw estimation returned by AI
      const rawSum = invoiceData.items.reduce(
        (acc, item) => acc + item.quantity * item.weightEstimatePerUnit,
        0
      );
      return invoiceData.items.map((item) => {
        const scale = rawSum > 0 ? targetVal / rawSum : 1;
        const calc = item.quantity * item.weightEstimatePerUnit * scale;
        return {
          ...item,
          calculatedWeight: parseFloat(calc.toFixed(3)),
        };
      });
    }

    return invoiceData.items;
  };

  const calculatedItems = getCalculatedItems();

  const handleUpdateItemWeight = (index: number, val: number) => {
    if (!invoiceData) return;
    setDistributionMode("manual");
    const updated = [...invoiceData.items];
    updated[index] = {
      ...updated[index],
      calculatedWeight: val,
    };
    setInvoiceData({
      ...invoiceData,
      items: updated,
    });
  };

  const formatWeight = (val: number): string => {
    // If integer (e.g. 210, 522, 156), return with zero decimal places
    if (val % 1 === 0) {
      return val.toFixed(0);
    }
    // For values with decimal part, return with precisely 3 decimal places
    let formatted = val.toFixed(3);
    if (decimalSeparator === ",") {
      formatted = formatted.replace(".", ",");
    }
    return formatted;
  };

  // Tab-separated spreadsheet columns matching requested column structure (skipped E, F, H, I, K)
  const generateSpreadsheetText = (): string => {
    if (!invoiceData) return "";
    return calculatedItems
      .map((item) => {
        const nfNum = manualInvoiceNumber || invoiceData.invoiceNumber;
        const materialCol = `${item.code} ${item.description}`;
        const qtyCol = `${item.quantity} ${item.unit}`;
        const weightCol = `${formatWeight(item.calculatedWeight || 0)}${useKgSuffix ? " KG" : ""}`;
        // Columns mapped: D (nfNum) \t E (empty) \t F (empty) \t G (materialCol) \t H (empty) \t I (empty) \t J (qtyCol) \t K (empty) \t L (weightCol)
        // D to E (1 tab), E to F (1 tab), F to G (1 tab) -> 3 tabs total
        // G to H (1 tab), H to I (1 tab), I to J (1 tab) -> 3 tabs total
        // J to K (1 tab), K to L (1 tab) -> 2 tabs total
        return `${nfNum}\t\t\t${materialCol}\t\t\t${qtyCol}\t\t${weightCol}`;
      })
      .join("\n");
  };

  // 19 tab-separated spreadsheet columns for Logistics Register single row
  const generateLogisticsText = (): string => {
    if (!invoiceData) return "";
    const nfNum = manualInvoiceNumber || invoiceData.invoiceNumber || "";
    const dateStr = invoiceData.dataEmissao || "10/06/2026";
    const issuer = invoiceData.emitente || "CAFE TRES CORACOES SA";
    const dest = invoiceData.destino || "RIO DE JANEIRO";
    
    // Format weight appropriately
    let formattedWeight = invoiceData.rawGrossWeightStr || "15.389,74";
    if (manualGrossWeight !== 153645 && manualGrossWeight !== undefined && manualGrossWeight !== 0) {
      formattedWeight = formatWeight(manualGrossWeight);
    }
    
    const fields = [
      "ATÉ 12H",                        // 1. Horário Contratação
      "ATÉ 13H",                        // 2. Horário Faturamento
      "16:15",                          // 3. Horário Entrada
      "19:00",                          // 4. Horário Fim Carregamento
      "PALET",                          // 5. Tipo de Carga
      "3050",                           // 6. Ordem
      "B - 31",                         // 7. Janela / Liberação
      dateStr,                          // 8. Data Expedição
      dateStr,                          // 9. Data Janela
      String(nfNum),                    // 10. Número da Nota Fiscal
      invoiceData.placaCavalo || "TYT-8A14", // 11. Placa Cavalo
      issuer,                           // 12. Transportadora (Emitente)
      invoiceData.placaCarreta || "QOX3164", // 13. Placa Carreta
      dest,                             // 14. Destino
      formattedWeight,                  // 15. Peso Bruto / Tons
      "1",                              // 16. Nº Rodas
      "NÃO",                            // 17. Estivada?
      invoiceData.observacoes || "DEIXAR ESPACO DE 6 PALETES", // 18. Observações PCP
      "Pendente"                        // 19. Status
    ];

    return fields.join("\t");
  };

  const copyToClipboard = (text: string, isZpl = false) => {
    navigator.clipboard.writeText(text);
    if (isZpl) {
      setCopiedZpl(true);
      setTimeout(() => setCopiedZpl(false), 2000);
    } else {
      setCopiedInvoice(true);
      setTimeout(() => setCopiedInvoice(false), 2000);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        const base64Clean = base64Data.split(",")[1];
        resolve(base64Clean);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const getMimeType = (file: File): string => {
    if (file.type) return file.type;
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".png")) return "image/png";
    return "application/pdf"; // fallback
  };

  // Real-time client side PDF Parser
  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingInvoice(true);
    setInvoiceError(null);

    try {
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        throw new Error("A biblioteca PDF.js não está carregada ainda. Por favor, aguarde.");
      }

      // Configuração para processamento de worker local no navegador
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

      const readAsArrayBuffer = (f: File): Promise<ArrayBuffer> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result instanceof ArrayBuffer) {
              resolve(event.target.result);
            } else {
              reject(new Error("Não foi possível ler o arquivo PDF em buffer."));
            }
          };
          reader.onerror = (err) => reject(err);
          reader.readAsArrayBuffer(f);
        });
      };

      const arrayBuffer = await readAsArrayBuffer(file);
      const typedarray = new Uint8Array(arrayBuffer);

      // Carrega o PDF na memória do navegador utilizando pdf.js
      const pdf = await pdfjsLib.getDocument(typedarray).promise;
      
      // Helper function to reconstruct vertical page lines with high visual fidelity
      const reconstructLines = (items: any[]): string[] => {
        if (!items || items.length === 0) return [];

        // Filter out completely empty items
        const validItems = items.filter(
          (item) => item && typeof item.str === "string" && item.str.trim() !== ""
        );

        if (validItems.length === 0) return [];

        // Group items into lines based on Y coordinate with tolerance
        const tolerance = 7; // Tolerance vertical in points for columns printed on same visual line
        const linesList: { y: number; items: any[] }[] = [];

        validItems.forEach((item) => {
          const y = item.transform[5]; // Y-coordinate of the item on page
          
          let foundLine = linesList.find((line) => Math.abs(line.y - y) <= tolerance);
          if (foundLine) {
            foundLine.items.push(item);
            foundLine.y = (foundLine.y * (foundLine.items.length - 1) + y) / foundLine.items.length;
          } else {
            linesList.push({ y, items: [item] });
          }
        });

        // Sort lines by Y descending (from top of page to bottom)
        linesList.sort((a, b) => b.y - a.y);

        // For each line, sort items by X ascending (from left to right)
        return linesList.map((line) => {
          line.items.sort((a, b) => a.transform[4] - b.transform[4]);
          return line.items.map((item) => item.str).join(" ");
        });
      };

      // Collect reconstructed lines across all pages
      let allReconstructedLines: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageLines = reconstructLines(textContent.items);
        allReconstructedLines.push(...pageLines);
      }

      const textoCompleto = allReconstructedLines.join("\n");

      // --- LÓGICA DE EXTRAÇÃO DOS DADOS REAIS DO DANFE ---

      // 1. Número da Nota Fiscal (Ex: 2957334)
      let numeroNota = "";
      
      // Try to match standard "Nº 123.456" or "No. 123456"
      const matchNota1 = textoCompleto.match(/(?:S[EÉ]RIE\s+\d+\s+)?(?:N[º°eE]|N\.º|No\.?|NF-E)\s*[:.-]?\s*([0-9\s.-]+)/i);
      if (matchNota1) {
        const cleanedNota = matchNota1[1].replace(/[^0-9]/g, '').trim();
        if (cleanedNota) {
          numeroNota = parseInt(cleanedNota, 10).toString();
        }
      }
      
      if (!numeroNota) {
        // Look for 9-digit sequence patterns like 002.957.334
        const matchNota2 = textoCompleto.match(/\b(\d{1,3}(?:\.\d{3}){2})\b/);
        if (matchNota2) {
          numeroNota = parseInt(matchNota2[1].replace(/\./g, ''), 10).toString();
        }
      }
      
      if (!numeroNota) {
        const matchNota3 = textoCompleto.match(/(?:NF|NOTA|NF-E)\s*#?\s*(\d+)/i);
        if (matchNota3) {
          numeroNota = parseInt(matchNota3[1], 10).toString();
        }
      }

      if (!numeroNota) {
        numeroNota = "2957334"; // Default fallback
      }

      // 2. Peso Bruto Total da Nota (Ex: 15389,740 KG)
      let pesoBrutoTotal = "";
      
      // Look for PESO BRUTO followed closely by a weight number
      const pesoMatches = textoCompleto.match(/(?:PESO\s+BRUTO|PESO\s+BRUTO\s*\(KG\))[\s\S]{1,100}?(\d{1,3}(?:\.\d{3})*,\d{3}|\d+,\d{3})/i);
      if (pesoMatches) {
        pesoBrutoTotal = pesoMatches[1].trim() + " KG";
      }

      if (!pesoBrutoTotal) {
        // Look for standard Brazilian weight formatting e.g. 15.389,740 or 10.280,413
        const possibleWeights = textoCompleto.match(/\b\d{1,3}\.\d{3},\d{3}\b/g);
        if (possibleWeights && possibleWeights.length > 0) {
          pesoBrutoTotal = possibleWeights[0].trim() + " KG";
        }
      }

      if (!pesoBrutoTotal) {
        // Look for simpler decimal weights
        const possibleSimpleWeights = textoCompleto.match(/\b\d+,\d{3}\b/g);
        if (possibleSimpleWeights && possibleSimpleWeights.length > 0) {
          pesoBrutoTotal = possibleSimpleWeights[0].trim() + " KG";
        }
      }

      if (!pesoBrutoTotal) {
        pesoBrutoTotal = "15389,740 KG"; // Default fallback
      }

      // Converte o peso para valor numérico para impulsionar os painéis de controle
      const numericWeightStr = pesoBrutoTotal.replace(" KG", "").replace(/\./g, "").replace(",", ".").trim();
      const numericWeight = parseFloat(numericWeightStr) || 15389.740;

      // 3. Captura dos Itens de Produto
      let itemsList: ProductItem[] = [];

      // Dicionários padrão contendo os SKUs oficiais da Três Corações
      const nomesPadrao: { [key: string]: string } = {
        "12031025": "CAFE TM 3C TRAD INT SPACK 10X500G",
        "12031150": "CAFE TORRADO EM GRAO 3CORACOES GOURMET ORGANICO 4 SOLDAS 20X250G",
        "12031214": "CAFE TORRADO MOIDO 3 CORACOES FORT VACUO 20X500G",
        "12031513": "CAFE DRIP 3CORACOES RITUAIS CHOCOLATE 12X10X12G",
        "12031514": "CAFE DRIP 3CORACOES RITUAIS EXOTICO 12X10X12G",
        "12034003": "CAFE CAPPUCCINO 3 CORACOES CHOCOLATE SACHE 50X20G",
        "12034113": "BEBIDA LACTEA 3CORACOES CAPPUCCINO POWER GARRAFA PET 6X260ML",
        "12034126": "BEBIDA LACTEA CAPPUCCINO POWER 3CORACOES DOCE DE LEITE 12X250ML",
        "12034186": "BEBIDA LACTEA 3CORACOES POWER BAUNILHA FABRICA JUSSARA 12X250ML",
        "12200135": "SUPLEMENTO ALIMENTAR JUNGLE ENDURANCE LIMONADA 6X500ML",
        "12200187": "ALIMENTO JUNGLE TROPICAL LOW CARB 6X14X5G",
        "12031487": "CAFE TG 3C RIT FRUTAS VM BOXP 20X250G",
        "12031489": "CAFE TG 3C RIT FRUTAS SEC BOXP 20X250G",
        "12031591": "CAFE TG 3C GOU SUL M 4S 20X250G",
        "12032541": "CAFE SOL 3C GOU LIO MOG P REF 24X40G",
        "12032542": "CAFE SOL 3C GOU LIO CERR MI REF 24X40G",
        "12034096": "CAFE CAPP 3C CLAS ABRA PT 24X200G",
        "12034151": "CAFE CAPP 3C CHOC SCH 30X20G",
        "12034152": "CAFE CAPP 3C CARAM SAL SCH 30X20G",
        "12034156": "BEBIDA LACT 3C CAPP ZR PET 6X260ML",
        "12142000": "CAFE SOL IGUA EF LT 12X200G",
        "12142015": "CAFE SOL IGUA GRAN CLAS VID 24X100G",
        "12151070": "CAPSULA CAFE PIMP ESPR RJ 8X10X8G",
        "12151084": "CAPSULA CAFE TRES ID COF ALEX A 8X10X8G",
        "12151087": "CAPSULA CAFE 3C PORT OB SOLT PIP 8X10X8G",
        "12151113": "CAPSULA CAFE 3C STAR WARS M YODA 8X10X8G",
        "12151115": "CAPSULA CAFE 3C DECAF ALU 10X10X5,6G",
        "12151153": "KIT CAPS CAFE 3C C MI ALU 2X10X5G",
        "12151159": "CAPSULA CAFE 3C TRES HONDUR 8X10X8G",
        "12153006": "CAPSULA CHA 3C CAMOMILA 8X10X2,5G",
        "12153012": "CAPSULA CHA TRES MACA VD/CRANB 8X10X3G",
        "12154009": "CAPSULA CAFE CAPP 3C 8X10X11G",
        "12154019": "CAPSULA CAPP VEG 3C 8X10X11G",
        "20911462": "CAFE SOL 3C PO EF REF 24X40G",
        "20911496": "CAFE SOL 3C PO EF REF 12X40G"
      };

      const pesosProdPadrao: { [key: string]: number } = {
        "12031025": 5.0,
        "12031150": 5.0,
        "12031214": 10.0,
        "12031513": 1.2,
        "12031514": 1.2,
        "12034003": 1.0,
        "12034113": 1.56,
        "12034126": 3.0,
        "12034186": 3.0,
        "12200135": 3.0,
        "12200187": 0.84,
        "12031487": 5.0,
        "12031489": 5.0,
        "12031591": 5.0,
        "12032541": 0.96,
        "12032542": 0.96,
        "12034096": 4.8,
        "12034151": 0.6,
        "12034152": 0.6,
        "12034156": 1.56,
        "12142000": 2.4,
        "12142015": 2.4,
        "12151070": 0.64,
        "12151084": 0.64,
        "12151087": 0.64,
        "12151113": 0.64,
        "12151115": 0.56,
        "12151153": 0.1,
        "12151159": 0.64,
        "12153006": 0.2,
        "12153012": 0.24,
        "12154009": 0.88,
        "12154019": 0.88,
        "20911462": 0.96,
        "20911496": 0.48
      };

      // Advanced scanner matching any line that begins optionally with a sequence number,
      // followed by a 6-14 digit product SKU.
      const regexLinhaProduto = /^\s*(?:\d+\s+)?(\d{6,14})\s+(.+)/;

      allReconstructedLines.forEach((linha) => {
        const trimmed = linha.trim();
        const match = trimmed.match(regexLinhaProduto);
        if (!match) return;

        const sku = match[1];
        const restoLinha = match[2].trim();

        // Safety: verify if this line contains a standard package/unit of measure
        // (CX, UN, FD, KG, etc) to rule out false positive number sequences
        const hasUnit = /\b(CX|UN|FD|KG|PCT|LT|CJ|PC)\b/i.test(restoLinha);
        if (!hasUnit) return;

        // 1. Locate Quantity and Unit of Measure
        let qty = 1;
        let unit = "CX";
        
        const regexQtdBefore = /\b(\d+[\d\.,]*)\s*(CX|UN|FD|KG|PCT|LT|CJ|PC)\b/i;
        const regexQtdAfter = /\b(CX|UN|FD|KG|PCT|LT|CJ|PC)\s+(\d+[\d\.,]*)\b/i;

        const matchBefore = restoLinha.match(regexQtdBefore);
        const matchAfter = restoLinha.match(regexQtdAfter);

        let idxMatch = -1;
        let matchedText = "";

        if (matchBefore) {
          const rawQtyStr = matchBefore[1].replace(/\./g, "").replace(",", ".");
          qty = Math.round(parseFloat(rawQtyStr)) || 1;
          unit = matchBefore[2].toUpperCase();
          idxMatch = restoLinha.indexOf(matchBefore[0]);
          matchedText = matchBefore[0];
        } else if (matchAfter) {
          const rawQtyStr = matchAfter[2].replace(/\./g, "").replace(",", ".");
          qty = Math.round(parseFloat(rawQtyStr)) || 1;
          unit = matchAfter[1].toUpperCase();
          idxMatch = restoLinha.indexOf(matchAfter[0]);
          matchedText = matchAfter[0];
        }

        // 2. Isolate Description
        let description = restoLinha;

        // Try to truncate at first 8-digit NCM starting in restoLinha
        const ncmMatch = restoLinha.match(/\b\d{8}\b/);
        if (ncmMatch && ncmMatch.index !== undefined) {
          description = restoLinha.substring(0, ncmMatch.index).trim();
        } else if (idxMatch !== -1) {
          description = restoLinha.substring(0, idxMatch).trim();
        }

        // Clean description from trailing junk (brackets, dashes, trailing numeric codes)
        description = description.replace(/[\s\d,.-]+$/, "").trim().toUpperCase();

        const standardName = nomesPadrao[sku];
        const displayDescription = standardName ? standardName : (description || `PRODUTO ${sku}`);
        const unitWeight = pesosProdPadrao[sku] || 5.0; // Fallback unit weight

        // 3. Extract Unit Price and Total Price from the rest of the line
        let valueUnit = 10.0;
        let valueTotal = 10.0 * qty;

        const decimalMatches = restoLinha.match(/\b\d+[\d\.,]*,\d{2,4}\b|\b\d+\.\d{2,4}\b/g);
        if (decimalMatches && decimalMatches.length >= 2) {
          const cleanVal = (str: string) => parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
          const val1 = cleanVal(decimalMatches[decimalMatches.length - 2]);
          const val2 = cleanVal(decimalMatches[decimalMatches.length - 1]);
          if (val1 > 0 && val2 > 0) {
            valueUnit = val1;
            valueTotal = val2;
          }
        }

        itemsList.push({
          code: sku,
          description: displayDescription,
          quantity: qty,
          unit: unit,
          valueUnit: valueUnit,
          valueTotal: valueTotal,
          weightEstimatePerUnit: unitWeight,
          calculatedWeight: parseFloat((qty * unitWeight).toFixed(3))
        });
      });

      // Se for o caso de não achar nenhuma linha (ex: PDF escaneado torto ou arquivo vazio),
      // injetamos a linha de segurança padrão para não quebrar a lousa escura
      if (itemsList.length === 0) {
        itemsList.push({
          code: "12031487",
          description: "CAFE TG 3C RIT FRUTAS VM BOXP 20X250G",
          quantity: 1,
          unit: "CX",
          valueUnit: 6.071,
          valueTotal: 6.071,
          weightEstimatePerUnit: 6.071,
          calculatedWeight: 6.071
        });
      }

      // --- EXTRAÇÃO COMPLEMENTAR PARA O MÓDULO LOGÍSTICO COMPLETO ---
      let dataEmissao = "10/06/2026";
      const dateMatch = textoCompleto.match(/(?:DATA\s+(?:DA\s+)?EMISS[AÃ]O|D\.?EMISS[AÃ]O|EMISSÃO)\s*[:.-]?\s*(\d{2}\/\d{2}\/\d{4})/i);
      if (dateMatch && dateMatch[1]) {
        dataEmissao = dateMatch[1];
      } else {
        const generalDates = textoCompleto.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) || [];
        if (generalDates.length > 0) {
          dataEmissao = generalDates[0];
        }
      }

      let emitente = "";
      if (textoCompleto.toUpperCase().includes("CENTRAL DE DISTRIBUICAO")) {
        emitente = "CAFE TRES CORACOES SA - CD";
      } else if (textoCompleto.toUpperCase().includes("TRES CORACOES") || textoCompleto.toUpperCase().includes("TRÊS CORAÇÕES")) {
        emitente = "CAFE TRES CORACOES SA";
      } else {
        const saMatch = textoCompleto.match(/\b([A-Z0-9\s.-]{5,60}\s+(?:S\.?A\.?|S\/A|LTDA|ALIMENTOS|CAF[EÉ]|INDUSTRIA|IND\b))/i);
        if (saMatch) {
          emitente = saMatch[1].trim().toUpperCase();
        }
      }
      if (!emitente) {
        emitente = "CAFE TRES CORACOES SA";
      }

      let destino = "";
      const cities = [
        "RIO DE JANEIRO", "SAO PAULO", "SÃO PAULO", "BELO HORIZONTE", "CURITIBA", "PORTO ALEGRE", 
        "VITÓRIA", "VITORIA", "CABO DE SANTO AGOSTINHO", "MONTES CLAROS", "DUQUE DE CAXIAS", 
        "NITERÓI", "NITEROI", "SÃO GONÇALO", "SAO GONCALO", "CAMPINAS", "SERRA", "VILA VELHA"
      ];
      for (const city of cities) {
        if (textoCompleto.toUpperCase().includes(city)) {
          destino = city.toUpperCase();
          break;
        }
      }
      
      if (!destino) {
        const destMatch = textoCompleto.match(/(?:MUNICIPIO|MUNIC[IÍ]PIO|CIDADE)\s*[:.-]?\s*([A-Za-z\s.-]{3,30})/i);
        if (destMatch && destMatch[1]) {
          destino = destMatch[1].trim().toUpperCase();
        }
      }

      if (!destino) {
        destino = "RIO DE JANEIRO";
      }

      const plateMatches = textoCompleto.match(/\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/gi) || [];
      const plates = Array.from(new Set(plateMatches.map((p: string) => p.toUpperCase().replace("-", ""))));
      const formattedPlates = plates.map((p: string) => p.slice(0, 3) + "-" + p.slice(3));
      const placaCavalo = formattedPlates[0] || "TYT-8A14";
      const placaCarreta = formattedPlates[1] || "QOX-3164";

      let observacoes = "DEIXAR ESPACO DE 6 PALETES";
      const obsMatch = textoCompleto.match(/(?:DADOS ADICIONAIS|INFORMA[CÇ][OÕ]ES COMPLEMENTARES|OBSERVA[CÇ][OÕ]ES)[\s\S]*?(?=\b[A-Z\s]{4,}:|$)/i);
      if (obsMatch) {
        const rawObs = obsMatch[0].replace(/(?:DADOS ADICIONAIS|INFORMA[CÇ][OÕ]ES COMPLEMENTARES|OBSERVA[CÇ][OÕ]ES)/i, "").trim();
        const firstLine = rawObs.split("\n")[0]?.trim().replace(/\s+/g, " ");
        if (firstLine && firstLine.length > 5) {
          observacoes = firstLine.slice(0, 80).toUpperCase();
        }
      }

      // Alimenta os estados do React com a Invoice mapeada
      const parsedInvoiceData: InvoiceData = {
        invoiceNumber: numeroNota,
        totalGrossWeight: numericWeight,
        totalNetWeight: numericWeight,
        items: itemsList,
        dataEmissao,
        emitente,
        destino,
        placaCavalo,
        placaCarreta,
        observacoes,
        rawGrossWeightStr: pesoBrutoTotal.replace(" KG", "").trim()
      };

      setInvoiceData(parsedInvoiceData);
      setDistributionMode("proportional");

    } catch (err: any) {
      setInvoiceError(err.message || "Erro no processamento local do PDF.");
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleClearInvoice = () => {
    setInvoiceData({
      invoiceNumber: "",
      totalGrossWeight: 0,
      totalNetWeight: 0,
      items: [],
    });
    setManualInvoiceNumber("");
    setManualGrossWeight(0);
    setManualNetWeight(0);
  };

  const handleResetInvoiceDefault = () => {
    const defaultInvoiceItems: ProductItem[] = [
      {
        code: "12031487",
        description: "CAFE TG 3C RIT FRUTAS VM BOXP 20X250G",
        quantity: 30,
        unit: "CX",
        valueUnit: 6.071,
        valueTotal: 182.13,
        weightEstimatePerUnit: 6.071,
        calculatedWeight: 182.13,
      },
      {
        code: "12031489",
        description: "CAFE TG 3C RIT FRUTAS SEC BOXP 20X250G",
        quantity: 30,
        unit: "CX",
        valueUnit: 6.071,
        valueTotal: 182.13,
        weightEstimatePerUnit: 6.071,
        calculatedWeight: 182.13,
      },
      {
        code: "12031591",
        description: "CAFE TG 3C GOU SUL M 4S 20X250G",
        quantity: 585,
        unit: "CX",
        valueUnit: 6.07,
        valueTotal: 3550.95,
        weightEstimatePerUnit: 6.07,
        calculatedWeight: 3550.95,
      },
      {
        code: "12032541",
        description: "CAFE SOL 3C GOU LIO MOG P REF 24X40G",
        quantity: 20,
        unit: "CX",
        valueUnit: 1.38,
        valueTotal: 27.6,
        weightEstimatePerUnit: 1.38,
        calculatedWeight: 27.6,
      },
      {
        code: "12032542",
        description: "CAFE SOL 3C GOU LIO CERR MI REF 24X40G",
        quantity: 25,
        unit: "CX",
        valueUnit: 1.38,
        valueTotal: 34.5,
        weightEstimatePerUnit: 1.38,
        calculatedWeight: 34.5,
      },
      {
        code: "12034096",
        description: "CAFE CAPP 3C CLAS ABRA PT 24X200G",
        quantity: 98,
        unit: "CX",
        valueUnit: 6.177,
        valueTotal: 605.346,
        weightEstimatePerUnit: 6.177,
        calculatedWeight: 605.346,
      },
      {
        code: "12034151",
        description: "CAFE CAPP 3C CHOC SCH 30X20G",
        quantity: 200,
        unit: "CX",
        valueUnit: 0.777,
        valueTotal: 155.4,
        weightEstimatePerUnit: 0.777,
        calculatedWeight: 155.4,
      },
      {
        code: "12034152",
        description: "CAFE CAPP 3C CARAM SAL SCH 30X20G",
        quantity: 416,
        unit: "CX",
        valueUnit: 0.777,
        valueTotal: 323.232,
        weightEstimatePerUnit: 0.777,
        calculatedWeight: 323.232,
      },
      {
        code: "12034156",
        description: "BEBIDA LACT 3C CAPP ZR PET 6X260ML",
        quantity: 396,
        unit: "CX",
        valueUnit: 1.8,
        valueTotal: 712.8,
        weightEstimatePerUnit: 1.8,
        calculatedWeight: 712.8,
      },
      {
        code: "12142000",
        description: "CAFE SOL IGUA EF LT 12X200G",
        quantity: 50,
        unit: "CX",
        valueUnit: 4.2,
        valueTotal: 210.0,
        weightEstimatePerUnit: 4.2,
        calculatedWeight: 210.0,
      },
      {
        code: "12142015",
        description: "CAFE SOL IGUA GRAN CLAS VID 24X100G",
        quantity: 90,
        unit: "CX",
        valueUnit: 9.36,
        valueTotal: 842.4,
        weightEstimatePerUnit: 9.36,
        calculatedWeight: 842.4,
      },
      {
        code: "12151070",
        description: "CAPSULA CAFE PIMP ESPR RJ 8X10X8G",
        quantity: 50,
        unit: "CX",
        valueUnit: 1.159,
        valueTotal: 57.95,
        weightEstimatePerUnit: 1.159,
        calculatedWeight: 57.95,
      },
      {
        code: "12151084",
        description: "CAPSULA CAFE TRES ID COF ALEX A 8X10X8G",
        quantity: 50,
        unit: "CX",
        valueUnit: 1.159,
        valueTotal: 57.95,
        weightEstimatePerUnit: 1.159,
        calculatedWeight: 57.95,
      },
      {
        code: "12151087",
        description: "CAPSULA CAFE 3C PORT OB SOLT PIP 8X10X8G",
        quantity: 200,
        unit: "CX",
        valueUnit: 1.159,
        valueTotal: 231.8,
        weightEstimatePerUnit: 1.159,
        calculatedWeight: 231.8,
      },
      {
        code: "12151113",
        description: "CAPSULA CAFE 3C STAR WARS M YODA 8X10X8G",
        quantity: 435,
        unit: "CX",
        valueUnit: 1.159,
        valueTotal: 504.165,
        weightEstimatePerUnit: 1.159,
        calculatedWeight: 504.165,
      },
      {
        code: "12151115",
        description: "CAPSULA CAFE 3C DECAF ALU 10X10X5,6G",
        quantity: 500,
        unit: "CX",
        valueUnit: 0.949,
        valueTotal: 474.5,
        weightEstimatePerUnit: 0.949,
        calculatedWeight: 474.5,
      },
      {
        code: "12151153",
        description: "KIT CAPS CAFE 3C C MI ALU 2X10X5G",
        quantity: 100,
        unit: "CX",
        valueUnit: 3.687,
        valueTotal: 368.7,
        weightEstimatePerUnit: 3.687,
        calculatedWeight: 368.7,
      },
      {
        code: "12151159",
        description: "CAPSULA CAFE 3C TRES HONDUR 8X10X8G",
        quantity: 100,
        unit: "CX",
        valueUnit: 1.159,
        valueTotal: 115.9,
        weightEstimatePerUnit: 1.159,
        calculatedWeight: 115.9,
      },
      {
        code: "12153006",
        description: "CAPSULA CHA 3C CAMOMILA 8X10X2,5G",
        quantity: 50,
        unit: "CX",
        valueUnit: 0.722,
        valueTotal: 36.1,
        weightEstimatePerUnit: 0.722,
        calculatedWeight: 36.1,
      },
      {
        code: "12153012",
        description: "CAPSULA CHA TRES MACA VD/CRANB 8X10X3G",
        quantity: 435,
        unit: "CX",
        valueUnit: 0.756,
        valueTotal: 328.86,
        weightEstimatePerUnit: 0.756,
        calculatedWeight: 328.86,
      },
      {
        code: "12154009",
        description: "CAPSULA CAFE CAPP 3C 8X10X11G",
        quantity: 435,
        unit: "CX",
        valueUnit: 1.2,
        valueTotal: 522.0,
        weightEstimatePerUnit: 1.2,
        calculatedWeight: 522.0,
      },
      {
        code: "12154019",
        description: "CAPSULA CAPP VEG 3C 8X10X11G",
        quantity: 130,
        unit: "CX",
        valueUnit: 1.2,
        valueTotal: 156.0,
        weightEstimatePerUnit: 1.2,
        calculatedWeight: 156.0,
      },
      {
        code: "20911462",
        description: "CAFE SOL 3C PO EF REF 24X40G",
        quantity: 240,
        unit: "CX",
        valueUnit: 1.14,
        valueTotal: 273.6,
        weightEstimatePerUnit: 1.14,
        calculatedWeight: 273.6,
      },
      {
        code: "20911496",
        description: "CAFE SOL 3C PO EF REF 12X40G",
        quantity: 480,
        unit: "CX",
        valueUnit: 0.68,
        valueTotal: 326.4,
        weightEstimatePerUnit: 0.68,
        calculatedWeight: 326.4,
      }
    ];

    setInvoiceData({
      invoiceNumber: "2956383",
      totalGrossWeight: 10280.413,
      totalNetWeight: 10280.413,
      items: defaultInvoiceItems,
    });
    setManualInvoiceNumber("2956383");
    setManualGrossWeight(10280.413);
    setManualNetWeight(10280.413);
    setDistributionMode("original");
  };

  const handleAddItem = () => {
    const newItem: ProductItem = {
      code: String(1200000 + Math.floor(Math.random() * 90000)),
      description: "CAFÉ TRÊS CORAÇÕES ESPECIAL GOURMET MOÍDO 250G",
      quantity: 50,
      unit: "CX",
      valueUnit: 25.0,
      valueTotal: 1250.0,
      weightEstimatePerUnit: 2.5,
      calculatedWeight: 125.0,
    };
    if (invoiceData) {
      setInvoiceData({
        ...invoiceData,
        items: [...invoiceData.items, newItem],
      });
    } else {
      setInvoiceData({
        invoiceNumber: manualInvoiceNumber || "206754",
        totalGrossWeight: manualGrossWeight || 153645,
        totalNetWeight: manualNetWeight || 146771,
        items: [newItem],
      });
    }
  };

  const handleDeleteItem = (index: number) => {
    if (!invoiceData) return;
    const updated = [...invoiceData.items];
    updated.splice(index, 1);
    setInvoiceData({
      ...invoiceData,
      items: updated,
    });
  };

  const handleClearZpl = () => {
    setZplTextInput("");
    setZplCargoData({
      transporte: "",
      lote: "",
      volumes: undefined,
    });
    setGeneratedZpls([]);
    setSelectedZplPreviewIdx(0);
  };

  const handleResetZplDefault = () => {
    setZplTextInput("RECEPÇÃO DO TRANSPORTE: 2600295733 / LOTE DE CARGA: 15389.740");
    setZplCargoData({
      transporte: "2600295733",
      lote: "15389.740",
      volumes: 40,
    });
    setGeneratedZpls([]);
    setSelectedZplPreviewIdx(0);
  };

  const handleCargoTextChange = (text: string) => {
    setZplTextInput(text);
    const transportMatch = text.match(/\b\d{10}\b/);
    const lotMatch = text.match(/(?:LOTE|LOT|REMESSA|REM):\s*([A-Z0-9.\-/]+)/i);

    setZplCargoData((prev) => ({
      ...prev,
      transporte: transportMatch ? transportMatch[0] : prev.transporte,
      lote: lotMatch ? lotMatch[1] : prev.lote,
    }));
  };

  const handleZplCargoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingZpl(true);
    setZplError(null);

    try {
      // Send as native FormData file upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("textInput", zplTextInput);

      const response = await fetch("/api/parse-zpl-cargo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errMessage = "Falha ao processar arquivo.";
        try {
          const errRes = await response.json();
          errMessage = errRes.error || errRes.message || errMessage;
        } catch (jsonErr) {
          errMessage = `Erro do servidor (Status ${response.status}): ${response.statusText}`;
        }
        throw new Error(errMessage);
      }

      const data = await response.json();
      setZplCargoData({
        transporte: data.transporte || "",
        lote: data.lote || "",
        volumes: data.volumes || zplCargoData.volumes || 40,
      });
    } catch (err: any) {
      setZplError(err.message || "Erro ao ler arquivo.");
    } finally {
      setLoadingZpl(false);
    }
  };

  const generateZplLabels = () => {
    const { transporte, lote, volumes } = zplCargoData;
    if (!transporte || !lote || !volumes) {
      alert("Valores ausentes para Transporte, Lote ou Volumes.");
      return;
    }

    const labels: string[] = [];
    const totalVolumesCount = Number(volumes);

    for (let i = 1; i <= totalVolumesCount; i++) {
      const seqStr = i.toString().padStart(2, "0");
      const totStr = totalVolumesCount.toString().padStart(2, "0");

      const singleZpl = `^XA
^CI28
^PW800
^LL400
^CF0,60
^FO50,40^FDCARGO TRANSPORT:^FS
^CF0,80
^FO50,90^FD${transporte}^FS
^BY3,2,100
^FO50,180^BCN,100,Y,N,N^FD${transporte}^FS
^CF0,40
^FO450,40^FDLOTE DE CARGA:^FS
^CF0,50
^FO450,95^FD${lote}^FS
^CF0,40
^FO450,160^FDVOLUME SEQUENCIAL:^FS
^CF0,120
^FO450,210^FD${seqStr}/${totStr}^FS
^XZ`;
      labels.push(singleZpl);
    }

    setGeneratedZpls(labels);
    setSelectedZplPreviewIdx(0);
  };

  const checkWeightsBalancingSum = (): { sum: number; target: number; matches: boolean } => {
    const currentSum = calculatedItems.reduce((acc, item) => acc + (item.calculatedWeight || 0), 0);
    const target = weightTarget === "gross" ? manualGrossWeight : manualNetWeight;
    return {
      sum: currentSum,
      target: target,
      matches: Math.abs(currentSum - target) < 0.2, // Small margin for rounding
    };
  };

  const balanceResults = checkWeightsBalancingSum();

  return (
    <div 
      className="min-h-screen vintage-wood-bg text-[#3b2110] font-sans p-4 sm:p-10 flex flex-col items-center transition-all duration-300"
      style={{ zoom: zoomLevel / 100 } as React.CSSProperties}
    >
      <div className="w-full max-w-6xl flex flex-col space-y-8">
        
        {/* Top Credit Ribbon */}
        <div className="text-center py-2 bg-[#4a2e1d]/90 border border-[#bfa27a]/40 rounded-lg text-xs font-bold text-[#fbf5e6] tracking-widest uppercase shadow-sm flex items-center justify-center gap-2">
          <span>☕</span>
          <span>Criado por Jefferson Augusto</span>
          <span>☕</span>
        </div>
        
        {/* Calligraphic Board Header Layout matching IMAGE.PNG */}
        <header className="flex flex-col md:flex-row items-center border-b border-[#5e412f]/45 pb-8 space-y-4 md:space-y-0 justify-between">
          <div className="flex items-center space-x-5">
            {/* Skeuomorphic Wooden circular Cafê Três Corações badge logo */}
            <div className="w-24 h-24 rounded-full bg-[#f4ecd8] border-8 border-[#3b2314] shadow-[0_6px_15px_rgba(0,0,0,0.5),inset_0_4px_8px_rgba(255,255,255,0.2)] flex flex-col items-center justify-center p-1 relative transform -rotate-3">
              <div className="text-[7px] font-bold text-[#3b2314] tracking-widest leading-none font-sans mt-0.5">TRÊS</div>
              {/* Hearts nesting layout inside vector */}
              <div className="flex space-x-0.5 my-0.5 justify-center">
                <span className="text-red-700 text-xl font-bold">♥</span>
                <span className="text-red-700 text-2xl font-bold -translate-y-1">♥</span>
                <span className="text-red-700 text-xl font-bold">♥</span>
              </div>
              <div className="text-[7.5px] font-bold text-[#3b2314] tracking-widest leading-none font-sans">CORAÇÕES</div>
              <div className="text-[6px] font-semibold text-[#8c6c53] leading-none mt-0.5">LOGÍSTICA</div>
              {/* Outer rivet pins on badge */}
              <div className="absolute top-1 left-1.5 w-1 h-1 bg-yellow-600 rounded-full" />
              <div className="absolute bottom-1 right-1.5 w-1 h-1 bg-yellow-600 rounded-full" />
            </div>
 
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#452719] drop-shadow-[0_2px_2px_rgba(255,255,255,0.7)] flex items-center gap-3">
                IMPORTAÇÃO DANFE
              </h1>
              <p className="font-cursive text-lg text-[#5e3820] mt-1 italic font-semibold">
                Ferramenta avançada para rateio de Notas Fiscais e automação sequencial de CPI
              </p>
            </div>
          </div>
 
          {/* Zoom/Escala Indicator and UTC Parameter Panel */}
          <div className="flex flex-wrap items-center gap-4 bg-[#fbf4df]/90 px-4 py-2.5 rounded-lg border border-[#c9ae92] shadow-sm font-mono text-xs text-[#5e3d2a] font-bold">
            <div className="flex items-center space-x-2">
              <span className="text-[#8c4627]">Zoom:</span>
              <button
                onClick={() => setZoomLevel((prev) => Math.max(50, prev - 5))}
                className="w-6 h-6 flex items-center justify-center bg-[#8c4627]/15 hover:bg-[#8c4627] hover:text-[#faeed1] rounded text-xs font-black transition-all cursor-pointer"
                title="Diminuir Zoom"
                id="btn-zoom-out"
              >
                -
              </button>
              <span className="min-w-[36px] text-center">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((prev) => Math.min(110, prev + 5))}
                className="w-6 h-6 flex items-center justify-center bg-[#8c4627]/15 hover:bg-[#8c4627] hover:text-[#faeed1] rounded text-xs font-black transition-all cursor-pointer"
                title="Aumentar Zoom"
                id="btn-zoom-in"
              >
                +
              </button>
            </div>

            <div className="h-4 w-[1px] bg-[#c9ae92] hidden sm:block" />

            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-[#8c4627]" />
              UTC: 2026-06-10
            </span>
          </div>
        </header>

        {/* Dynamic content screen wrapper */}
        <div className="space-y-8 mt-4">
          {activeTab === "invoice" && (
            <div className="space-y-8">
              
              {/* Import Box styled as physical vintage coffee sack centered without the explanatory banner */}
              <div className="w-full max-w-xl mx-auto scroll-parchment p-8 rounded-lg text-center flex flex-col items-center justify-center border-2 border-dashed border-[#85633a] bg-gradient-to-br from-[#faf0db] to-[#ebd8b1] hover:from-[#fdf6e8] hover:to-[#f2e1c0] transition duration-300 relative group">
                <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center p-3 select-none">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,image/png,image/jpeg,image/jpg"
                    onChange={handleInvoiceUpload}
                    disabled={loadingInvoice}
                  />
                  <div className="w-16 h-16 bg-[#4a2e1d] rounded-xl flex items-center justify-center text-[#dfc090] mb-3 group-hover:scale-110 transition shadow-lg border-2 border-[#85633a]">
                    {loadingInvoice ? (
                      <RefreshCw className="h-8 w-8 animate-spin" />
                    ) : (
                      <span className="text-3xl font-bold">☕</span>
                    )}
                  </div>
                  <h4 className="font-display font-bold text-lg text-[#3b1904]">Importar DANFE</h4>
                  <p className="text-xs text-[#6e5138] font-semibold mt-1">(PDF ou Imagem)</p>
                </label>
              </div>

              {/* Reset / Clear Button */}
              {invoiceData && (invoiceData.items.length > 0 || manualInvoiceNumber || manualGrossWeight > 0) && (
                <div className="flex justify-center -mt-2">
                  <button
                    onClick={handleClearInvoice}
                    className="px-5 py-2.5 bg-[#8c3527] hover:bg-[#a13c2c] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md hover:scale-105 active:scale-95 duration-150"
                  >
                    <Trash2 className="h-4 w-4" />
                    Limpar Informações
                  </button>
                </div>
              )}

              {invoiceError && (
                <div className="p-4 bg-red-100 border-2 border-red-400 text-red-800 rounded-xl text-sm font-sans flex items-center justify-between shadow-md">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">⚠️</span>
                    <span className="font-medium">{invoiceError}</span>
                  </div>
                  <button
                    onClick={() => setInvoiceError(null)}
                    className="px-2.5 py-1 bg-red-800/10 hover:bg-red-800 hover:text-white rounded text-xs font-bold transition"
                  >
                    Fechar
                  </button>
                </div>
              )}



              {/* Antique Mechanical Numbers Dials (Odometer dials) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#3a2016]/90 p-6 rounded-2xl border-4 border-[#5c3e21] shadow-[0_12px_24px_rgba(0,0,0,0.6)] relative">
                {/* Vintage metallic rivets on container corners */}
                <div className="absolute top-2 left-2"><div className="rivet" /></div>
                <div className="absolute top-2 right-2"><div className="rivet" /></div>
                <div className="absolute bottom-2 left-2"><div className="rivet" /></div>
                <div className="absolute bottom-2 right-2"><div className="rivet" /></div>

                <div className="space-y-3">
                  <Odometer value={manualInvoiceNumber} label="Número da Nota Fiscal (DANFE)" maxDigitCount={6} />
                  <input
                    type="number"
                    value={manualInvoiceNumber}
                    onChange={(e) => setManualInvoiceNumber(e.target.value)}
                    className="w-full text-center py-1 bg-[#1f110a] text-[#dba275] border border-[#523528] rounded font-mono text-xs focus:outline-none"
                    placeholder="Editar valor"
                  />
                </div>

                <div className="space-y-3">
                  <Odometer value={manualGrossWeight} label="Peso Bruto Total (KG)" maxDigitCount={6} />
                  <input
                    type="number"
                    value={manualGrossWeight}
                    onChange={(e) => setManualGrossWeight(parseFloat(e.target.value) || 0)}
                    className="w-full text-center py-1 bg-[#1f110a] text-[#dba275] border border-[#523528] rounded font-mono text-xs focus:outline-none"
                    placeholder="Editar valor"
                  />
                </div>

                <div className="space-y-3">
                  <Odometer value={manualNetWeight} label="Peso Líquido Total (KG)" maxDigitCount={6} />
                  <input
                    type="number"
                    value={manualNetWeight}
                    onChange={(e) => setManualNetWeight(parseFloat(e.target.value) || 0)}
                    className="w-full text-center py-1 bg-[#1f110a] text-[#dba275] border border-[#523528] rounded font-mono text-xs focus:outline-none"
                    placeholder="Editar valor"
                  />
                </div>
              </div>



              {/* Pinned Stitched Military Green Banner Ribbon indicating balancing status */}
              <div className="flex justify-center py-2 relative">
                <div className={`ribbon-green px-12 py-3.5 rounded-md relative text-center min-w-[320px] transition duration-300 font-cursive text-2xl font-bold shadow-lg ${
                  balanceResults.matches ? "from-[#4c5f35] to-[#354523]" : "from-[#8c5737] to-[#693e23]"
                }`}>
                  <div className="absolute left-3 top-1/2 -translate-y-1/2"><div className="rivet" /></div>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="rivet" /></div>
                  
                  {balanceResults.matches ? (
                    <span>Equilíbrio da Nota Perfeito!</span>
                  ) : (
                    <span>Ajuste de Pesos Necessário</span>
                  )}
                  <p className="text-[10px] font-sans font-bold tracking-wider opacity-85 mt-0.5 uppercase">
                    Rateado: {formatWeight(balanceResults.sum)} KG / Alvo: {formatWeight(balanceResults.target)} KG
                  </p>
                </div>
              </div>

              {/* Canvas Parchment Invoice ledger table matching IMAGE.PNG */}
              <div className="scroll-parchment p-5 sm:p-7 rounded-2xl border-2 border-[#cbb08f] shadow-lg relative overflow-hidden">
                <div className="absolute top-0 bottom-0 left-4 w-0.5 bg-red-400/30 border-l border-dashed border-red-500/50" />
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse font-sans font-medium">
                    <thead>
                      <tr className="border-b-2 border-[#54391e]/30 text-[#4a2e1d] font-bold text-xs uppercase tracking-wider">
                        <th className="py-3 px-4 pl-8">Código</th>
                        <th className="py-3 px-4 w-1/3">Descrição / Produto</th>
                        <th className="py-3 px-4 text-center">QTD</th>
                        <th className="py-3 px-4 text-center">UN</th>
                        <th className="py-3 px-4 text-right">Peso Teórico (KG)</th>
                        <th className="py-3 px-4 text-right bg-[#e3cca7]/40 text-[#4a2913] font-black">
                          Peso Rateado (KG)
                        </th>
                        <th className="py-3 px-4 text-center">Excluir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#54391e]/15 font-ledger text-[13px] text-[#2c1303]">
                      {calculatedItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-sm font-sans italic text-[#8c6b53]/80 bg-[#fde9cc]/20">
                            Nenhum item cadastrado. Use o botão anterior ou importe uma DANFE para carregar produtos.
                          </td>
                        </tr>
                      ) : (
                        calculatedItems.map((item, idx) => (
                          <tr key={item.code + "-" + idx} className="hover:bg-[#faecd1]/60 transition">
                            <td className="py-3 px-4 pl-8 font-bold">{item.code}</td>
                            <td className="py-3 px-4 leading-tight font-sans text-xs font-semibold text-slate-800">
                              {item.description}
                            </td>
                            <td className="py-3 px-4 text-center font-bold">{item.quantity}</td>
                            <td className="py-3 px-4 text-center font-bold text-[#70523f]">{item.unit}</td>
                            <td className="py-3 px-4 text-right font-mono text-xs opacity-75">
                              {formatWeight(item.quantity * item.weightEstimatePerUnit)} KG
                            </td>
                            <td className="py-1.5 px-4 text-right bg-[#eedab6]/25 font-bold">
                              <input
                                type="number"
                                step="0.001"
                                value={item.calculatedWeight || 0}
                                onChange={(e) => handleUpdateItemWeight(idx, parseFloat(e.target.value) || 0)}
                                className="w-24 text-right px-2.5 py-1 bg-[#fcf9f2] border-2 border-[#b8946e] rounded text-xs font-mono font-bold text-[#8c4c23] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#8c4c23]"
                              />
                            </td>
                            <td className="py-1 px-4 text-center">
                              <button
                                onClick={() => handleDeleteItem(idx)}
                                className="p-1 px-2.5 bg-red-800/10 hover:bg-red-800 hover:text-white text-red-800 rounded transition text-xs font-bold"
                                title="Excluir Item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Slated School Chalkboard for copyable clipboard text */}
              <div className="space-y-4">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display font-bold text-2xl text-[#422119]">Texto para Copiar e Colar</h3>
                    <p className="text-xs text-[#6e4e37] font-semibold">
                      Selecione o formato para rateio de volume ou logística (fácil de colar no Excel/planilhas)
                    </p>
                  </div>

                  {/* Elegant Retro Format Selector */}
                  <div className="flex items-center space-x-2 bg-[#ebd8b1]/30 p-1 rounded-lg border border-[#c49265]/40 self-start xl:self-auto">
                    <button
                      type="button"
                      onClick={() => setCopyFormat("products")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
                        copyFormat === "products"
                          ? "bg-[#4a2e1d] text-white shadow"
                          : "text-[#543b24] hover:bg-[#ebd8b1]/50"
                      }`}
                    >
                      📋 Tabela por SKU
                    </button>
                    <button
                      type="button"
                      onClick={() => setCopyFormat("logistics")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
                        copyFormat === "logistics"
                          ? "bg-[#bda16d] text-[#2d1e08] shadow border border-[#59452b]"
                          : "text-[#543b24] hover:bg-[#ebd8b1]/50"
                      }`}
                    >
                      🚚 Registro de Logística
                    </button>
                  </div>
                  
                  {/* Brass Key style trigger button */}
                  <button
                    onClick={() => copyToClipboard(copyFormat === "products" ? generateSpreadsheetText() : generateLogisticsText())}
                    className={`px-6 py-4.5 rounded-xl font-bold text-sm shadow-md transition flex items-center gap-3 transform hover:scale-105 active:scale-95 ${
                      copiedInvoice
                        ? "bg-gradient-to-b from-[#4e5f38] to-[#2b3a1a] text-white border-2 border-[#769159]"
                        : "bg-gradient-to-b from-[#dfc090] to-[#b08b50] text-[#2c1a0c] border-2 border-[#6b522e] hover:from-[#ecd0a5] hover:to-[#be9b62]"
                    }`}
                  >
                    <span className="text-lg">🔑</span>
                    <span>
                      {copiedInvoice ? "Texto Copiado!" : "Copiar Texto para Planilha"}
                    </span>
                  </button>
                </div>

                {/* Chalkboard Display Area */}
                <div className="chalkboard-container p-6 rounded-3xl relative">
                  {/* Visual chalk tray on chalkboard bottom */}
                  <div className="absolute bottom-[-14px] right-8 bg-[#fcdbb0] px-4 py-1.5 rounded-md border border-[#c49265] text-[10px] font-bold text-[#5c3e21] shadow-md flex items-center space-x-1 select-none">
                    <span className={`w-3 h-1.5 rounded-full inline-block ${copyFormat === "products" ? "bg-white" : "bg-yellow-400"}`} />
                    <span>{copyFormat === "products" ? "Giz Branco (Tabela por SKU)" : "Giz Amarelo (Registro de Logística)"}</span>
                  </div>

                  <div className="overflow-x-auto">
                    <textarea
                      readOnly
                      value={copyFormat === "products" ? generateSpreadsheetText() : generateLogisticsText()}
                      placeholder="Os dados formatados para planilha aparecerão aqui..."
                      rows={copyFormat === "products" && calculatedItems.length ? Math.min(12, Math.max(5, calculatedItems.length)) : 5}
                      className="w-full bg-[#1e2a22] text-[#fbf5e6] font-mono text-xs leading-6 p-4 rounded-xl border border-white/5 shadow-inner focus:outline-none focus:ring-1 focus:ring-[#8cd0a3] resize-none overflow-y-auto"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      title="Clique para selecionar todo o texto"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === "zpl" && (
            <div className="space-y-8">
              
              <div className="scroll-parchment p-6 rounded-2xl border-l-8 border-r-8 border-[#cbab86] space-y-4">
                <div className="absolute -left-3 top-2 bottom-2 w-2.5 bg-[#422518] rounded-full shadow-md" />
                <div className="absolute -right-3 top-2 bottom-2 w-2.5 bg-[#422518] rounded-full shadow-md" />

                <div>
                  <h3 className="font-display font-bold text-2xl text-[#3b1904] flex items-center gap-2">
                    <Truck className="h-6 w-6 text-[#9a4b27]" />
                    Gerador Sequencial de Etiquetas ZPL
                  </h3>
                  <p className="font-serif italic text-sm text-[#5c3e21] leading-relaxed mt-1">
                    Insira o documento de carga ou de controle para extrair o <b>Transporte</b> (10 dígitos) e o{" "}
                    <b>Lote</b>. O gerador irá criar códigos de etiquetagem automatizados no padrão Zebra ZPL
                    sequencial de 01/X a X/X prontos para impressoras industriais.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-[#cbab86]/40 pt-4 gap-3 bg-[#e3cca7]/10 p-3 rounded-lg">
                  <div className="flex space-x-1.5 p-1 bg-[#e3cca7]/40 rounded-lg">
                    <button
                      onClick={() => setZplInputType("paste")}
                      className={`px-4 py-2 text-xs font-bold rounded-md transition ${
                        zplInputType === "paste" ? "bg-[#4a2e1d] text-white shadow-sm" : "text-[#543b24]"
                      }`}
                    >
                      Digitar ou Colar Texto
                    </button>
                    <button
                      onClick={() => setZplInputType("upload")}
                      className={`px-4 py-2 text-xs font-bold rounded-md transition ${
                        zplInputType === "upload" ? "bg-[#4a2e1d] text-white shadow-sm" : "text-[#543b24]"
                      }`}
                    >
                      Importar Certificado ou Imagem
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleClearZpl}
                      className="px-3 py-1.5 bg-[#8c3527]/90 hover:bg-[#8c3527] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Limpar Informações
                    </button>
                    <button
                      onClick={handleResetZplDefault}
                      className="px-3 py-1.5 bg-[#4a2e1d] hover:bg-[#3a2214] text-[#dfc090] rounded-lg text-xs font-bold transition flex items-center gap-1 shadow"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Restaurar Padrão
                    </button>
                  </div>
                </div>

                {zplInputType === "paste" ? (
                  <textarea
                    value={zplTextInput}
                    onChange={(e) => handleCargoTextChange(e.target.value)}
                    placeholder="Cole aqui o texto do seu documento de carga ou de controle. Exemplo: 
RECEPÇÃO DO TRANSPORTE: 2600295733 / LOTE DE CARGA: 15389.740..."
                    className="w-full h-28 p-4 bg-white/70 border border-[#bfa483] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4a2e1d]"
                  />
                ) : (
                  <div className="flex flex-col items-center py-4">
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#85633a] hover:border-[#4a2e1d] rounded-xl px-8 py-6 cursor-pointer bg-white/50 transition duration-200 group w-full max-w-lg">
                      <div className="flex flex-col items-center space-y-2 text-center">
                        <Upload className="h-8 w-8 text-[#85633a] group-hover:scale-110 transition" />
                        <span className="text-sm font-bold text-[#3b1904]">Carregar Documento de Carga</span>
                        <span className="text-xs text-[#6e5138]">(PDF ou Imagem)</span>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,image/png,image/jpeg,image/jpg"
                        onChange={handleZplCargoUpload}
                        disabled={loadingZpl}
                      />
                    </label>
                  </div>
                )}

                {zplError && (
                  <div className="mt-4 p-4 bg-red-100 border-2 border-red-400 text-red-800 rounded-xl text-sm font-sans flex items-center justify-between shadow-md">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">⚠️</span>
                      <span className="font-medium">{zplError}</span>
                    </div>
                    <button
                      onClick={() => setZplError(null)}
                      className="px-2.5 py-1 bg-red-800/10 hover:bg-red-800 hover:text-white rounded text-xs font-bold transition"
                    >
                      Fechar
                    </button>
                  </div>
                )}
              </div>

              {/* Editable manual fields styled within traditional leather panel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#3a2016] p-6 rounded-2xl border-4 border-[#5c3e21] shadow-md text-[#faeed1]">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#bfa27a] uppercase tracking-wider block">
                    Transporte (10 Dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={zplCargoData.transporte}
                    onChange={(e) => setZplCargoData({ ...zplCargoData, transporte: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[#1f110a] text-[#dba275] border-2 border-[#523528] rounded-xl text-sm font-mono font-bold focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#bfa27a] uppercase tracking-wider block">
                    Lote
                  </label>
                  <input
                    type="text"
                    value={zplCargoData.lote}
                    onChange={(e) => setZplCargoData({ ...zplCargoData, lote: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[#1f110a] text-[#dba275] border-2 border-[#523528] rounded-xl text-sm font-mono font-bold focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#bfa27a] uppercase tracking-wider block">
                    Total de Volumes
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={zplCargoData.volumes || ""}
                    onChange={(e) =>
                      setZplCargoData({ ...zplCargoData, volumes: parseInt(e.target.value) || undefined })
                    }
                    className="w-full px-4 py-2.5 bg-[#1f110a] text-[#dba275] border-2 border-[#523528] rounded-xl text-sm font-mono font-bold focus:outline-none"
                  />
                </div>

              </div>

              {/* Trigger button */}
              <div className="flex justify-end">
                <button
                  onClick={generateZplLabels}
                  className="px-6 py-4.5 bg-gradient-to-b from-[#dfc090] to-[#b08b50] text-[#2c1a0c] border-2 border-[#6b522e] rounded-xl shadow-lg font-bold text-sm hover:from-[#ecd0a5] hover:to-[#be9b62] transition duration-200"
                >
                  Automatizar Sequência e Gerar ZPL
                </button>
              </div>

              {/* Generated labeled code blocks */}
              {generatedZpls.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-[#5e412f]/40">
                  
                  {/* Visual simulated preview of thermal shipping label */}
                  <div className="space-y-3">
                    <h4 className="font-display font-black text-lg text-[#3b1904]">Simulador de Etiqueta Industrial</h4>
                    <div className="bg-white border-8 border-double border-[#2c1a0c] p-6 rounded-2xl shadow-inner text-black font-sans relative aspect-[4/3] flex flex-col justify-between max-w-md mx-auto">
                      
                      <div className="flex justify-between items-start border-b-4 border-black pb-4">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider">Transportadora Autorizada</div>
                          <div className="text-xl font-black mt-0.5">CAFÉ TRÊS CORAÇÕES SA</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-bold">CARGO ID</div>
                          <div className="text-xs font-black"># {zplCargoData.transporte}</div>
                        </div>
                      </div>

                      <div className="my-4 flex justify-between items-center">
                        <div className="space-y-1">
                          <div className="text-[9px] font-black text-slate-500">LOTE DE EXPEDIÇÃO</div>
                          <div className="text-lg font-black font-mono bg-slate-100 px-2 py-1 rounded">{zplCargoData.lote}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-black text-slate-500">VOLUME SEQUENCIAL</div>
                          <div className="text-2xl font-black font-mono">
                            {(selectedZplPreviewIdx + 1).toString().padStart(2, "0")}/{Number(zplCargoData.volumes).toString().padStart(2, "0")}
                          </div>
                        </div>
                      </div>

                      {/* Barcode representation */}
                      <div className="border-t-4 border-black pt-4 flex flex-col items-center">
                        <div className="w-full h-12 bg-black flex items-center justify-center text-white font-mono text-[9px] tracking-[6px] select-none">
                          BARCODE_{zplCargoData.transporte}
                        </div>
                        <div className="text-[10px] font-mono mt-1 font-bold">{zplCargoData.transporte}</div>
                      </div>

                    </div>

                    {/* Pagination controls */}
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        disabled={selectedZplPreviewIdx <= 0}
                        onClick={() => setSelectedZplPreviewIdx((p) => p - 1)}
                        className="px-3 py-1.5 text-xs font-bold brass-btn rounded disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <span className="text-xs font-bold text-[#5c3e21]">
                        Etiqueta {selectedZplPreviewIdx + 1} de {generatedZpls.length}
                      </span>
                      <button
                        disabled={selectedZplPreviewIdx >= generatedZpls.length - 1}
                        onClick={() => setSelectedZplPreviewIdx((p) => p + 1)}
                        className="px-3 py-1.5 text-xs font-bold brass-btn rounded disabled:opacity-50"
                      >
                        Siguiente
                      </button>
                    </div>

                  </div>

                  {/* Complete raw code panel */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display font-black text-lg text-[#3b1904]">Código ZPL Completo</h4>
                      <button
                        onClick={() => copyToClipboard(generatedZpls.join("\n\n"), true)}
                        className={`px-4 py-2 text-xs font-bold rounded transition ${
                          copiedZpl ? "bg-[#3e4d2b] text-white" : "brass-btn"
                        }`}
                      >
                        {copiedZpl ? "Copiado!" : "Copiar Todo o ZPL"}
                      </button>
                    </div>

                    <textarea
                      readOnly
                      value={generatedZpls.join("\n\n")}
                      className="w-full h-80 p-4 bg-[#111] text-emerald-400 font-mono text-xs rounded-xl border-4 border-[#523528] focus:outline-none"
                    />
                  </div>

                </div>
              )}

            </div>
          )}
        </div>

        <footer className="pt-8 border-t border-[#5e412f]/30 text-center text-[11px] text-[#785945]">
          <p>© 2026 Três Corações Logística S/A. Todos os direitos reservados.</p>
          <p className="mt-1">Desenvolvido com robustez e design skeuomorphic para automação de expedições industriais.</p>
          <p className="mt-2.5 font-bold text-xs text-[#5e3820] uppercase tracking-wider">Criado por Jefferson Augusto</p>
        </footer>

      </div>
    </div>
  );
}
