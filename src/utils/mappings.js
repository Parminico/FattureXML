// Mappa dei codici pagamento
export const getPaymentMethodDescription = (code) => {
    const map = { 
        "MP01": "Contanti", 
        "MP02": "Assegno", 
        "MP03": "Assegno circ.", 
        "MP04": "Contanti Tesoreria", 
        "MP05": "Bonifico", 
        "MP08": "Carta credito", 
        "MP12": "RIBA", 
        "MP19": "SEPA DD", 
        "MP21": "SEPA B2B", 
        "MP23": "PagoPA" 
    };
    return map[code] || code || "N/A";
};

// Mappa dei tipi documento
export const getDocTypeDescription = (code) => {
    const map = { 
        "TD01": "Fattura", 
        "TD02": "Acconto/Anticipo", 
        "TD03": "Acconto/Anticipo", 
        "TD04": "Nota di Credito", 
        "TD05": "Nota di Debito", 
        "TD06": "Parcella" 
    };
    return map[code] || code || "Altro";
};

// Logica per abbreviare i nomi dei clienti
export const normalizeCustomerName = (originalName) => {
    if (!originalName) return "N/A";
    
    const upperName = originalName.toUpperCase();

    if (upperName.includes("VALORIZZAZIONE")) return "VA";
    if (upperName.includes("DOIOLA")) return "DO";
    if (upperName.includes("COSTE")) return "Coste";
    if (upperName.includes("SAN VITTORE")) return "SV";
    if (upperName.includes("METANIA") || upperName.includes("CERADA")) return "METANIA";

    return originalName.trim();
};

// --- NUOVE FUNZIONI PER RINOMINA PDF ---

// Pulisce il numero fattura: toglie tutto ciò che non è lettera o numero
export const sanitizeInvoiceNumber = (num) => {
    if (!num) return "00";
    return num.replace(/[<>:"/\\|?*]/g, '');
};

// Pulisce nomi file (rimuove caratteri vietati da Windows/Mac come / \ : * ? " < > |)
export const sanitizeFilenameString = (str) => {
    if (!str) return "";
    // Mantiene spazi, lettere, numeri, trattini e underscore. Rimuove il resto.
    return str.replace(/[\\/:*?"<>|]/g, '').trim();
};

// Formatta data da YYYY-MM-DD a YYMMDD
export const getCompactDate = (isoDate) => {
    if (!isoDate || isoDate === "N/A") return "000000";
    // isoDate è YYYY-MM-DD
    const parts = isoDate.split('-');
    if (parts.length !== 3) return "000000";
    // Prendi ultime 2 cifre anno + mese + giorno
    return parts[0].slice(2) + parts[1] + parts[2];
};