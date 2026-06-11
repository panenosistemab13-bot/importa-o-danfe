import { createRequire } from "module";
import formidable from "formidable";
import fs from "fs";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

// Desativa o body parser nativo do Vercel para suporte ao upload de arquivos multipart
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Apenas requisições POST são suportadas" });
  }

  try {
    const data = await new Promise((resolve, reject) => {
      const form = formidable({ multiples: false });
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const { fields, files } = data;
    const textInput = fields.textInput ? (Array.isArray(fields.textInput) ? fields.textInput[0] : fields.textInput) : "";
    let fullText = textInput || "";

    let fileObj = files.file;
    if (Array.isArray(fileObj)) {
      fileObj = fileObj[0];
    }

    if (fileObj) {
      const filepath = fileObj.filepath || fileObj.path;
      const buffer = fs.readFileSync(filepath);
      try {
        const pdfData = await pdf(buffer);
        fullText += "\n" + (pdfData.text || "");
      } catch (pdfErr) {
        console.error("Erro ao analisar arquivo carregado para ZPL:", pdfErr);
      }
    }

    // Extrair 'Transporte' (número de 10 dígitos)
    let transporte = "";
    const transMatch = fullText.match(/\b(26\d{8}|\d{10})\b/);
    if (transMatch) {
      transporte = transMatch[1];
    } else {
      const looseMatch = fullText.match(/\b\d{10}\b/);
      if (looseMatch) {
        transporte = looseMatch[0];
      }
    }

    // Extrair 'Lote' (ex: formato de pesos/lotes como 15389.740 ou valores grandes)
    let lote = "";
    const loteMatch = fullText.match(/(?:LOTE|REMESSA|CARGA)[:.-]?\s*([A-Z0-9./-]+)/i);
    if (loteMatch && loteMatch[1]) {
      lote = loteMatch[1].trim();
    } else {
      const weightMatch = fullText.match(/\b\d{4,5}[.,]\d{3}\b/);
      if (weightMatch) {
        lote = weightMatch[0];
      }
    }

    // Extrair 'Volumes'
    let volumes = 0;
    const volMatch = fullText.match(/(?:VOLUMES|VOLS|VOL|VOLUME|QTD|QUANTIDADE|PEÇAS|PECAS)[:.-]?\s*(\d+)/i);
    if (volMatch && volMatch[1]) {
      volumes = parseInt(volMatch[1], 10);
    }

    return res.status(200).json({
      transporte,
      lote,
      volumes
    });

  } catch (error) {
    console.error("Erro ao extrair dados de carga ZPL na Vercel:", error);
    return res.status(500).json({
      error: "Erro desconhecido ao processar dados de carga no servidor Vercel.",
      details: error.message
    });
  }
}
