import React, { useState, useRef } from "react";
import { Upload, X, FileText, Copy, Trash2 } from "lucide-react";
import "./App.css";

export default function FattureXmlParser() {
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  // Reset totale
  const resetAll = () => {
    setInvoices([]);
    setError(null);
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Rimuovi una fattura
  const removeInvoice = (id) => {
    setInvoices(prev => prev.filter(invoice => invoice.id !== id));
  };

  // Gestione file
  const handleFiles = (selectedFiles) => {
    const validFiles = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (file.name.toLowerCase().endsWith(".xml") || file.name.toLowerCase().endsWith(".xml.p7m")) {
        validFiles.push(file);
      }
    }
    
    if (validFiles.length === 0) {
      setError("Nessun file XML valido selezionato.");
      return;
    }
    
    setError(null);
    validFiles.forEach(file => parseXmlFile(file));
  };

  // Lettura XML
  const parseXmlFile = (file) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        
        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) throw new Error("File XML non valido");
        
        // --- ESTRAZIONE DATI ---

        // 1. Fornitore
        const supplierName = 
          xmlDoc.querySelector("CedentePrestatore DatiAnagrafici Anagrafica Denominazione")?.textContent || 
          (xmlDoc.querySelector("CedentePrestatore DatiAnagrafici Anagrafica Nome")?.textContent + " " + 
          xmlDoc.querySelector("CedentePrestatore DatiAnagrafici Anagrafica Cognome")?.textContent) || "N/A";

        // 2. Cliente
        const customerName = 
          xmlDoc.querySelector("CessionarioCommittente DatiAnagrafici Anagrafica Denominazione")?.textContent || 
          (xmlDoc.querySelector("CessionarioCommittente DatiAnagrafici Anagrafica Nome")?.textContent + " " + 
          xmlDoc.querySelector("CessionarioCommittente DatiAnagrafici Anagrafica Cognome")?.textContent) || "N/A";
        
        // 3. Dati Documento
        const invoiceNumber = xmlDoc.querySelector("DatiGeneraliDocumento Numero")?.textContent || "N/A";
        const documentDate = xmlDoc.querySelector("DatiGeneraliDocumento Data")?.textContent || "N/A";
        
        // 4. Scadenza
        let dueDate = "N/A";
        const dueDateNode = xmlDoc.querySelector("DataScadenzaPagamento");
        if (dueDateNode) {
          dueDate = dueDateNode.textContent || "N/A";
        } else {
          const dettaglioNodes = xmlDoc.querySelectorAll("DettaglioPagamento");
          if (dettaglioNodes.length > 0) {
            const firstDate = dettaglioNodes[0].querySelector("DataScadenzaPagamento");
            dueDate = firstDate?.textContent || "N/A";
          }
        }
        
        // 5. Importi
        let taxableAmount = "N/A";
        let vatAmount = "N/A";
        let totalAmount = "N/A";
        
        const riepilogo = xmlDoc.querySelector("DatiRiepilogo");
        if (riepilogo) {
            taxableAmount = xmlDoc.querySelector("DatiRiepilogo ImponibileImporto")?.textContent || "0.00";
            vatAmount = xmlDoc.querySelector("DatiRiepilogo Imposta")?.textContent || "0.00";
        }
        
        totalAmount = xmlDoc.querySelector("ImportoTotaleDocumento")?.textContent || "N/A";
        
        if (totalAmount === "N/A" && taxableAmount !== "N/A" && vatAmount !== "N/A") {
            const tot = parseFloat(taxableAmount) + parseFloat(vatAmount);
            totalAmount = tot.toFixed(2);
        }
        
        // 6. Extra
        const pensionFund = xmlDoc.querySelector("DatiCassaPrevidenziale ImportoContributoCassa")?.textContent || "N/A";
        const withholdingTax = xmlDoc.querySelector("DatiRitenuta ImportoRitenuta")?.textContent || "N/A";
        
        // 7. Descrizione
        let description = "N/A";
        const descrizioneNodes = xmlDoc.querySelectorAll("Descrizione");
        if (descrizioneNodes.length > 0) {
          description = Array.from(descrizioneNodes).map(n => n.textContent).join(" ");
        } else {
          description = xmlDoc.querySelector("Causale")?.textContent || "N/A";
        }
        
        // 8. Metodo Pagamento
        let paymentMethod = "N/A";
        const pagamentoNode = xmlDoc.querySelector("ModalitaPagamento");
        if (pagamentoNode) {
          paymentMethod = getPaymentMethodDescription(pagamentoNode.textContent || "N/A");
        }
        
        const paymentDates = [];
        xmlDoc.querySelectorAll("DettaglioPagamento DataScadenzaPagamento").forEach(n => {
          if (n.textContent) paymentDates.push(n.textContent);
        });
        
        const newInvoice = {
          id: Math.random().toString(36).substring(2, 9),
          fileName: file.name,
          supplierName: supplierName.replace(/\s+/g, " ").trim(),
          customerName: customerName.replace(/\s+/g, " ").trim(),
          invoiceNumber,
          documentDate,
          dueDate,
          taxableAmount,
          vatAmount,
          totalAmount,
          pensionFund,
          withholdingTax,
          description: description, 
          paymentMethod,
          paymentDates
        };
        
        setInvoices(prev => [...prev, newInvoice]);
      } catch (err) {
        setError("Impossibile leggere il file XML.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const getPaymentMethodDescription = (code) => {
    const paymentMethods = {
      "MP01": "Contanti", "MP02": "Assegno", "MP03": "Assegno circ.", "MP04": "Contanti Tesoreria",
      "MP05": "Bonifico", "MP08": "Carta credito", "MP12": "RIBA", "MP19": "SEPA DD", "MP21": "SEPA B2B", "MP23": "PagoPA"
    };
    return paymentMethods[code] || code;
  };

  const handleDragOver = (e) => { 
    e.preventDefault(); 
    setIsDragging(true); 
  };

  const handleDragLeave = () => { 
    setIsDragging(false); 
  };

  const handleDrop = (e) => {
    e.preventDefault(); 
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const formatDate = (d) => {
    if (!d || d === "N/A") return "";
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString('it-IT');
  };

  const formatMoney = (a) => {
    if (!a || a === "N/A") return "";
    const num = parseFloat(a.replace(',', '.'));
    if (isNaN(num) || num === 0) return ""; 
    return num.toFixed(2).replace('.', ',');
  }
  
  const renderMoneyCell = (amount) => {
    const formatted = formatMoney(amount);
    return formatted ? `${formatted} €` : "";
  }

  const copyToClipboard = () => {
    if (invoices.length === 0) return;
    
    // NESSUNA INTESTAZIONE
    //  rimosso la variabile 'header' e la concatenazione
    
    const dataRows = invoices.map(inv => [
      inv.customerName,
      inv.supplierName,
      inv.invoiceNumber,
      formatDate(inv.documentDate),
      formatDate(inv.dueDate),
      // --- MODIFICA: .toLowerCase() aggiunto qui ---
      inv.description.replace(/(\r\n|\n|\r)/gm, " ").toLowerCase(), 
      formatMoney(inv.taxableAmount),
      formatMoney(inv.vatAmount),
      formatMoney(inv.pensionFund),
      formatMoney(inv.withholdingTax)
    ].join("\t")).join("\n");
    
    // Copiamo solo i dati
    navigator.clipboard.writeText(dataRows)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => alert("Errore copia"));
  };

  return (
    <div className="app-container">
      <header className="main-header">
        <h1>Fatture XML Parser</h1>
        <p>Estrai dati da XML per Excel</p>
      </header>

      <main>
        {/* Upload Card */}
        <div className="card">
          <div className="card-header">
            <h2><Upload size={20} /> Carica Fatture</h2>
            <span style={{fontSize: '0.8rem', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px'}}>Solo .xml</span>
          </div>
          
          <div className="card-body">
            <div 
              className={`upload-area ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="upload-content">
                <FileText className="icon-large" />
                <div>
                  <p style={{fontWeight: 'bold', marginBottom: '0.5rem'}}>Clicca o trascina i file qui</p>
                  <p style={{color: '#64748b', fontSize: '0.9rem'}}>Supporta caricamento multiplo</p>
                </div>
                <button className="btn-primary">Sfoglia File</button>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" style={{display: 'none'}} accept=".xml,.p7m" onChange={handleFileInput} multiple />
            </div>

            {error && (
              <div className="error-msg">
                 <X size={18} /> {error}
              </div>
            )}
          </div>
        </div>

        {/* Results Card */}
        {invoices.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2>Fatture Elaborate ({invoices.length})</h2>
              <div className="actions">
                <button onClick={copyToClipboard} className={`btn btn-copy ${copied ? 'copied' : ''}`}>
                  <Copy size={16} /> {copied ? "Copiato!" : "Copia Dati (No Intestazioni)"}
                </button>
                <button onClick={resetAll} className="btn btn-reset">
                  <Trash2 size={16} /> Reset
                </button>
              </div>
            </div>
            
            <div className="table-container">
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Fornitore</th>
                    <th>Numero</th>
                    <th>Data</th>
                    <th>Scadenza</th>
                    <th>Descrizione</th>
                    <th className="text-right">Imponibile</th>
                    <th className="text-right">IVA</th>
                    <th className="text-right">Cassa</th>
                    <th className="text-right">Ritenuta</th>
                    <th className="text-right">Totale</th>
                    <th className="text-right">Pagamento</th>
                    <th className="text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td title={inv.customerName}>{inv.customerName}</td>
                      <td title={inv.supplierName}>{inv.supplierName}</td>
                      <td>{inv.invoiceNumber}</td>
                      <td style={{color: '#64748b'}}>{formatDate(inv.documentDate)}</td>
                      <td style={{color: '#64748b'}}>{formatDate(inv.dueDate)}</td>
                      
                      <td title={inv.description}>
                        <div className="desc-wrapper">
                          {inv.description}
                        </div>
                      </td>

                      <td className="text-right font-mono">{renderMoneyCell(inv.taxableAmount)}</td>
                      <td className="text-right font-mono">{renderMoneyCell(inv.vatAmount)}</td>
                      <td className="text-right font-mono">{renderMoneyCell(inv.pensionFund)}</td>
                      <td className="text-right font-mono">{renderMoneyCell(inv.withholdingTax)}</td>
                      <td className="text-right font-mono font-bold">{renderMoneyCell(inv.totalAmount)}</td>
                      <td className="text-right text-sm text-slate-600">{inv.paymentMethod}</td>
                      
                      <td className="text-right">
                        <button onClick={() => removeInvoice(inv.id)} className="btn-icon" title="Rimuovi">
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="footer-note">
              Cliccando "Copia" verranno copiati solo i dati (niente titoli).
            </div>
          </div>
        )}
      </main>
    </div>
  );
}