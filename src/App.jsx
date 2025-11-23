import React, { useState, useRef } from "react";
import { Upload, FileText, Copy, Trash2 } from "lucide-react";
import "./App.css";
import { parseXmlFile } from "./utils/parser";
import { formatDate, formatMoney, renderMoneyCell } from "./utils/formatters";

export default function FattureXmlParser() {
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  // Conta i file unici (non le righe totali)
  const uniqueFilesCount = invoices.filter(inv => inv.isParent).length;

  const resetAll = () => {
    setInvoices([]);
    setError(null);
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Rimuove tutte le righe associate allo stesso file
  const removeInvoice = (fileId) => {
    setInvoices(prev => prev.filter(invoice => invoice.fileId !== fileId));
  };

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
    
    const promises = validFiles.map(file => parseXmlFile(file));
    
    Promise.all(promises)
      .then(results => {
        const flatResults = results.flat();
        setInvoices(prev => [...prev, ...flatResults]);
      })
      .catch(err => {
        console.error(err);
        setError("Errore durante la lettura dei file.");
      });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const copyToClipboard = () => {
    if (invoices.length === 0) return;
    
    const dataRows = invoices.map(inv => [
      inv.customerName,
      inv.supplierName,
      inv.invoiceNumber,
      formatDate(inv.documentDate),
      formatDate(inv.dueDate),
      inv.description.replace(/(\r\n|\n|\r)/gm, " ").toLowerCase(),
      formatMoney(inv.taxableAmount),
      formatMoney(inv.vatAmount),
      formatMoney(inv.pensionFund),
      formatMoney(inv.withholdingTax)
    ].join("\t")).join("\n");
    
    navigator.clipboard.writeText(dataRows)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => alert("Errore copia"));
  };

  // Determina la classe CSS per la riga
  const getRowClass = (inv) => {
    if (inv.isCreditNote) return "row-credit-note";
    if (inv.isInstallment) return "row-installment";
    return "";
  };

  return (
    <div className="app-container">
      <header className="main-header">
        <h1>Fatture XML Parser</h1>
        <p>Estrai dati da XML per Excel</p>
      </header>

      <div className="card">
        <div className="card-header">
          <h2><Upload size={20} /> Carica XML</h2>
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
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".xml,.p7m" 
              onChange={(e) => e.target.files && handleFiles(e.target.files)} 
              multiple 
              style={{display:'none'}} 
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
        </div>
      </div>

      {invoices.length > 0 && (
        <div className="card">
          <div className="card-header">
            {/* Contatore File (non righe) */}
            <h2>Riepilogo ({uniqueFilesCount} fatture caricate)</h2>
            <div className="actions">
              <button onClick={copyToClipboard} className={`btn btn-copy ${copied ? 'copied' : ''}`}>
                <Copy size={16} /> {copied ? "Copiato!" : "Copia Dati"}
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
                  <th>Num</th>
                  <th>Data</th>
                  <th>Scad</th>
                  <th>Descrizione</th>
                  <th className="col-right">Imp.</th>
                  <th className="col-right">IVA</th>
                  <th className="col-right">Cassa</th>
                  <th className="col-right">Rit.</th>
                  <th className="col-right">Totale</th>
                  <th className="col-right">Pagamento</th>
                  <th>Tipo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className={getRowClass(inv)}>
                    <td>{inv.customerName}</td>
                    <td>{inv.supplierName}</td>
                    <td>{inv.invoiceNumber}</td>
                    <td className="col-date">{formatDate(inv.documentDate)}</td>
                    <td className="col-date">{formatDate(inv.dueDate)}</td>
                    <td>
                      <div className="desc-wrapper" title={inv.description}>
                        {inv.description}
                      </div>
                    </td>
                    <td className="col-right">{renderMoneyCell(inv.taxableAmount)}</td>
                    <td className="col-right">{renderMoneyCell(inv.vatAmount)}</td>
                    <td className="col-right">{renderMoneyCell(inv.pensionFund)}</td>
                    <td className="col-right">{renderMoneyCell(inv.withholdingTax)}</td>
                    <td className="col-right font-bold">{renderMoneyCell(inv.totalAmount)}</td>
                    <td className="col-right">{inv.paymentMethod}</td>
                    <td>{inv.docType}</td>
                    <td style={{textAlign: 'right'}}>
                      <button className="btn-icon" onClick={() => removeInvoice(inv.fileId)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="footer-note">
            Copia per Excel esclude Totale, Pagamento e Tipo. Note di credito in rosso, Rate in azzurro.
          </div>
        </div>
      )}
    </div>
  );
}