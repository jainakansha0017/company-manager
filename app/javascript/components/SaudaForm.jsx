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

// Adding a buyer or seller means leaving this page, so the half-filled sauda is
// parked in sessionStorage and picked up again on the way back. Keyed by sauda,
// so an edit draft cannot be handed to a new sauda — the seller is no longer
// part of the key, since which seller the sauda is for is exactly what a trip
// to "add new seller" might be changing.
const draftKey = (saudaId) => `sauda-draft:${saudaId ?? "new"}`;

const takeDraft = (saudaId) => {
  try {
    const key = draftKey(saudaId);
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Enters a new sauda, or edits one already on record when given `saudaId`.
// `sellerId` from the URL means "select this seller" — set when returning from
// adding one on the spot, or (for an edit) the seller whose register this was
// opened from. A brand new sauda opened from the register carries no seller_id
// at all, so its dropdown opens empty rather than preselected.
export default function SaudaForm({ sellerId, saudaId, buyerId, onNavigate }) {
  const [sellers, setSellers] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marksLoading, setMarksLoading] = useState(true);

  const draft = React.useMemo(() => takeDraft(saudaId), [saudaId]);

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
  // A seller just created on the seller page wins over anything parked; short
  // of that, a parked draft is newer than the URL. Neither applies to a plain
  // "Add New Sauda" click, which is exactly the point — it starts unselected.
  const [selectedSellerId, setSelectedSellerId] = useState(() =>
    sellerId ? Number(sellerId) : draft?.sellerId ?? null,
  );
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const editing = Boolean(saudaId);

  const registerPath = "/sauda";
  const backToRegister = selectedSellerId
    ? `${registerPath}?seller_id=${selectedSellerId}`
    : registerPath;
  const formPath = (() => {
    const params = new URLSearchParams();
    if (selectedSellerId) params.set("seller_id", selectedSellerId);
    if (editing) params.set("sauda_id", saudaId);
    const query = params.toString();
    return `${registerPath}/${editing ? "edit" : "new"}${query ? `?${query}` : ""}`;
  })();

  // An edit starts from what is on record, unless we have just come back from
  // adding a buyer or seller — then the parked draft is the newer of the two.
  useEffect(() => {
    if (!saudaId || draft) return undefined;

    let current = true;
    setLoadingSauda(true);

    getSauda(saudaId)
      .then((sauda) => {
        if (!current) return;
        setValues(valuesFrom(sauda));
        setLines(sauda.sauda_marks.length ? linesFrom(sauda) : [blankLine()]);
        // Only a fallback: the URL normally already carries this seller's id.
        setSelectedSellerId((existing) => existing ?? sauda.seller_id);
      })
      .catch(() => current && setErrors({ base: ["Could not load that sauda."] }))
      .finally(() => current && setLoadingSauda(false));

    return () => {
      current = false;
    };
  }, [saudaId, draft]);

  useEffect(() => {
    let current = true;

    Promise.all([listParties("seller"), listParties("buyer")])
      .then(([sellerRecords, buyerRecords]) => {
        if (!current) return;
        setSellers(sellerRecords);
        setBuyers(buyerRecords);
      })
      .catch(() => {})
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, []);

  // Scoped to the seller once one is picked; before that, every seller's
  // marks come back, so a mark can be picked first and name its seller.
  useEffect(() => {
    let current = true;
    setMarksLoading(true);

    listMarks(selectedSellerId)
      .then((records) => current && setMarks(records))
      .catch(() => {})
      .finally(() => current && setMarksLoading(false));

    return () => {
      current = false;
    };
  }, [selectedSellerId]);

  const setField = (name) => (event) =>
    setValues((current) => ({ ...current, [name]: event.target.value }));

  // Marks are the seller's own, so switching sellers clears whatever mark
  // lines were started under the previous one rather than leaving them
  // pointed at marks that no longer make sense.
  const selectSeller = (seller) => {
    setSelectedSellerId(seller ? seller.id : null);
    setLines([blankLine()]);
  };

  // A mark can be picked before its seller is, since every mark belongs to
  // exactly one — so the first mark chosen on a blank form names the seller
  // for it, without touching a seller already chosen by hand.
  const selectMark = (index, mark) => {
    updateLine(index, { markId: mark ? mark.id : null });
    if (mark && !selectedSellerId) setSelectedSellerId(Number(mark.seller_id));
  };

  // The goods are going to the buyer, so their address is the destination in
  // all but the odd case. Filled in on selection and still editable after.
  // Clearing the buyer leaves it alone rather than wiping what is in the box.
  const selectBuyer = (buyer) =>
    setValues((current) => ({
      ...current,
      buyer_id: buyer ? buyer.id : null,
      destination: buyer?.address ?? current.destination,
    }));

  const updateLine = (index, patch) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const addLine = () => setLines((current) => [...current, blankLine()]);

  const removeLine = (index) =>
    setLines((current) => current.filter((_, i) => i !== index));

  // Marks are just a name, so "add new" saves one and selects it without
  // leaving the form.
  const handleCreateMark = async (index, name) => {
    if (!name || !selectedSellerId) return;

    try {
      const mark = await createMark(Number(selectedSellerId), name);
      setMarks((current) =>
        [...current, mark].sort((a, b) => a.name.localeCompare(b.name)),
      );
      updateLine(index, { markId: mark.id });
    } catch (error) {
      setErrors({ base: [error.errors?.name?.[0] ? `Mark ${error.errors.name[0]}` : "Could not add that mark."] });
    }
  };

  // Buyers and sellers need their full party form, so park the draft and come
  // back to it.
  const parkDraft = () => {
    try {
      sessionStorage.setItem(
        draftKey(saudaId),
        JSON.stringify({ values, lines, sellerId: selectedSellerId }),
      );
    } catch {
      /* a full or disabled sessionStorage just means the draft is not kept */
    }
  };

  const addNewBuyer = (name) => {
    parkDraft();

    const params = new URLSearchParams({ return: formPath });
    if (name) params.set("name", name);

    onNavigate(`/buyers/new?${params}`);
  };

  const addNewSeller = (name) => {
    parkDraft();

    const params = new URLSearchParams({ return: formPath });
    if (name) params.set("name", name);

    onNavigate(`/sellers/new?${params}`);
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
      seller_id: selectedSellerId ? Number(selectedSellerId) : null,
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

      onNavigate(`${backToRegister}${selectedSellerId ? "&" : "?"}saved=1`);
    } catch (error) {
      setErrors(error.errors || { base: ["Something went wrong. Please try again."] });
      setSubmitting(false);
    }
  };

  const errorFor = (key) => errors[key]?.[0];

  const seller = sellers.find((entry) => String(entry.id) === String(selectedSellerId)) ?? null;
  // Once a seller is picked the list is already just theirs; before that, the
  // seller's name rides along so marks that share a name across sellers (the
  // uniqueness is only scoped per seller) can still be told apart.
  const markOptions = selectedSellerId
    ? marks
    : marks.map((mark) => ({ ...mark, name: `${mark.name} — ${mark.seller_name}` }));
  const derived = deriveAmounts(lines, values.discount_percent);
  const brokerageBasis = BROKERAGE_BASES[seller?.brokerage_basis];

  if (loading || loadingSauda) return <p className="muted">Loading…</p>;

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
        <legend>Marks</legend>
        {lines.map((line, index) => (
          <SaudaMarkFields
            key={index}
            index={index}
            line={line}
            marks={markOptions}
            marksLoading={marksLoading}
            marksEmptyMessage={
              selectedSellerId ? "No marks for this seller yet." : "No marks on record yet."
            }
            onChange={updateLine}
            onRemove={lines.length > 1 ? removeLine : null}
            onSelectMark={selectMark}
            onCreateMark={selectedSellerId ? handleCreateMark : undefined}
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
        <legend>Party details</legend>
        <div className="grid">
          <Combobox
            label="Seller"
            options={sellers}
            value={selectedSellerId}
            onSelect={selectSeller}
            onAddNew={addNewSeller}
            addNewLabel="Add new seller"
            placeholder="Type a seller name…"
            emptyMessage="No sellers on record yet."
          />

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
            onSelect={selectBuyer}
            onAddNew={addNewBuyer}
            addNewLabel="Add new buyer"
            placeholder="Type a buyer name…"
            emptyMessage="No buyers on record yet."
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
        {errorFor("seller") && <p className="field__error">{errorFor("seller")}</p>}
        {errorFor("buyer") && <p className="field__error">{errorFor("buyer")}</p>}
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
