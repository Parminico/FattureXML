import React, { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { formatDate, formatMoney, renderMoneyCell } from "../utils/formatters";

export default function ResultsCard({ invoices, onReset, onRemove }) {
    const [copiedMTN, setCopiedMTN] = useState(false);
    const [copiedSPV, setCopiedSPV] = useState(false);

    // Funzione helper per creare la stringa tabellare da copiare
    const generateClipboardString = (rows) => {
        return rows.map(inv => [
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
    };

    // LOGICA 1: Solo Clienti "METANIA"
    const copyMTN = () => {
        const mtnRows = invoices.filter(inv => 
            inv.customerName && inv.customerName.toUpperCase().includes("METANIA")
        );

        if (mtnRows.length === 0) {
            alert("Nessuna fattura METANIA trovata.");
            return;
        }
        
        const dataStr = generateClipboardString(mtnRows);
        
        navigator.clipboard.writeText(dataStr)
        .then(() => { setCopiedMTN(true); setTimeout(() => setCopiedMTN(false), 2000); })
        .catch(() => alert("Errore copia"));
    };

    // LOGICA 2: Tutti gli ALTRI (SPV), ordinati alfabeticamente
    const copySPV = () => {
        const spvRows = invoices.filter(inv => 
            !inv.customerName || !inv.customerName.toUpperCase().includes("METANIA")
        );

        if (spvRows.length === 0) {
            alert("Nessuna fattura SPV trovata.");
            return;
        }

        // Ordina alfabeticamente per Nome Cliente
        spvRows.sort((a, b) => a.customerName.localeCompare(b.customerName));
        
        const dataStr = generateClipboardString(spvRows);
        
        navigator.clipboard.writeText(dataStr)
        .then(() => { setCopiedSPV(true); setTimeout(() => setCopiedSPV(false), 2000); })
        .catch(() => alert("Errore copia"));
    };

    if (invoices.length === 0) return null;

    const getRowClass = (inv) => {
        if (inv.isCreditNote) return "row-credit-note";
        if (inv.isInstallment) return "row-installment";
        return "";
    };

    // Calcolo del numero reale di documenti (contiamo solo quelli con isParent = true)
    const uniqueCount = invoices.filter(inv => inv.isParent).length;

    return (
        <div className="card">
        <div className="card-header">
            <h2>Riepilogo ({uniqueCount})</h2>
            <div className="actions">
                {/* Pulsante METANIA (Giallo/Oro per distinguerlo) */}
                <button 
                    onClick={copyMTN} 
                    className={`btn-copy ${copiedMTN ? 'copied' : ''}`}
                    style={{ backgroundColor: '#d97706', marginRight: '5px' }} // Colore ambra scuro
                >
                    <Copy size={16} /> {copiedMTN ? "Copiato!" : "Copia Dati MTN"}
                </button>

                {/* Pulsante SPV (Standard Blu) */}
                <button 
                    onClick={copySPV} 
                    className={`btn-copy ${copiedSPV ? 'copied' : ''}`}
                >
                    <Copy size={16} /> {copiedSPV ? "Copiato!" : "Copia Dati SPV"}
                </button>

                <button onClick={onReset} className="btn-reset">
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
                    <button className="btn-icon" onClick={() => onRemove(inv.fileId)}>
                        <Trash2 size={16} />
                    </button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
        <div className="footer-note">
            <b>MTN:</b> Solo clienti Metania. <b>SPV:</b> Tutti gli altri (ordinati A-Z).
        </div>
        </div>
    );
}