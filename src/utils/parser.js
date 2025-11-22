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

            // --- GESTIONE IMPORTI AVANZATA ---
            let taxable = 0;
            let vat = 0; 
            let total = 0;
            let discountSum = 0; // Somma degli imponibili negativi (sconti)

            // 1. Cassa e Ritenuta
            const pensionNode = xmlDoc.querySelector("DatiCassaPrevidenziale");
            let pension = pensionNode ? parseFloat(pensionNode.querySelector("ImportoContributoCassa")?.textContent || "0") : 0;
            const tax = getText("DatiRitenuta ImportoRitenuta") || "0.00";

            // 2. Analisi Riepiloghi (Scansione di tutti i blocchi IVA)
            const allSummaries = xmlDoc.querySelectorAll("DatiRiepilogo");
            allSummaries.forEach(sum => {
                const valImp = parseFloat(sum.querySelector("ImponibileImporto")?.textContent || "0");
                const valTax = parseFloat(sum.querySelector("Imposta")?.textContent || "0");
                
                if (valImp >= 0) {
                    taxable += valImp; // Somma solo i positivi all'imponibile
                } else {
                    discountSum += valImp; // Gli imponibili negativi vanno nello sconto
                }
                vat += valTax; // L'IVA si somma tutta (positiva e negativa)
            });

            // 3. Gestione Priorità Imponibile (Professionisti vs Merci con Sconto)
            let finalTaxable = taxable.toFixed(2);
            let finalPension = pension;

            if (pensionNode && pensionNode.querySelector("ImponibileCassa")) {
                // Caso Professionista: L'imponibile vero è quello della cassa
                finalTaxable = pensionNode.querySelector("ImponibileCassa").textContent;
            } else {
                // Caso Merci: Se non c'è cassa previdenziale, usiamo lo spazio "Cassa" per lo sconto
                if (finalPension === 0 && discountSum < 0) {
                    finalPension = discountSum; // Qui finisce il tuo -157.85 ecc.
                }
            }

            // 4. Totale Documento
            const totalStr = getText("ImportoTotaleDocumento");
            if (!totalStr || parseFloat(totalStr) === 0) {
                // Ricalcolo se manca: Imponibile + IVA + Cassa/Sconto
            total = (parseFloat(finalTaxable) + vat + finalPension).toFixed(2);
            } else {
            total = totalStr;
            }

            // Formattazione finale per output
            const vatStr = vat.toFixed(2);
            const pensionStr = finalPension.toFixed(2);

            // Descrizione
            let baseDescription = "";
            const descNodes = xmlDoc.querySelectorAll("Descrizione");
            if (descNodes.length > 0) {
            baseDescription = Array.from(descNodes).map(n => n.textContent).join(" ");
            } else {
            baseDescription = getText("Causale");
            }

            // Pagamento
            let payCodeRaw = "";
            const payNode = xmlDoc.querySelector("ModalitaPagamento");
            if (payNode) payCodeRaw = payNode.textContent;
            const payCodeDesc = getPaymentMethodDescription(payCodeRaw);

            // --- GENERAZIONE RIGHE ---
            const paymentNodes = xmlDoc.querySelectorAll("DatiPagamento DettaglioPagamento");
            const generatedRows = [];

            const determineDueDate = (nodeDate) => {
                if (nodeDate) return nodeDate;
                if (payCodeRaw === "MP05" && documentDate !== "N/A") {
                    return calculateEndOfMonth(documentDate);
                }
                return documentDate;
            };

            if (isCreditNote || paymentNodes.length <= 1) {
                let dueDateRaw = getText("DataScadenzaPagamento");
                if (!dueDateRaw && paymentNodes.length > 0) {
                    dueDateRaw = paymentNodes[0].querySelector("DataScadenzaPagamento")?.textContent;
                }
                const finalDueDate = determineDueDate(dueDateRaw);

                generatedRows.push({
                    id: Math.random().toString(36).substr(2, 9),
                    fileName: file.name,
                    supplierName, customerName, invoiceNumber, documentDate, 
                    dueDate: finalDueDate || "N/A",
                    taxableAmount: finalTaxable, vatAmount: vatStr, totalAmount: total,
                    pensionFund: pensionStr, withholdingTax: tax,
                    description: baseDescription, 
                    paymentMethod: payCodeDesc,
                    docType: docTypeDesc,
                    isCreditNote: isCreditNote
                });
            } 
            else {
                paymentNodes.forEach((node, index) => {
                    const nodeDueDate = node.querySelector("DataScadenzaPagamento")?.textContent;
                    const currentDueDate = determineDueDate(nodeDueDate);
                    const prefix = `${index + 1}'/${paymentNodes.length} + `;
                    
                    generatedRows.push({
                        id: Math.random().toString(36).substr(2, 9) + index,
                        fileName: file.name,
                        supplierName, customerName, invoiceNumber, documentDate,
                        dueDate: currentDueDate,
                        taxableAmount: finalTaxable, vatAmount: vatStr, totalAmount: total,
                        pensionFund: pensionStr, withholdingTax: tax,
                        description: prefix + baseDescription,
                        paymentMethod: payCodeDesc,
                        docType: docTypeDesc,
                        isCreditNote: isCreditNote
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