import React from "react";
import { formatKg } from "./SaudaMarkFields";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-09-21" -> "21 Sep 2026". Spelled out rather than run through
// toLocaleDateString, which abbreviates September to the wider "Sept" in every
// day-first English locale and so wraps the column. Reading the parts straight
// off the string also keeps a timezone from shifting the day.
const formatDate = (value) => {
  const [year, month, day] = value.split("-");
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
};

// A dash for a figure the sauda does not carry yet, rather than a bare zero.
const money = (value) =>
  value == null
    ? "—"
    : Number(value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const gradeList = (mark) => mark.sauda_grades.map((entry) => entry.grade).join(", ") || "—";

export default function SaudaList({ saudas, loading, sellerName, onEdit, onDelete, deletingId }) {
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
      <table className="table table--register">
        {/* A fixed layout sizes its columns from the first row, and that row is
            the bands, whose cells each span five. The widths live here instead,
            in companies.css against `col`. */}
        <colgroup>
          {Array.from({ length: 16 }, (_, index) => (
            <col key={index} />
          ))}
        </colgroup>

        {/* Three bands: what the sauda is, what went out under each mark, and
            what the bill came to. Each column's own heading can stay short
            because the band above it says which of the three it belongs to. */}
        <thead>
          <tr className="table__bands">
            <th colSpan={5}>Sauda</th>
            <th colSpan={5} className="col--band-start">
              Mark
            </th>
            <th colSpan={5} className="col--band-start">
              Bill
            </th>
            <th className="col--band-start" aria-label="Actions" />
          </tr>
          <tr>
            <th>Date</th>
            <th>Tax invoice no.</th>
            <th>Bill date</th>
            <th>Destination</th>
            <th>Buyer</th>

            <th className="col--band-start">Mark</th>
            <th>Lot no.</th>
            <th>Grade</th>
            <th className="numeric">Bags</th>
            <th className="numeric">Kg</th>

            <th className="numeric col--band-start">Total</th>
            <th className="numeric">GST</th>
            <th className="numeric">Discount</th>
            <th className="numeric">Amount</th>
            <th className="numeric">Brokerage</th>

            <th className="col--band-start" />
          </tr>
        </thead>
        <tbody>
          {saudas.map((sauda, saudaIndex) => {
            // A row per mark, with the sauda's own columns spanned down the
            // side of them. A sauda with no marks still gets its one row.
            const marks = sauda.sauda_marks.length ? sauda.sauda_marks : [null];
            const span = marks.length;
            // Every other sauda is tinted as a whole, so a group of mark rows
            // reads as one sauda without having to trace the spanned cells.
            const tint = saudaIndex % 2 ? " table__row--tinted" : "";

            return marks.map((mark, index) => (
              <tr
                key={mark ? `${sauda.id}-${mark.id}` : sauda.id}
                className={`${index === 0 ? "table__row--sauda" : ""}${tint}`}
              >
                {index === 0 && (
                  <>
                    <td rowSpan={span}>{formatDate(sauda.sauda_date)}</td>
                    <td rowSpan={span}>{sauda.tax_invoice_no || "—"}</td>
                    <td rowSpan={span}>{sauda.bill_date ? formatDate(sauda.bill_date) : "—"}</td>
                    <td rowSpan={span}>{sauda.destination || "—"}</td>
                    <td rowSpan={span}>{sauda.buyer_name}</td>
                  </>
                )}

                <td className="col--band-start">{mark ? mark.mark_name : "—"}</td>
                <td>{mark?.lot_nos || "—"}</td>
                <td>{mark ? gradeList(mark) : "—"}</td>
                <td className="numeric">{mark ? mark.total_bags : "—"}</td>
                <td className="numeric">{mark ? formatKg(Number(mark.total_kg)) : "—"}</td>

                {index === 0 && (
                  <>
                    <td rowSpan={span} className="numeric col--band-start">
                      {money(sauda.total_tax_bill_amt)}
                    </td>
                    <td rowSpan={span} className="numeric">
                      {money(sauda.gst_amt)}
                    </td>
                    <td rowSpan={span} className="numeric">
                      {money(sauda.disc_amt)}
                    </td>
                    <td rowSpan={span} className="numeric">
                      {money(sauda.amount)}
                    </td>
                    <td rowSpan={span} className="numeric">
                      {money(sauda.brokerage_amt)}
                    </td>

                    {/* Edit and delete act on the whole sauda, so like its
                        other columns they sit beside all of its marks. */}
                    <td rowSpan={span} className="col--band-start">
                      <div className="table__actions table__actions--stacked">
                        <button
                          type="button"
                          className="button button--small"
                          onClick={() => onEdit(sauda)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button button--small button--danger"
                          onClick={() => onDelete(sauda)}
                          disabled={deletingId === sauda.id}
                        >
                          {deletingId === sauda.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}
