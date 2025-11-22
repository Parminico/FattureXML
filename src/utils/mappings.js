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
        "MP16": "Domiciliazione", 
        "MP18": "Bollettino", 
        "MP19": "SEPA", 
        "MP20": "SEPA", 
        "MP21": "SEPA", 
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
        "TD06": "Parcella",
        "TD24": "Fattura"
    };
    return map[code] || code || "Altro";
    };

    // Logica per abbreviare i nomi dei clienti
    export const normalizeCustomerName = (originalName) => {
    if (!originalName) return "N/A";
    
    const upperName = originalName.toUpperCase();

    // Regole di mappatura (aggiungi qui nuovi clienti)
    if (upperName.includes("VALORIZZAZIONE")) return "VA";
    if (upperName.includes("DOIOLA")) return "DO";
    if (upperName.includes("COSTE")) return "Coste";
    if (upperName.includes("SAN VITTORE")) return "SV";
    if (upperName.includes("METANIA") || upperName.includes("CERADA")) return "METANIA";

    // Se non trova corrispondenze, ritorna il nome originale (pulito da spazi extra)
    return originalName.trim();
};