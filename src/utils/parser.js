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
        
        // Identifichiamo se è una Nota di Credito
        const isCreditNote = docTypeCode === "TD04";

        if (isCreditNote) {
            invoiceNumber = "N. credito " + invoiceNumber;
        }

        // --- CALCOLO IMPORTI TOTALI FATTURA ---
        let totalTaxablePositive = 0; 
        let totalDiscount = 0;       
        let totalVat = 0;            
        let totalDoc = 0;    
        let mainVatRate = 0; 

        // 1. Analisi Riepilogo IVA
        const allSummaries = xmlDoc.querySelectorAll("DatiRiepilogo");
        allSummaries.forEach(sum => {
            const valImp = parseFloat(sum.querySelector("ImponibileImporto")?.textContent || "0");
            const valTax = parseFloat(sum.querySelector("Imposta")?.textContent || "0");
            const rate = parseFloat(sum.querySelector("AliquotaIVA")?.textContent || "0");
            
            // MODIFICA IMPORTANTE: Gestione Note di Credito (TD04)
            if (isCreditNote) {
                // Nelle note di credito, gli importi sono spesso negativi nel XML.
                // Noi li vogliamo POSITIVI nelle colonne Imponibile e IVA.
                // Quindi prendiamo il valore assoluto (Math.abs)
                totalTaxablePositive += Math.abs(valImp);
                totalVat += Math.abs(valTax);
                
                if (rate > 0) mainVatRate = rate;
            } 
            else {
                // Logica Standard per Fatture normali
                if (valImp >= 0) {
                    totalTaxablePositive += valImp;
                    if (rate > 0) mainVatRate = rate;
                } else {
                    // Solo nelle fatture normali i negativi sono sconti
                    totalDiscount += valImp;
                }
                totalVat += valTax;
            }
        });

        // 2. Cassa Previdenziale
        const pensionNode = xmlDoc.querySelector("DatiCassaPrevidenziale");
        let pensionAmount = pensionNode ? parseFloat(pensionNode.querySelector("ImportoContributoCassa")?.textContent || "0") : 0;
        // Se nota di credito ha cassa negativa, la giriamo in positivo
        if (isCreditNote && pensionAmount < 0) pensionAmount = Math.abs(pensionAmount);

        const withholdingTax = getText("DatiRitenuta ImportoRitenuta") || "0.00";

        // 3. Determina Imponibile Finale e Cassa Finale
        let finalTaxable = totalTaxablePositive;
        let finalCassa = pensionAmount;

        // GESTIONE SCONTI (Solo se NON siamo in una Nota di Credito, perché lì totalDiscount è 0)
        if (totalDiscount < 0) {
            // Se è un arrotondamento negativo esplicito (< 1€), lo uniamo all'imponibile
            if (Math.abs(totalDiscount) <= 1.00) {
                finalTaxable = finalTaxable + totalDiscount;
            } 
            // Se è uno sconto merce o cassa negativa (> 1€), lo teniamo separato
            else if (finalCassa === 0) {
                finalCassa = totalDiscount;
            }
        }

        // GESTIONE CASSA (Se positiva, va scorporata dall'imponibile totale)
        if (finalCassa > 0) {
            finalTaxable = finalTaxable - finalCassa;
        }

        // 4. Totale Documento (Reale da XML)
        const totalDocStr = getText("ImportoTotaleDocumento");
        if (totalDocStr) {
            totalDoc = parseFloat(totalDocStr);
             // Se nota di credito, forziamo il positivo per coerenza
            if (isCreditNote) totalDoc = Math.abs(totalDoc);
        } else {
            totalDoc = parseFloat((finalTaxable + totalVat + finalCassa).toFixed(2));
        }

        // 5. BILANCIAMENTO FINALE ARROTONDAMENTI
        const checkSum = parseFloat((finalTaxable + totalVat + finalCassa).toFixed(2));
        const discrepancy = parseFloat((totalDoc - checkSum).toFixed(2));
        
        if (Math.abs(discrepancy) <= 1.00 && Math.abs(discrepancy) > 0.0001) {
            finalTaxable = finalTaxable + discrepancy;
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

        // Se è Nota Credito o ha una sola scadenza
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
            // RATE MULTIPLE
            paymentNodes.forEach((node, index) => {
                const currentDueDate = determineDueDate(node.querySelector("DataScadenzaPagamento")?.textContent);
                const prefix = `${index + 1}'/${paymentNodes.length} `;
                const installmentDesc = prefix + baseDescription;
                
                let paymentAmount = parseFloat(node.querySelector("ImportoPagamento")?.textContent || "0");
                // Se per caso stiamo rateizzando una nota credito (raro), usiamo il valore assoluto
                if (isCreditNote) paymentAmount = Math.abs(paymentAmount);
                
                let rowTaxable = 0;
                let rowVat = 0;
                let rowCassa = 0;
                
                if (mainVatRate > 0) {
                    rowTaxable = paymentAmount / (1 + (mainVatRate / 100));
                    rowVat = paymentAmount - rowTaxable;
                } else {
                    if (totalDoc !== 0) {
                        const ratio = paymentAmount / totalDoc;
                        rowTaxable = finalTaxable * ratio;
                        rowVat = totalVat * ratio;
                        rowCassa = finalCassa * ratio;
                    }
                }

                const rowTotal = paymentAmount; 

                generatedRows.push({
                    id: fileId + "-" + index,
                    fileId: fileId,
                    isParent: index === 0,
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