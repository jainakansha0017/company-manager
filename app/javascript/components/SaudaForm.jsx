import React, { useEffect, useState } from "react";
import {
  createMark, createSauda, getSauda, listMarks, listParties, updateSauda,
} from "../lib/api";
import Combobox from "./Combobox";
import SaudaMarkFields, { formatKg, formatMoney, gradeAmount, kilos } from "./SaudaMarkFields";

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const blankLine = () => ({ markId: null, lotNos: "", gradeText: "", grades: [] });

const blankValues = () => ({
  sauda_no: "",
  sauda_date: today(),
  bill_date: "",
  tax_invoice_no: "",
  destination: "",
  transporter_name: "",
  bilty_no: "",
  bilty_date: "",
  buyer_id: null,
  discount_percent: "",
});

// A saved sauda read back into what the form holds. Nulls become empty strings
// so every input stays controlled.
const valuesFrom = (sauda) => ({
  sauda_no: sauda.sauda_no ?? "",
  sauda_date: sauda.sauda_date ?? "",
  bill_date: sauda.bill_date ?? "",
  tax_invoice_no: sauda.tax_invoice_no ?? "",
  destination: sauda.destination ?? "",
  transporter_name: sauda.transporter_name ?? "",
  bilty_no: sauda.bilty_no ?? "",
  bilty_date: sauda.bilty_date ?? "",
  buyer_id: sauda.buyer_id,
  discount_percent: sauda.discount_percent ?? "",
});

// The grade text is rebuilt from the grades themselves, so editing it splits
// and re-splits exactly as it does on a sauda being entered for the first time.
const linesFrom = (sauda) =>
  sauda.sauda_marks.map((mark) => ({
    markId: mark.mark_id,
    lotNos: mark.lot_nos ?? "",
    gradeText: mark.sauda_grades.map((grade) => grade.grade).join("; "),
    grades: mark.sauda_grades.map((grade) => ({
      grade: grade.grade,
      bags: grade.bags ?? "",
      weight: grade.weight ?? "",
      rate: grade.rate ?? "",
    })),
  }));

// Mirrors Sauda#set_amounts. The server is what actually stores these, so the
// rounding has to match step for step or the figures shift on save.
const GST_RATE = 0.05;
const BROKERAGE_RATE = 0.01;

// Which figure the broker's cut is taken from is the seller's own arrangement.
const BROKERAGE_BASES = {
  amount: { label: "amount", of: (derived) => derived.amount },
  taxable_value: { label: "taxable value", of: (derived) => derived.taxableValue },
};

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// The amount is the priced grades added up, not something anyone types.
const priceLines = (lines) => {
  const priced = lines.flatMap((line) => line.grades.map(gradeAmount)).filter((v) => v !== null);

  return priced.length ? priced.reduce((sum, value) => sum + value, 0) : null;
};

const deriveAmounts = (lines, discountPercent) => {
  const amount = priceLines(lines);
  if (amount === null) return null;

  const discAmt = round2((amount * (Number(discountPercent) || 0)) / 100);
  const taxableValue = round2(amount - discAmt);
  const gstAmt = round2(taxableValue * GST_RATE);

  return {
    amount,
    discAmt,
    taxableValue,
    gstAmt,
    totalTaxBillAmt: round2(taxableValue + gstAmt),
  };
};

// Adding a buyer means leaving this page, so the half-filled sauda is parked
// in sessionStorage and picked up again on the way back. Keyed by sauda too, so
// an edit in progress cannot be handed the draft of a new one.
const draftKey = (companyId, sellerId, saudaId) =>
  `sauda-draft:${companyId}:${sellerId}:${saudaId ?? "new"}`;

const takeDraft = (companyId, sellerId, saudaId) => {
  try {
    const key = draftKey(companyId, sellerId, saudaId);
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Enters a new sauda, or edits one already on record when given `saudaId`.
export default function SaudaForm({ companyId, sellerId, saudaId, buyerId, onNavigate }) {
  const [seller, setSeller] = useState(null);
  const [buyers, setBuyers] = useState([]);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marksLoading, setMarksLoading] = useState(true);

  const draft = React.useMemo(
    () => takeDraft(companyId, sellerId, saudaId),
    [companyId, sellerId, saudaId],
  );

  // Nothing to fetch for a new sauda, and a parked draft is newer than what is
  // on record, so neither has to wait.
  const [loadingSauda, setLoadingSauda] = useState(Boolean(saudaId) && !draft);

  const [values, setValues] = useState(() => ({
    ...blankValues(),
    ...(draft?.values ?? {}),
    // A buyer just created on the buyer page wins over anything parked.
    ...(buyerId ? { buyer_id: Number(buyerId) } : {}),
  }));
  const [lines, setLines] = useState(() => draft?.lines ?? [blankLine()]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const editing = Boolean(saudaId);
  const backToRegister = `/companies/${companyId}/sauda-register?seller_id=${sellerId}`;
  const formPath = editing
    ? `/companies/${companyId}/sauda-register/edit?seller_id=${sellerId}&sauda_id=${saudaId}`
    : `/companies/${companyId}/sauda-register/new?seller_id=${sellerId}`;

  // An edit starts from what is on record, unless we have just come back from
  // adding a buyer — then the parked draft is the newer of the two.
  useEffect(() => {
    if (!saudaId || draft) return undefined;

    let current = true;
    setLoadingSauda(true);

    getSauda(saudaId)
      .then((sauda) => {
        if (!current) return;
        setValues(valuesFrom(sauda));
        setLines(sauda.sauda_marks.length ? linesFrom(sauda) : [blankLine()]);
      })
      .catch(() => current && setErrors({ base: ["Could not load that sauda."] }))
      .finally(() => current && setLoadingSauda(false));

    return () => {
      current = false;
    };
  }, [saudaId, draft]);

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
      sessionStorage.setItem(
        draftKey(companyId, sellerId, saudaId),
        JSON.stringify({ values, lines }),
      );
    } catch {
      /* a full or disabled sessionStorage just means the draft is not kept */
    }

    const params = new URLSearchParams({ company_id: companyId, return: formPath });
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

    const payload = {
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
          rate: grade.rate,
        })),
      })),
    };

    try {
      if (editing) {
        await updateSauda(saudaId, payload);
      } else {
        await createSauda(payload);
      }

      onNavigate(`${backToRegister}&saved=1`);
    } catch (error) {
      setErrors(error.errors || { base: ["Something went wrong. Please try again."] });
      setSubmitting(false);
    }
  };

  const errorFor = (key) => errors[key]?.[0];

  const derived = deriveAmounts(lines, values.discount_percent);
  const brokerageBasis = BROKERAGE_BASES[seller?.brokerage_basis];

  if (loading || loadingSauda) return <p className="muted">Loading…</p>;

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
        <h2>{editing ? "Edit Sauda" : "New Sauda"}</h2>
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
            <label htmlFor="sauda_no">Sauda no.</label>
            <input
              id="sauda_no"
              type="text"
              value={values.sauda_no}
              onChange={setField("sauda_no")}
            />
            {errorFor("sauda_no") && <p className="field__error">{errorFor("sauda_no")}</p>}
          </div>

          <div className="field">
            <label htmlFor="sauda_date">
              Sauda date<span className="field__required"> *</span>
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
            <label htmlFor="bill_date">Bill date</label>
            <input
              id="bill_date"
              type="date"
              value={values.bill_date}
              onChange={setField("bill_date")}
            />
            {errorFor("bill_date") && <p className="field__error">{errorFor("bill_date")}</p>}
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

          <div className="field">
            <label htmlFor="destination">Destination</label>
            <input
              id="destination"
              type="text"
              value={values.destination}
              onChange={setField("destination")}
            />
          </div>

          <div className="field">
            <label htmlFor="transporter_name">Transporter name</label>
            <input
              id="transporter_name"
              type="text"
              value={values.transporter_name}
              onChange={setField("transporter_name")}
            />
            {errorFor("transporter_name") && (
              <p className="field__error">{errorFor("transporter_name")}</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="bilty_no">Bilty no.</label>
            <input
              id="bilty_no"
              type="text"
              value={values.bilty_no}
              onChange={setField("bilty_no")}
            />
            {errorFor("bilty_no") && <p className="field__error">{errorFor("bilty_no")}</p>}
          </div>

          <div className="field">
            <label htmlFor="bilty_date">Bilty date</label>
            <input
              id="bilty_date"
              type="date"
              value={values.bilty_date}
              onChange={setField("bilty_date")}
            />
            {errorFor("bilty_date") && <p className="field__error">{errorFor("bilty_date")}</p>}
          </div>

          
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
          <div className="field">
            <label htmlFor="discount_percent">Discount %</label>
            <input
              id="discount_percent"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={values.discount_percent}
              onChange={setField("discount_percent")}
            />
            {errorFor("discount_percent") && (
              <p className="field__error">{errorFor("discount_percent")}</p>
            )}
          </div>
        </div>

        {derived ? (
          <dl className="derived">
            <div className="derived__row">
              <dt>Amount</dt>
              <dd>{formatMoney(derived.amount)}</dd>
            </div>
            <div className="derived__row">
              <dt>Disc. amt.</dt>
              <dd>{formatMoney(derived.discAmt)}</dd>
            </div>
            <div className="derived__row">
              <dt>Taxable value</dt>
              <dd>{formatMoney(derived.taxableValue)}</dd>
            </div>
            <div className="derived__row">
              <dt>GST amt. (5%)</dt>
              <dd>{formatMoney(derived.gstAmt)}</dd>
            </div>
            <div className="derived__row derived__row--total">
              <dt>Total tax bill amt.</dt>
              <dd>{formatMoney(derived.totalTaxBillAmt)}</dd>
            </div>
            {brokerageBasis && (
              <div className="derived__row">
                <dt>Brokerage (1% of {brokerageBasis.label})</dt>
                <dd>{formatMoney(round2(brokerageBasis.of(derived) * BROKERAGE_RATE))}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="muted">
            Rate the grades above and the amount, discount, GST and bill total work
            themselves out.
          </p>
        )}
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? "Saving…" : editing ? "Update sauda" : "Save sauda"}
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
  sauda_no: "sauda no.",
  sauda_date: "sauda date",
  bill_date: "bill date",
  discount_percent: "discount %",
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
