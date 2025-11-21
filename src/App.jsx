import React, { useState } from "react";
import Header from "./components/Header";
import UploadArea from "./components/UploadArea";
import ResultsCard from "./components/ResultsCard";
import { parseXmlFile } from "./utils/parser";
import "./App.css";

export default function FattureXmlParser() {
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);

  const handleFiles = async (selectedFiles) => {
    const validFiles = [];
    // Filtra solo i file con estensione .xml o .p7m
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
    
    // Elabora ogni file trovato
    for (const file of validFiles) {
      try {
        const newInvoice = await parseXmlFile(file);
        setInvoices(prev => [...prev, newInvoice]);
      } catch (err) {
        console.error(err);
        setError(`Errore nel file ${file.name}: ${err.message}`);
      }
    }
  };

  const handleReset = () => {
    setInvoices([]);
    setError(null);
  };

  const handleRemove = (id) => {
    setInvoices(prev => prev.filter(invoice => invoice.id !== id));
  };

  return (
    <div className="app-container">
      <Header />
      
      <UploadArea 
        onFilesSelected={handleFiles} 
        error={error} 
      />

      <ResultsCard 
        invoices={invoices} 
        onReset={handleReset} 
        onRemove={handleRemove} 
      />
    </div>
  );
}