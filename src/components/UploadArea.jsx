import React, { useRef } from "react";
import { Upload, FileText } from "lucide-react";

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
            <h2><Upload size={20} /> Carica XML</h2>
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
                <FileText className="icon-large" />
                <div>
                <p style={{fontWeight: 'bold', marginBottom: '0.5rem'}}>Clicca o trascina i file qui</p>
                <p style={{color: '#64748b', fontSize: '0.9rem'}}>Supporta caricamento multiplo</p>
                </div>
                <button className="btn-primary">Sfoglia</button>
            </div>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xml,.p7m" 
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