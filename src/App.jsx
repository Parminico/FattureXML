import React, { useState, useEffect } from "react";
import { Download, FileArchive, Upload, FileText, ShieldAlert } from "lucide-react"; 
import JSZip from "jszip"; 
import { saveAs } from "file-saver";

import Header from "./components/Header";
import UploadArea from "./components/UploadArea";
import ResultsCard from "./components/ResultsCard";
import { parseXmlFile } from "./utils/parser";
// Importiamo APP_CONFIG da mappings
import { sanitizeInvoiceNumber, sanitizeFilenameString, getCompactDate, APP_CONFIG } from "./utils/mappings";
import "./App.css";

export default function FattureXmlParser() {
  // --- 1. SICUREZZA (Password + Dominio) ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [isDomainAllowed, setIsDomainAllowed] = useState(true);

  // Controllo Dominio all'avvio
  useEffect(() => {
    const currentHostname = window.location.hostname;
    // Se il dominio corrente NON è nella lista dei permessi (presa da APP_CONFIG)
    const isAllowed = APP_CONFIG.ALLOWED_DOMAINS.some(domain => currentHostname.includes(domain));
    
    if (!isAllowed) {
        setIsDomainAllowed(false);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    // Controllo password usando APP_CONFIG
    if (pwInput === APP_CONFIG.PASSWORD) {
        setIsAuthenticated(true);
    } else {
        alert("Codice di accesso errato.");
    }
  };

  // --- 2. STATO DELL'APPLICAZIONE ---
  const [invoices, setInvoices] = useState([]);
  const [pdfFiles, setPdfFiles] = useState([]); 
  const [error, setError] = useState(null);
  const [isZipping, setIsZipping] = useState(false);

  // Helper per nome file base
  const getBaseName = (filename) => {
      return filename.replace(/(\.xml|\.p7m|\.pdf)+$/i, ""); 
  };

  const handleFiles = async (selectedFiles) => {
    const validXmlFiles = [];
    const validPdfFiles = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const lowerName = file.name.toLowerCase();
      
      if (lowerName.endsWith(".xml") || lowerName.endsWith(".xml.p7m")) {
        validXmlFiles.push(file);
      } else if (lowerName.endsWith(".pdf")) {
        validPdfFiles.push(file);
      }
    }
    
    if (validXmlFiles.length === 0 && validPdfFiles.length === 0) {
      setError("Nessun file valido selezionato.");
      return;
    }
    
    setError(null);

    if (validPdfFiles.length > 0) {
      setPdfFiles(prev => [...prev, ...validPdfFiles]);
    }
    
    if (validXmlFiles.length > 0) {
      for (const file of validXmlFiles) {
        try {
          const newRows = await parseXmlFile(file);
          setInvoices(prev => [...prev, ...newRows]);
        } catch (err) {
          console.error(err);
          setError(`Errore nel file ${file.name}: ${err.message}`);
        }
      }
    }
  };

  const handleReset = () => {
    setInvoices([]);
    setPdfFiles([]);
    setError(null);
  };

  const handleRemove = (fileId) => {
    setInvoices(prev => prev.filter(invoice => invoice.fileId !== fileId));
  };

  const handleDownloadZip = async () => {
    if (invoices.length === 0) return;
    setIsZipping(true);

    const zip = new JSZip();
    let count = 0;

    const uniqueInvoices = invoices.filter(inv => inv.isParent);

    uniqueInvoices.forEach(inv => {
      const baseNameXML = getBaseName(inv.fileName);
      const matchingPdf = pdfFiles.find(pdf => getBaseName(pdf.name) === baseNameXML);

      if (matchingPdf) {
        const dateStr = getCompactDate(inv.documentDate);
        const cleanNum = sanitizeInvoiceNumber(inv.invoiceNumber); 
        const cleanSupplier = sanitizeFilenameString(inv.supplierName);
        const cleanCustomer = sanitizeFilenameString(inv.customerName);

        const newFilename = `${dateStr}_${cleanNum}_${cleanSupplier}_${cleanCustomer}.pdf`;
        
        zip.file(newFilename, matchingPdf);
        count++;
      }
    });

    if (count === 0) {
      alert("Nessun PDF abbinato trovato! Assicurati che i file XML e PDF abbiano lo stesso nome.");
      setIsZipping(false);
      return;
    }

    try {
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "Fatture_Rinominate.zip");
    } catch (err) {
      console.error("Errore ZIP:", err);
      alert("Errore durante la creazione dell'archivio.");
    }
    
    setIsZipping(false);
  };

  // --- 3. RENDER CONDIZIONALE ---

  // A. BLOCCO DOMINIO (Massima Priorità)
  if (!isDomainAllowed) {
      return (
        <div style={{
            height: '100vh', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center', 
            background: '#fef2f2',
            color: '#991b1b',
            textAlign: 'center',
            padding: '20px'
        }}>
            <ShieldAlert size={64} style={{marginBottom: '20px'}} />
            <h1>Accesso Negato</h1>
            <p>Questo software non è autorizzato a girare su questo dominio.</p>
        </div>
      );
  }

  // B. BLOCCO PASSWORD
  if (!isAuthenticated) {
    return (
        <div style={{
            height: '100vh', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            background: '#f8fafc',
            fontFamily: "'Segoe UI', sans-serif"
        }}>
            <form onSubmit={handleLogin} style={{
                background: 'white', 
                padding: '2.5rem', 
                borderRadius: '12px', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                textAlign: 'center',
                width: '100%',
                maxWidth: '400px'
            }}>
                <div style={{marginBottom: '1.5rem', color: '#2563eb'}}>
                    <FileText size={48} />
                </div>
                <h2 style={{marginBottom: '0.5rem', color: '#1e293b'}}>Area Riservata</h2>
                <p style={{marginBottom: '1.5rem', color: '#64748b', fontSize: '0.9rem'}}>
                    Inserisci il codice di accesso
                </p>
                <input 
                    type="password" 
                    placeholder="Codice" 
                    value={pwInput} 
                    onChange={(e) => setPwInput(e.target.value)}
                    style={{
                        padding: '12px', 
                        borderRadius: '6px', 
                        border: '1px solid #cbd5e1',
                        marginBottom: '1.5rem',
                        width: '100%',
                        fontSize: '1rem',
                        outline: 'none'
                    }}
                />
                <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{
                        width: '100%', 
                        padding: '12px', 
                        fontSize: '1rem',
                        cursor: 'pointer'
                    }}
                >
                    Entra
                </button>
            </form>
        </div>
    );
  }

  // C. APP NORMALE
  const uniqueFilesCount = invoices.filter(inv => inv.isParent).length;
  const pdfCount = pdfFiles.length;

  return (
    <div className="app-container">
      <Header />
      
      <UploadArea onFilesSelected={handleFiles} error={error} />

      {uniqueFilesCount > 0 && (
        <div style={{
            textAlign: 'center', 
            marginBottom: '1.5rem', 
            padding: '10px', 
            backgroundColor: '#f8fafc', 
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            display: 'inline-block',
            width: '100%'
        }}>
          <span style={{marginRight: '20px'}}>📄 XML analizzati: <b>{uniqueFilesCount}</b></span>
          <span>📑 PDF in memoria: <b>{pdfCount}</b></span>
        </div>
      )}

      {uniqueFilesCount > 0 && (
        <div style={{display: 'flex', justifyContent: 'center', marginBottom: '2rem'}}>
            <button 
              onClick={handleDownloadZip} 
              className="btn-primary" 
              style={{
                  backgroundColor: pdfCount > 0 ? '#8b5cf6' : '#cbd5e1',
                  fontSize: '1.1rem', 
                  padding: '1rem 2rem',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: pdfCount > 0 ? 'pointer' : 'not-allowed'
              }}
              disabled={isZipping || pdfCount === 0}
              title={pdfCount === 0 ? "Carica anche i file PDF per scaricarli rinominati" : ""}
            >
              {isZipping ? "Compressione..." : (
                <>
                  <FileArchive size={24} style={{marginRight: '10px'}}/> 
                  Scarica PDF Rinominati (.zip)
                </>
              )}
            </button>
        </div>
      )}

      <ResultsCard 
        invoices={invoices} 
        onReset={handleReset} 
        onRemove={handleRemove} 
      />
    </div>
  );
}