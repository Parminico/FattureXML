import React, { useState, useRef } from "react";
import { Download, FileArchive, Upload, FileText } from "lucide-react"; // Aggiunti icon import
import JSZip from "jszip"; 
import { saveAs } from "file-saver";

import Header from "./components/Header";
import UploadArea from "./components/UploadArea";
import ResultsCard from "./components/ResultsCard";
import { parseXmlFile } from "./utils/parser";
import { sanitizeInvoiceNumber, sanitizeFilenameString, getCompactDate } from "./utils/mappings";
import "./App.css";

export default function FattureXmlParser() {
  const [invoices, setInvoices] = useState([]);
  const [pdfFiles, setPdfFiles] = useState([]); 
  const [error, setError] = useState(null);
  const [isZipping, setIsZipping] = useState(false);

  // Helper per nome file base
  const getBaseName = (filename) => {
      // Questa REGEX rimuove qualsiasi combinazione ripetuta di .xml, .p7m o .pdf alla fine del nome
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

  // --- LOGICA DOWNLOAD ZIP ---
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
        // COSTRUZIONE NOME (con pulizia soft)
        const dateStr = getCompactDate(inv.documentDate);
        const cleanNum = sanitizeInvoiceNumber(inv.invoiceNumber); // Lascia spazi/punti
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