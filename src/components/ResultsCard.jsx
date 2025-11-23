import React, { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { formatDate, formatMoney, renderMoneyCell } from "../utils/formatters";

export default function ResultsCard({ invoices, onReset, onRemove }) {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        if (invoices.length === 0) return;
        
        // Copia SOLO dati (niente intestazioni), descrizione minuscola
        // Esclude Totale, Pagamento e Tipo
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
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
        .catch(() => alert("Errore copia"));
    };

    if (invoices.length === 0) return null;

    // Determina la classe CSS per la riga (Rosso per Note Credito, Azzurro per Rate)
    const getRowClass = (inv) => {
        if (inv.isCreditNote) return "row-credit-note";
        if (inv.isInstallment) return "row-installment";
        return "";
    };

    return (
        <div className="card">
        <div className="card-header">
            <h2>Riepilogo ({invoices.length})</h2>
            <div className="actions">
            <button onClick={copyToClipboard} className={`btn-copy ${copied ? 'copied' : ''}`}>
                <Copy size={16} /> {copied ? "Copiato!" : "Copia Dati"}
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
            Copia per Excel esclude Totale, Pagamento e Tipo. Note di credito in rosso.
        </div>
        </div>
    );
}