import React from "react";
import { formatKg } from "./SaudaMarkFields";

// "2026-09-21" -> "21 Sep 2026", without letting a timezone shift the day.
const formatDate = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatMoney = (value) =>
  value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const markSummary = (sauda) =>
  sauda.sauda_marks.map((entry) => entry.mark_name).join(", ") || "—";

export default function SaudaList({ saudas, loading, sellerName }) {
  if (loading) return <p className="muted">Loading saudas…</p>;

  if (saudas.length === 0) {
    return (
      <p className="muted">
        No saudas for {sellerName} yet. Use “Add New Sauda” to create the first one.
      </p>
    );
  }

  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>Sauda no.</th>
            <th>Sauda date</th>
            <th>Bill date</th>
            <th>Tax invoice no.</th>
            <th>Buyer</th>
            <th>Marks</th>
            <th>Destination</th>
            <th className="numeric">Total kg</th>
            <th className="numeric">Bill total</th>
          </tr>
        </thead>
        <tbody>
          {saudas.map((sauda) => (
            <tr key={sauda.id}>
              <td>{sauda.sauda_no || "—"}</td>
              <td>{formatDate(sauda.sauda_date)}</td>
              <td>{sauda.bill_date ? formatDate(sauda.bill_date) : "—"}</td>
              <td>{sauda.tax_invoice_no || "—"}</td>
              <td>{sauda.buyer_name}</td>
              <td>{markSummary(sauda)}</td>
              <td>{sauda.destination || "—"}</td>
              <td className="numeric">{formatKg(Number(sauda.total_kg))}</td>
              <td className="numeric">
                {sauda.total_tax_bill_amt ? formatMoney(Number(sauda.total_tax_bill_amt)) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
