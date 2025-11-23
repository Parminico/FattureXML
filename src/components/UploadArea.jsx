import React, { useRef } from "react";
import { Upload, FileText, File } from "lucide-react";

export default function UploadArea({ onFilesSelected, error }) {
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('dragging');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('dragging');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragging');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2><Upload size={20} /> Carica File (XML e PDF)</h2>
      </div>
      <div className="card-body">
        <div 
          className="upload-area"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="upload-content">
            <div style={{display: 'flex', gap: '10px'}}>
                <FileText className="icon-large" />
                {/* Icona PDF aggiuntiva per far capire che si possono caricare */}
                <File className="icon-large" style={{opacity: 0.5}} />
            </div>
            <div>
              <p style={{fontWeight: 'bold', marginBottom: '0.5rem'}}>Trascina qui XML e PDF insieme</p>
              <p style={{color: '#64748b', fontSize: '0.9rem'}}>
                Il sistema abbinerà automaticamente i file con lo stesso nome.<br/>
                (Es. <i>fattura.xml</i> con <i>fattura.pdf</i>)
              </p>
            </div>
            <button className="btn-primary">Sfoglia File</button>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            // Accettiamo XML, P7M e PDF
            accept=".xml,.p7m,.pdf" 
            onChange={(e) => e.target.files && onFilesSelected(e.target.files)} 
            multiple 
            style={{display:'none'}}
          />
        </div>
        {error && <div className="error-msg">{error}</div>}
      </div>
    </div>
  );
}