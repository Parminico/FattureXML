const getPaymentMethodDescription = (code) => {
    const map = { "MP01": "Contanti", "MP02": "Assegno", "MP03": "Assegno circ.", "MP04": "Contanti Tesoreria",
        "MP05": "Bonifico", "MP08": "Carta credito", "MP12": "RIBA", "MP19": "SEPA DD", "MP21": "SEPA B2B", "MP23": "PagoPA", "MP18": "Bollettino Postale", "MP16": "Domiciliazione bancaria", "MP20": "SEPA Direct Debit" };
    return map[code] || code || "N/A";
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
            
            // Estrazione Dati
            const supplierName = getText("CedentePrestatore DatiAnagrafici Anagrafica Denominazione") || 
                                (getText("CedentePrestatore DatiAnagrafici Anagrafica Nome") + " " + getText("CedentePrestatore DatiAnagrafici Anagrafica Cognome"));

            const customerName = getText("CessionarioCommittente DatiAnagrafici Anagrafica Denominazione") || 
                                (getText("CessionarioCommittente DatiAnagrafici Anagrafica Nome") + " " + getText("CessionarioCommittente DatiAnagrafici Anagrafica Cognome"));
            
            const invoiceNumber = getText("DatiGeneraliDocumento Numero") || "N/A";
            const documentDate = getText("DatiGeneraliDocumento Data") || "N/A";
            
            let dueDate = getText("DataScadenzaPagamento");
            if (!dueDate) {
            const detail = xmlDoc.querySelector("DettaglioPagamento");
            if (detail) dueDate = detail.querySelector("DataScadenzaPagamento")?.textContent || "N/A";
            }

            let taxable = "0.00", vat = "0.00", total = "0.00";
            const summary = xmlDoc.querySelector("DatiRiepilogo");
            if (summary) {
            taxable = summary.querySelector("ImponibileImporto")?.textContent || "0.00";
            vat = summary.querySelector("Imposta")?.textContent || "0.00";
            }
            
            total = getText("ImportoTotaleDocumento");
            if (!total || total === "0.00") {
            total = (parseFloat(taxable) + parseFloat(vat)).toFixed(2);
            }

            const pension = getText("DatiCassaPrevidenziale ImportoContributoCassa") || "0.00";
            const tax = getText("DatiRitenuta ImportoRitenuta") || "0.00";

            let description = "";
            const descNodes = xmlDoc.querySelectorAll("Descrizione");
            if (descNodes.length > 0) {
            description = Array.from(descNodes).map(n => n.textContent).join(" ");
            } else {
            description = getText("Causale");
            }

            let payCode = "";
            const payNode = xmlDoc.querySelector("ModalitaPagamento");
            if (payNode) payCode = getPaymentMethodDescription(payNode.textContent);

            resolve({
            id: Math.random().toString(36).substr(2, 9),
            fileName: file.name,
            supplierName, customerName, invoiceNumber, documentDate, dueDate,
            taxableAmount: taxable, vatAmount: vat, totalAmount: total,
            pensionFund: pension, withholdingTax: tax,
            description, paymentMethod: payCode
            });

        } catch (err) {
            reject(err);
        }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
    });
};