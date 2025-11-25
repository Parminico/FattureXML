import { getPaymentMethodDescription, getDocTypeDescription, normalizeCustomerName } from "./mappings";

// Funzione per calcolare fine mese
const calculateEndOfMonth = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "N/A";
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const year = endOfMonth.getFullYear();
  const month = String(endOfMonth.getMonth() + 1).padStart(2, '0');
  const day = String(endOfMonth.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseXmlFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(e.target.result, "text/xml");
        
        if (xmlDoc.querySelector("parsererror")) {
          reject(new Error("File XML non valido"));
          return;
        }

        const getText = (selector) => xmlDoc.querySelector(selector)?.textContent || "";
        
        // --- DATI BASE ---
        const supplierName = getText("CedentePrestatore DatiAnagrafici Anagrafica Denominazione") || 
                            (getText("CedentePrestatore DatiAnagrafici Anagrafica Nome") + " " + getText("CedentePrestatore DatiAnagrafici Anagrafica Cognome"));

        const rawCustomerName = getText("CessionarioCommittente DatiAnagrafici Anagrafica Denominazione") || 
                            (getText("CessionarioCommittente DatiAnagrafici Anagrafica Nome") + " " + getText("CessionarioCommittente DatiAnagrafici Anagrafica Cognome"));
        const customerName = normalizeCustomerName(rawCustomerName);
        
        let invoiceNumber = getText("DatiGeneraliDocumento Numero") || "N/A";
        const documentDate = getText("DatiGeneraliDocumento Data") || "N/A";
        
        const docTypeCode = getText("DatiGeneraliDocumento TipoDocumento");
        const docTypeDesc = getDocTypeDescription(docTypeCode);
        const isCreditNote = docTypeCode === "TD04";

        if (isCreditNote) {
            invoiceNumber = "N. credito " + invoiceNumber;
        }

        // --- CALCOLO IMPORTI TOTALI FATTURA ---
        let totalTaxablePositive = 0; 
        let totalDiscount = 0;       
        let totalVat = 0;            
        let totalDoc = 0;    
        
        // Recuperiamo l'aliquota IVA principale (servirà per lo scorporo delle rate)
        let mainVatRate = 0; 

        // 1. Analisi Riepilogo IVA
        const allSummaries = xmlDoc.querySelectorAll("DatiRiepilogo");
        allSummaries.forEach(sum => {
            const valImp = parseFloat(sum.querySelector("ImponibileImporto")?.textContent || "0");
            const valTax = parseFloat(sum.querySelector("Imposta")?.textContent || "0");
            const rate = parseFloat(sum.querySelector("AliquotaIVA")?.textContent || "0");
            
            if (valImp >= 0) {
                totalTaxablePositive += valImp;
                if (rate > 0) mainVatRate = rate; // Memorizziamo l'aliquota (se ce n'è una prevalente > 0)
            } else {
                totalDiscount += valImp;
            }
            totalVat += valTax;
        });

        // 2. Cassa Previdenziale
        const pensionNode = xmlDoc.querySelector("DatiCassaPrevidenziale");
        let pensionAmount = pensionNode ? parseFloat(pensionNode.querySelector("ImportoContributoCassa")?.textContent || "0") : 0;
        const withholdingTax = getText("DatiRitenuta ImportoRitenuta") || "0.00";

        // 3. Determina Imponibile Finale e Cassa Finale (Totali della fattura)
        // 3. Determina Imponibile Finale e Cassa Finale (Totali della fattura)
        let finalTaxable = totalTaxablePositive;
        let finalCassa = pensionAmount;

        // --- GESTIONE SCONTI E ARROTONDAMENTI (Positivi e Negativi) ---

        // Se abbiamo dei valori negativi nel riepilogo (totalDiscount)...
        if (totalDiscount < 0) {
            // CASO 1: ARROTONDAMENTO NEGATIVO (es. Amazon -0.01€)
            // Se il valore è molto piccolo (<= 1€), lo consideriamo un arrotondamento tecnico.
            // Lo uniamo all'imponibile per far quadrare il totale fattura.
            if (Math.abs(totalDiscount) <= 1.00) {
                finalTaxable = finalTaxable + totalDiscount;
            } 
            // CASO 2: SCONTO REALE / CASSA NEGATIVA (es. Duynie -499€)
            // Se il valore è grande, è una voce separata (Sconto merce o Cassa negativa).
            // Lo lasciamo separato nella colonna "Cassa" (solo se non c'è già una cassa previdenziale).
            else if (finalCassa === 0) {
                finalCassa = totalDiscount;
            }
        }

        // --- PULIZIA CASSA PREVIDENZIALE ---
        
        if (finalCassa > 0) {
            finalTaxable = finalTaxable - finalCassa;
        }

        // 4. Totale Documento (Reale)
        const totalDocStr = getText("ImportoTotaleDocumento");
        if (totalDocStr) {
            totalDoc = parseFloat(totalDocStr);
        } else {
            totalDoc = parseFloat((finalTaxable + totalVat + finalCassa).toFixed(2));
        }

        // --- DESCRIZIONE E PAGAMENTO ---
        let baseDescription = "";
        const descNodes = xmlDoc.querySelectorAll("Descrizione");
        if (descNodes.length > 0) {
          baseDescription = Array.from(descNodes).map(n => n.textContent).join(" ");
        } else {
          baseDescription = getText("Causale");
        }

        let payCodeRaw = "";
        const payNode = xmlDoc.querySelector("ModalitaPagamento");
        if (payNode) payCodeRaw = payNode.textContent;
        const payCodeDesc = getPaymentMethodDescription(payCodeRaw);

        // --- GENERAZIONE RIGHE (RATE) ---
        const paymentNodes = xmlDoc.querySelectorAll("DatiPagamento DettaglioPagamento");
        const generatedRows = [];

        const determineDueDate = (nodeDate) => {
            if (nodeDate) return nodeDate;
            if (payCodeRaw === "MP05" && documentDate !== "N/A") return calculateEndOfMonth(documentDate);
            return documentDate;
        };

        const fileId = Math.random().toString(36).substr(2, 9);

        // CASO 1: Riga Singola (o Nota Credito)
        if (isCreditNote || paymentNodes.length <= 1) {
            let dueDateRaw = getText("DataScadenzaPagamento");
            if (!dueDateRaw && paymentNodes.length > 0) {
                dueDateRaw = paymentNodes[0].querySelector("DataScadenzaPagamento")?.textContent;
            }
            
            generatedRows.push({
                id: fileId + "-0",
                fileId: fileId, 
                isParent: true,
                fileName: file.name,
                supplierName, customerName, invoiceNumber, documentDate, 
                dueDate: determineDueDate(dueDateRaw) || "N/A",
                taxableAmount: finalTaxable.toFixed(2),
                vatAmount: totalVat.toFixed(2),
                totalAmount: totalDoc.toFixed(2),
                pensionFund: finalCassa.toFixed(2),
                withholdingTax: withholdingTax,
                description: baseDescription, 
                paymentMethod: payCodeDesc,
                docType: docTypeDesc,
                isCreditNote: isCreditNote,
                isInstallment: false
            });
        } 
        else {
            // CASO 2: RATE MULTIPLE (Scorporo Preciso)
            
            paymentNodes.forEach((node, index) => {
                const currentDueDate = determineDueDate(node.querySelector("DataScadenzaPagamento")?.textContent);
                
                // Descrizione CORRETTA: "1'/4 trinciato..." (senza il +)
                const prefix = `${index + 1}'/${paymentNodes.length} `;
                const installmentDesc = prefix + baseDescription;

                // Importo LORDO della rata (quello che paghi)
                const paymentAmount = parseFloat(node.querySelector("ImportoPagamento")?.textContent || "0");
                
                // Calcolo IMPONIBILE e IVA partendo dal LORDO della rata
                // Formula scorporo: Imponibile = Lordo / (1 + (Aliquota/100))
                let rowTaxable = 0;
                let rowVat = 0;
                let rowCassa = 0; // La cassa di solito non si rateizza così, ma teniamo la logica proporzionale se serve
                
                if (mainVatRate > 0) {
                    // Scorporo usando l'aliquota IVA principale trovata nel documento (es. 10 o 22)
                    rowTaxable = paymentAmount / (1 + (mainVatRate / 100));
                    rowVat = paymentAmount - rowTaxable;
                } else {
                    // Se non c'è IVA (0%), tutto è imponibile (o esente)
                    // Oppure usiamo il metodo proporzionale sul totale documento come fallback
                    if (totalDoc !== 0) {
                        const ratio = paymentAmount / totalDoc;
                        rowTaxable = finalTaxable * ratio;
                        rowVat = totalVat * ratio;
                        rowCassa = finalCassa * ratio;
                    }
                }

                // Il "Totale" visualizzato per questa riga è l'importo della rata stessa
                const rowTotal = paymentAmount; 

                generatedRows.push({
                    id: fileId + "-" + index,
                    fileId: fileId,
                    isParent: index === 0,
                    fileName: file.name,
                    supplierName, customerName, invoiceNumber, documentDate,
                    dueDate: currentDueDate,
                    
                    // Valori scorporati per la singola rata
                    taxableAmount: rowTaxable.toFixed(2),
                    vatAmount: rowVat.toFixed(2),
                    totalAmount: rowTotal.toFixed(2), // Questo è il lordo rata (es. 3999.27)
                    pensionFund: rowCassa.toFixed(2),
                    
                    withholdingTax: withholdingTax, 
                    description: installmentDesc,
                    paymentMethod: payCodeDesc,
                    docType: docTypeDesc,
                    isCreditNote: isCreditNote,
                    isInstallment: true 
                });
            });
        }

        resolve(generatedRows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
};