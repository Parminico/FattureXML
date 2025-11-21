import React, { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { formatDate, formatMoney, renderMoneyCell } from "../utils/formatters";

export default function ResultsCard({ invoices, onReset, onRemove }) {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        if (invoices.length === 0) return;
        
        // Copia SOLO dati, descrizione minuscola, NO intestazioni
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
                <th className="text-right">Imponibile</th>
                <th className="text-right">IVA</th>
                <th className="text-right">Cassa</th>
                <th className="text-right">Ritenuta</th>
                <th className="text-right">Totale</th>
                <th className="text-right">Pagamento</th>
                <th></th>
                </tr>
            </thead>
            <tbody>
                {invoices.map((inv) => (
                <tr key={inv.id}>
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
                    <td style={{textAlign: 'right'}}>
                    <button className="btn-icon" onClick={() => onRemove(inv.id)}>
                        <Trash2 size={16} />
                    </button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
        <div className="footer-note">
            Copia per Excel esclude Totale e Pagamento.
        </div>
        </div>
    );
}