import React, { useEffect, useState } from "react";
import { createMark, createSauda, listMarks, listParties } from "../lib/api";
import Combobox from "./Combobox";
import SaudaMarkFields, { formatKg, kilos } from "./SaudaMarkFields";

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const blankLine = () => ({ markId: null, lotNos: "", gradeText: "", grades: [] });

const blankValues = () => ({
  sauda_date: today(),
  tax_invoice_no: "",
  destination: "",
  buyer_id: null,
  total_tax_bill_amt: "",
  gst_amt: "",
  disc_amt: "",
  taxable_value: "",
});

// Adding a buyer means leaving this page, so the half-filled sauda is parked
// in sessionStorage and picked up again on the way back.
const draftKey = (companyId, sellerId) => `sauda-draft:${companyId}:${sellerId}`;

const takeDraft = (companyId, sellerId) => {
  try {
    const raw = sessionStorage.getItem(draftKey(companyId, sellerId));
    sessionStorage.removeItem(draftKey(companyId, sellerId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function NewSauda({ companyId, sellerId, buyerId, onNavigate }) {
  const [seller, setSeller] = useState(null);
  const [buyers, setBuyers] = useState([]);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marksLoading, setMarksLoading] = useState(true);

  const draft = React.useMemo(() => takeDraft(companyId, sellerId), [companyId, sellerId]);

  const [values, setValues] = useState(() => ({
    ...blankValues(),
    ...(draft?.values ?? {}),
    // A buyer just created on the buyer page wins over anything parked.
    ...(buyerId ? { buyer_id: Number(buyerId) } : {}),
  }));
  const [lines, setLines] = useState(() => draft?.lines ?? [blankLine()]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const backToRegister = `/companies/${companyId}/sauda-register?seller_id=${sellerId}`;

  useEffect(() => {
    let current = true;

    Promise.all([listParties("seller", companyId), listParties("buyer", companyId)])
      .then(([sellers, buyerRecords]) => {
        if (!current) return;
        setSeller(sellers.find((entry) => String(entry.id) === String(sellerId)) ?? null);
        setBuyers(buyerRecords);
      })
      .catch(() => {})
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [companyId, sellerId]);

  useEffect(() => {
    let current = true;
    setMarksLoading(true);

    listMarks(sellerId)
      .then((records) => current && setMarks(records))
      .catch(() => {})
      .finally(() => current && setMarksLoading(false));

    return () => {
      current = false;
    };
  }, [sellerId]);

  const setField = (name) => (event) =>
    setValues((current) => ({ ...current, [name]: event.target.value }));

  const updateLine = (index, patch) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const addLine = () => setLines((current) => [...current, blankLine()]);

  const removeLine = (index) =>
    setLines((current) => current.filter((_, i) => i !== index));

  // Marks are just a name, so "add new" saves one and selects it without
  // leaving the form.
  const handleCreateMark = async (index, name) => {
    if (!name) return;

    try {
      const mark = await createMark(Number(sellerId), name);
      setMarks((current) =>
        [...current, mark].sort((a, b) => a.name.localeCompare(b.name)),
      );
      updateLine(index, { markId: mark.id });
    } catch (error) {
      setErrors({ base: [error.errors?.name?.[0] ? `Mark ${error.errors.name[0]}` : "Could not add that mark."] });
    }
  };

  // Buyers need the full party form, so park the draft and come back to it.
  const addNewBuyer = (name) => {
    try {
      sessionStorage.setItem(draftKey(companyId, sellerId), JSON.stringify({ values, lines }));
    } catch {
      /* a full or disabled sessionStorage just means the draft is not kept */
    }

    const params = new URLSearchParams({
      company_id: companyId,
      return: `/companies/${companyId}/sauda-register/new?seller_id=${sellerId}`,
    });
    if (name) params.set("name", name);

    onNavigate(`/buyers/new?${params}`);
  };

  const totalKg = lines.reduce(
    (sum, line) => sum + line.grades.reduce((lineSum, grade) => lineSum + kilos(grade), 0),
    0,
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      await createSauda({
        ...values,
        company_id: Number(companyId),
        seller_id: Number(sellerId),
        sauda_marks_attributes: lines.map((line) => ({
          mark_id: line.markId,
          lot_nos: line.lotNos,
          sauda_grades_attributes: line.grades.map((grade) => ({
            grade: grade.grade,
            bags: grade.bags,
            weight: grade.weight,
          })),
        })),
      });

      onNavigate(`${backToRegister}&saved=1`);
    } catch (error) {
      setErrors(error.errors || { base: ["Something went wrong. Please try again."] });
      setSubmitting(false);
    }
  };

  const errorFor = (key) => errors[key]?.[0];

  const amount = (name, label) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        type="number"
        min="0"
        step="0.01"
        value={values[name]}
        onChange={setField(name)}
      />
      {errorFor(name) && <p className="field__error">{errorFor(name)}</p>}
    </div>
  );

  if (loading) return <p className="muted">Loading…</p>;

  if (!seller) {
    return (
      <div className="card panel">
        <p className="alert alert--error">That seller no longer exists.</p>
      </div>
    );
  }

  return (
    <form className="card panel" onSubmit={handleSubmit} noValidate>
      <div className="panel__header">
        <h2>New Sauda</h2>
        <a
          href={backToRegister}
          className="link"
          onClick={(event) => {
            event.preventDefault();
            onNavigate(backToRegister);
          }}
        >
          ← Back to sauda register
        </a>
      </div>

      {Object.keys(errors).length > 0 && (
        <div className="alert alert--error">
          <strong>Please fix the following:</strong>
          <ul>
            {Object.entries(errors).flatMap(([key, messages]) =>
              messages.map((message) => (
                <li key={`${key}-${message}`}>
                  {key === "base" ? message : `${humanize(key)} ${message}`}
                </li>
              )),
            )}
          </ul>
        </div>
      )}

      <fieldset>
        <legend>Sauda</legend>
        <div className="grid">
          <div className="field">
            <span className="field__label">Seller</span>
            <p className="field__static">{seller.name}</p>
          </div>

          <div className="field">
            <label htmlFor="sauda_date">
              Date<span className="field__required"> *</span>
            </label>
            <input
              id="sauda_date"
              type="date"
              value={values.sauda_date}
              onChange={setField("sauda_date")}
            />
            {errorFor("sauda_date") && <p className="field__error">{errorFor("sauda_date")}</p>}
          </div>

          <div className="field">
            <label htmlFor="tax_invoice_no">Tax invoice no.</label>
            <input
              id="tax_invoice_no"
              type="text"
              value={values.tax_invoice_no}
              onChange={setField("tax_invoice_no")}
            />
          </div>

          <div className="field">
            <label htmlFor="destination">Destination</label>
            <input
              id="destination"
              type="text"
              value={values.destination}
              onChange={setField("destination")}
            />
          </div>

          <Combobox
            label="Buyer"
            options={buyers}
            value={values.buyer_id}
            onSelect={(buyer) =>
              setValues((current) => ({ ...current, buyer_id: buyer ? buyer.id : null }))
            }
            onAddNew={addNewBuyer}
            addNewLabel="Add new buyer"
            placeholder="Type a buyer name…"
            emptyMessage="No buyers for this company yet."
          />
        </div>
        {errorFor("buyer") && <p className="field__error">{errorFor("buyer")}</p>}
      </fieldset>

      <fieldset>
        <legend>Marks</legend>
        {lines.map((line, index) => (
          <SaudaMarkFields
            key={index}
            index={index}
            line={line}
            marks={marks}
            marksLoading={marksLoading}
            onChange={updateLine}
            onRemove={lines.length > 1 ? removeLine : null}
            onCreateMark={handleCreateMark}
            errorFor={errorFor}
          />
        ))}

        <div className="sauda-total">
          <button type="button" className="button" onClick={addLine}>
            + Add another mark
          </button>
          <p className="sauda-total__value">
            Total kg <strong>{formatKg(totalKg)}</strong>
          </p>
        </div>
        {errorFor("sauda_marks") && <p className="field__error">{errorFor("sauda_marks")}</p>}
      </fieldset>

      <fieldset>
        <legend>Amounts</legend>
        <div className="grid">
          {amount("total_tax_bill_amt", "Total tax bill amt.")}
          {amount("gst_amt", "GST amt.")}
          {amount("disc_amt", "Disc. amt.")}
          {amount("taxable_value", "Taxable value")}
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save sauda"}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => onNavigate(backToRegister)}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const LABELS = {
  sauda_marks: "Marks",
  sauda_grades: "grades",
  lot_nos: "lot no.",
  tax_invoice_no: "tax invoice no.",
  total_tax_bill_amt: "total tax bill amt.",
  gst_amt: "GST amt.",
  disc_amt: "disc. amt.",
  taxable_value: "taxable value",
  sauda_date: "date",
};

const label = (attribute) => LABELS[attribute] ?? attribute.replace(/_/g, " ");

// "sauda_marks[0].sauda_grades[1].bags" -> "Mark 1 grade 2 bags"
function humanize(key) {
  const readable = key
    .replace(/sauda_marks\[(\d+)\]\./g, (_, index) => `Mark ${Number(index) + 1} `)
    .replace(/sauda_grades\[(\d+)\]\./g, (_, index) => `grade ${Number(index) + 1} `);

  if (readable !== key) return readable.replace(/([\w.]+)$/, (attribute) => label(attribute));

  return label(key).replace(/^./, (character) => character.toUpperCase());
}
