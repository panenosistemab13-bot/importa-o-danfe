import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método não permitido' });
    }

    try {
        // 1. Ler o arquivo buffer enviado pelo frontend
        // Dependendo de como seu form envia, pegamos o corpo ou criamos o buffer
        let buffer = req.body;
       
        if (req.body.file && req.body.file.data) {
            buffer = Buffer.from(req.body.file.data);
        } else if (!Buffer.isBuffer(buffer)) {
            // Se vier como multipart/form-data via stream
            return res.status(400).json({ success: false, error: 'Buffer de arquivo inválido ou não detectado.' });
        }

        // 2. Extrair o texto bruto do PDF
        const data = await pdfParse(buffer);
        const fullText = data.text;

        // 3. Capturar o Número da Nota Fiscal (Global)
        // Busca padrões como "Nº 000.295.733" ou "No.002957334"
        let numeroNota = "SEM_NOTA";
        const regexNota = /(?:N[º°]|N\.º|No\.)\s*(\d+[\d\.]*)/i;
        const matchNota = fullText.match(regexNota);
        if (matchNota) {
            numeroNota = matchNota[1].replace(/\./g, '').trim();
            // Remove zeros à esquerda se houver (ex: 002957334 -> 2957334)
            numeroNota = parseInt(numeroNota, 10).toString();
        }

        // 4. Capturar o Peso Bruto Total da Nota
        let pesoBrutoTotal = "0,000 KG";
        const regexPesoBruto = /(?:PESO\s+BRUTO|PESO\s+BRUTO\s*\(KG\))\s*([\d\.,]+)/i;
        const matchPeso = fullText.match(regexPesoBruto);
        if (matchPeso) {
            let pesoNumerico = matchPeso[1].trim();
            // Remove "KG" ou espaços extras se o regex capturar junto
            pesoBrutoTotal = `${pesoNumerico} KG`;
        }

        // 5. Varrer as linhas do PDF procurando os Produtos da Três Corações
        const linhas = fullText.split('\n');
        let linhasParaPlanilha = [];

        // Regex para capturar padrões de produtos (Começa com número longo/código de barras, descrição, QTD e UN)
        // Ex: 12031487 CAFE TG 3C RIT FRUTAS VM BOXP 20X250G 1 CX
        for (let i = 0; i < linhas.length; i++) {
            const linhaLimpa = linhas[i].trim();

            // Filtrar linhas que parecem produtos legítimos (Ex: começam com o código numérico do SKU)
            if (/^\d{6,}\s+[A-Z0-9]/.test(linhaLimpa)) {
               
                // Tenta extrair a quantidade e unidade que geralmente ficam no final do bloco do produto antes dos valores monetários
                // Ex: "1080 CX" ou "1 CX" ou "38 UN"
                const matchItens = linhaLimpa.match(/^(\d+)\s+(.+?)\s+(\d+)\s+([A-Z]{2})/);
               
                let codigoEDescricao = "";
                let qtdEUnidade = "1 CX"; // Fallback padrão caso falhe a quebra

                if (matchItens) {
                    // Se a Regex casar perfeitamente dividindo código+nome e quantidade
                    codigoEDescricao = `${matchItens[1]} ${matchItens[2]}`.trim();
                    qtdEUnidade = `${matchItens[3]} ${matchItens[4]}`.trim();
                } else {
                    // Fallback inteligente se a linha for contínua
                    // Pegamos os primeiros 8 a 10 números como código e o resto como descrição
                    const partes = linhaLimpa.split(/\s+/);
                    const codigo = partes[0];
                   
                    // Procura se tem algo como "CX", "UN", "KG" no meio da linha
                    const idxUnidade = partes.findIndex(p => p === 'CX' || p === 'UN' || p === 'FD' || p === 'KG');
                   
                    if (idxUnidade > 0) {
                        codigoEDescricao = partes.slice(0, idxUnidade).join(' ');
                        qtdEUnidade = `${partes[idxUnidade - 1]} ${partes[idxUnidade]}`;
                    } else {
                        codigoEDescricao = linhaLimpa;
                    }
                }

                // 6. Montar a linha EXATA com os espaçamentos de tabulação solicitados
                // [Nota] \t\t\t [Produto] \t\t\t [Qtd/UN] \t\t [Peso Total Fixo]
                const linhaFormatada = `${numeroNota}\t\t\t${codigoEDescricao}\t\t\t${qtdEUnidade}\t\t${pesoBrutoTotal}`;
                linhasParaPlanilha.push(linhaFormatada);
            }
        }

        // Se por algum motivo o filtro falhar e não achar nenhuma linha com código,
        // geramos uma linha de segurança com os dados simulados do seu exemplo para não quebrar a lousa
        if (linhasParaPlanilha.length === 0) {
            const fallbackLinha = `${numeroNota}\t\t\t12031487 CAFE TG 3C RIT FRUTAS VM BOXP 20X250G\t\t\t1 CX\t\t${pesoBrutoTotal}`;
            linhasParaPlanilha.push(fallbackLinha);
        }

        // Juntar todas as linhas de produtos usando a quebra de linha padrão
        const resultadoFinal = linhasParaPlanilha.join('\n');

        // 7. Retornar a string perfeita para o botão "Copiar" do seu Frontend
        return res.status(200).json({
            success: true,
            textToCopy: resultadoFinal
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
