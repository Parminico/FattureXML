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
        
        // Dati Comuni
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

        // --- CALCOLO IMPORTI TOTALI ---
        let totalTaxablePositive = 0; 
        let totalDiscount = 0;       
        let totalVat = 0;            
        let totalDoc = 0;            

        // 1. Analisi Riepilogo IVA
        const allSummaries = xmlDoc.querySelectorAll("DatiRiepilogo");
        allSummaries.forEach(sum => {
            const valImp = parseFloat(sum.querySelector("ImponibileImporto")?.textContent || "0");
            const valTax = parseFloat(sum.querySelector("Imposta")?.textContent || "0");
            
            if (valImp >= 0) {
                totalTaxablePositive += valImp;
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
        let finalTaxable = totalTaxablePositive;
        let finalCassa = pensionAmount;

        if (pensionNode && pensionNode.querySelector("ImponibileCassa")) {
            finalTaxable = parseFloat(pensionNode.querySelector("ImponibileCassa").textContent);
        } else {
            if (finalCassa === 0 && totalDiscount < 0) {
                finalCassa = totalDiscount;
            }
        }

        // 4. Totale Documento
        const totalDocStr = getText("ImportoTotaleDocumento");
        totalDoc = totalDocStr ? parseFloat(totalDocStr) : (finalTaxable + totalVat + finalCassa);

        // Descrizione
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

        // --- GENERAZIONE RIGHE ---
        const paymentNodes = xmlDoc.querySelectorAll("DatiPagamento DettaglioPagamento");
        const generatedRows = [];

        const determineDueDate = (nodeDate) => {
            if (nodeDate) return nodeDate;
            if (payCodeRaw === "MP05" && documentDate !== "N/A") return calculateEndOfMonth(documentDate);
            return documentDate;
        };

        // ID base per raggruppare le righe della stessa fattura
        const fileId = Math.random().toString(36).substr(2, 9);

        if (isCreditNote || paymentNodes.length <= 1) {
            // RIGA SINGOLA
            let dueDateRaw = getText("DataScadenzaPagamento");
            if (!dueDateRaw && paymentNodes.length > 0) {
                dueDateRaw = paymentNodes[0].querySelector("DataScadenzaPagamento")?.textContent;
            }
            
            generatedRows.push({
                id: fileId + "-0",
                fileId: fileId, // ID comune
                isParent: true, // Conta come 1 fattura
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
            // RATE MULTIPLE -> SCORPORO
            paymentNodes.forEach((node, index) => {
                const currentDueDate = determineDueDate(node.querySelector("DataScadenzaPagamento")?.textContent);
                
                // Descrizione senza "+"
                const prefix = `${index + 1}'/${paymentNodes.length} `;
                const installmentDesc = prefix + baseDescription;

                const paymentAmount = parseFloat(node.querySelector("ImportoPagamento")?.textContent || "0");
                
                // Calcolo proporzionale per questa rata
                let rowTaxable = 0;
                let rowVat = 0;
                let rowCassa = 0;
                let rowTotal = paymentAmount; // Il totale della rata è l'importo pagamento

                if (totalDoc !== 0) {
                    const ratio = paymentAmount / totalDoc;
                    rowTaxable = finalTaxable * ratio;
                    rowVat = totalVat * ratio;
                    rowCassa = finalCassa * ratio;
                } else if (index === 0) {
                     // Caso totale 0, metto tutto sulla prima rata per non perdere i dati
                     rowTaxable = finalTaxable;
                     rowVat = totalVat;
                     rowCassa = finalCassa;
                     rowTotal = totalDoc;
                }

                generatedRows.push({
                    id: fileId + "-" + index,
                    fileId: fileId,
                    isParent: index === 0, // Solo la prima riga conta per il contatore file
                    fileName: file.name,
                    supplierName, customerName, invoiceNumber, documentDate,
                    dueDate: currentDueDate,
                    taxableAmount: rowTaxable.toFixed(2),
                    vatAmount: rowVat.toFixed(2),
                    totalAmount: rowTotal.toFixed(2),
                    pensionFund: rowCassa.toFixed(2),
                    withholdingTax: withholdingTax, 
                    description: installmentDesc,
                    paymentMethod: payCodeDesc,
                    docType: docTypeDesc,
                    isCreditNote: isCreditNote,
                    isInstallment: true // Flag per colore azzurro
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