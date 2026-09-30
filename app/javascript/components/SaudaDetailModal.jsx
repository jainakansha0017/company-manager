import React, { useEffect } from "react";
import { formatDate } from "./SaudaList";
import { formatKg, formatMoney } from "./SaudaMarkFields";

// Drops a field entirely rather than showing it blank, so the modal reads as
// exactly what was filled in for this sauda and nothing more.
const filled = (rows) => rows.filter((row) => row.value != null && row.value !== "");

const money = (value) => (value == null ? null : formatMoney(Number(value)));
const date = (value) => (value == null ? null : formatDate(value));

// One grade line: what it was, how much of it, and what it came to once it
// carries a rate.
const gradeLine = (grade) => {
  const base = `${grade.grade}: ${grade.bags} bags, ${formatKg(Number(grade.total_kg))} kg`;
  return grade.rate == null
    ? base
    : `${base} @ ${formatMoney(Number(grade.rate))} = ${formatMoney(Number(grade.amount))}`;
};

// The whole sauda at a glance: everything that was filled in for it, with
// "OK" to dismiss and "Edit" to go make changes.
export default function SaudaDetailModal({ sauda, onClose, onEdit }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!sauda) return null;

  const details = filled([
    { label: "Seller", value: sauda.seller_name },
    { label: "Buyer", value: sauda.buyer_name },
    { label: "Sauda no.", value: sauda.sauda_no },
    { label: "Date", value: date(sauda.sauda_date) },
    { label: "Tax invoice no.", value: sauda.tax_invoice_no },
    { label: "Bill date", value: date(sauda.bill_date) },
    { label: "Destination", value: sauda.destination },
    { label: "Transporter", value: sauda.transporter_name },
    { label: "Bilty no.", value: sauda.bilty_no },
    { label: "Bilty date", value: date(sauda.bilty_date) },
    { label: "Discount %", value: sauda.discount_percent },
    { label: "Credit due", value: money(sauda.credit_due) },
  ]);

  const bill = filled([
    { label: "Total kg", value: sauda.total_kg == null ? null : formatKg(Number(sauda.total_kg)) },
    { label: "Amount", value: money(sauda.amount) },
    { label: "Discount amt", value: money(sauda.disc_amt) },
    { label: "Taxable value", value: money(sauda.taxable_value) },
    { label: "GST amt", value: money(sauda.gst_amt) },
    { label: "Total tax bill amt", value: money(sauda.total_tax_bill_amt) },
    { label: "Brokerage amt", value: money(sauda.brokerage_amt) },
  ]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={sauda.sauda_no ? `Sauda ${sauda.sauda_no}` : "Sauda"}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="modal__title">{sauda.sauda_no ? `Sauda ${sauda.sauda_no}` : "Sauda"}</h3>

        <dl className="modal__fields">
          {details.map((row) => (
            <React.Fragment key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </React.Fragment>
          ))}
        </dl>

        {sauda.sauda_marks.length > 0 && (
          <>
            <h4 className="modal__subtitle">Marks</h4>
            {sauda.sauda_marks.map((mark) => (
              <div key={mark.id} className="modal__mark">
                <p className="modal__mark-name">
                  {mark.mark_name}
                  {mark.lot_nos ? ` — lot ${mark.lot_nos}` : ""}
                </p>
                <ul className="modal__grades">
                  {mark.sauda_grades.map((grade) => (
                    <li key={grade.id}>{gradeLine(grade)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}

        {bill.length > 0 && (
          <>
            <h4 className="modal__subtitle">Bill</h4>
            <dl className="modal__fields">
              {bill.map((row) => (
                <React.Fragment key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          </>
        )}

        <div className="modal__footer">
          <button type="button" className="button" onClick={() => onEdit(sauda)}>
            Edit
          </button>
          <button type="button" className="button button--primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
