import React, { useEffect, useMemo, useState } from "react";
import {
  checkSaudaNoAvailable, createMark, createSauda, getLastEntryDate, getSauda, listMarks,
  listParties, updateSauda,
} from "../lib/api";
import Combobox from "./Combobox";
import SaudaMarkFields, { formatKg, formatMoney, gradeAmount, kilos, splitList } from "./SaudaMarkFields";

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const blankLine = () => ({ markId: null, lotNos: "", gradeText: "", grades: [] });

// `lotNos` is an array of lot nos picked from those entered under Marks, only
// meaningful once "All" is unchecked — while it is checked this one bill
// stands for every lot, same as a sauda that has never been split.
const blankBill = () => ({ billNo: "", billDate: "", biltyNo: "", biltyDate: "", lotNos: [] });

const blankValues = () => ({
  sauda_no: "",
  sauda_date: today(),
  destination: "",
  transporter_name: "",
  buyer_id: null,
  discount_percent: "",
  credit_due: "",
});

// A saved sauda read back into what the form holds. Nulls become empty strings
// so every input stays controlled.
const valuesFrom = (sauda) => ({
  sauda_no: sauda.sauda_no ?? "",
  sauda_date: sauda.sauda_date ?? "",
  destination: sauda.destination ?? "",
  transporter_name: sauda.transporter_name ?? "",
  buyer_id: sauda.buyer_id,
  discount_percent: sauda.discount_percent ?? "",
  credit_due: sauda.credit_due ?? "",
});

// Mirrors linesFrom, for the bills side of a loaded sauda.
const billsFrom = (sauda) =>
  sauda.sauda_bills.map((bill) => ({
    billNo: bill.bill_no ?? "",
    billDate: bill.bill_date ?? "",
    biltyNo: bill.bilty_no ?? "",
    biltyDate: bill.bilty_date ?? "",
    lotNos: splitList(bill.lot_nos ?? ""),
  }));

// "All" is what one bill with no lot nos of its own means — the state a sauda
// starts in and the only one a single bill can be in.
const isAllLots = (bills) => bills.length <= 1 && bills.every((bill) => bill.lotNos.length === 0);

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

  const totalTaxBillAmt = round2(taxableValue + gstAmt);
  const finalAmount = Math.round(totalTaxBillAmt);

  return {
    amount,
    discAmt,
    taxableValue,
    gstAmt,
    totalTaxBillAmt,
    // Rounded off to the nearest rupee, the way the bill is actually settled.
    roundOff: round2(finalAmount - totalTaxBillAmt),
    finalAmount,
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
  const [bills, setBills] = useState(() => draft?.bills ?? [blankBill()]);
  const [allLots, setAllLots] = useState(() => draft?.allLots ?? true);
  // A seller just created on the seller page wins over anything parked; short
  // of that, a parked draft is newer than the URL. Neither applies to a plain
  // "Add New Sauda" click, which is exactly the point — it starts unselected.
  const [selectedSellerId, setSelectedSellerId] = useState(() =>
    sellerId ? Number(sellerId) : draft?.sellerId ?? null,
  );
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  // Checked live, independently of the errors a submit comes back with, so
  // typing a number already on record says so straight away.
  const [saudaNoTaken, setSaudaNoTaken] = useState(false);

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
        const loadedBills = sauda.sauda_bills.length ? billsFrom(sauda) : [blankBill()];
        setBills(loadedBills);
        setAllLots(isAllLots(loadedBills));
        // Only a fallback: the URL normally already carries this seller's id.
        setSelectedSellerId((existing) => existing ?? sauda.seller_id);
      })
      .catch(() => current && setErrors({ base: ["Could not load that sauda."] }))
      .finally(() => current && setLoadingSauda(false));

    return () => {
      current = false;
    };
  }, [saudaId, draft]);

  // A brand new sauda starts dated the same as the last one entered, not
  // today — most are entered in batches on the one day's goods. Only for a
  // fresh form: an edit already carries its own date, and a parked draft is
  // newer than either.
  useEffect(() => {
    if (saudaId || draft) return undefined;

    let current = true;

    getLastEntryDate()
      .then(({ sauda_date }) => {
        if (current && sauda_date) setValues((v) => ({ ...v, sauda_date }));
      })
      .catch(() => {});

    return () => {
      current = false;
    };
  }, [saudaId, draft]);

  // A sauda no. has to be unique everywhere, not just within a seller, so
  // this is checked against the whole table as it's typed rather than only
  // when the form is submitted. Debounced so every keystroke doesn't fire a
  // request; `saudaId` leaves the sauda being edited out of its own check.
  useEffect(() => {
    const saudaNo = values.sauda_no.trim();
    if (!saudaNo) {
      setSaudaNoTaken(false);
      return undefined;
    }

    let current = true;
    const timer = setTimeout(() => {
      checkSaudaNoAvailable(saudaNo, saudaId)
        .then(({ available }) => current && setSaudaNoTaken(!available))
        .catch(() => {});
    }, 400);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [values.sauda_no, saudaId]);

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

  // Every lot no. entered under Marks, in the order typed there, is what a
  // bill can be assigned — the same free text, just read back out.
  const availableLotNos = useMemo(
    () => [...new Set(lines.flatMap((line) => splitList(line.lotNos)))],
    [lines],
  );

  const updateBill = (index, patch) =>
    setBills((current) => current.map((bill, i) => (i === index ? { ...bill, ...patch } : bill)));

  const addBill = () => setBills((current) => [...current, blankBill()]);

  const removeBill = (index) =>
    setBills((current) => current.filter((_, i) => i !== index));

  const toggleBillLotNo = (index, lotNo, checked) =>
    updateBill(index, {
      lotNos: checked
        ? [...bills[index].lotNos, lotNo]
        : bills[index].lotNos.filter((entry) => entry !== lotNo),
    });

  // Unchecking "All" just opens up the lot-no picker on the one bill there
  // already is; checking it back collapses to that same one bill, with
  // whatever lots it had picked let go since it now stands for all of them.
  const setAllLotsMode = (checked) => {
    setAllLots(checked);
    if (checked) setBills((current) => [{ ...current[0], lotNos: [] }]);
  };

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
        JSON.stringify({ values, lines, bills, allLots, sellerId: selectedSellerId }),
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
      sauda_bills_attributes: bills.map((bill) => ({
        bill_no: bill.billNo,
        bill_date: bill.billDate,
        bilty_no: bill.biltyNo,
        bilty_date: bill.biltyDate,
        lot_nos: allLots ? "" : bill.lotNos.join("; "),
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
  const markOptions = marks;
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
        <legend>Sauda</legend>
        <div className="grid">
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
            <label htmlFor="sauda_no">Sauda no.</label>
            <input
              id="sauda_no"
              type="text"
              value={values.sauda_no}
              onChange={setField("sauda_no")}
            />
            {saudaNoTaken && !errorFor("sauda_no") && (
              <p className="field__error">That sauda no. is already in use.</p>
            )}
            {errorFor("sauda_no") && <p className="field__error">{errorFor("sauda_no")}</p>}
          </div>
        </div>
      </fieldset>

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
        <legend>Billing</legend>
        <label className="field field--checkbox">
          <input
            type="checkbox"
            checked={allLots}
            onChange={(event) => setAllLotsMode(event.target.checked)}
          />
          All (one bill covers every lot)
        </label>

        {bills.map((bill, index) => (
          <div className="sauda-bill" key={index}>
            <div className="sauda-bill__header">
              <h3>Bill {index + 1}</h3>
              {!allLots && bills.length > 1 && (
                <button
                  type="button"
                  className="button button--small"
                  onClick={() => removeBill(index)}
                >
                  Remove bill
                </button>
              )}
            </div>

            <div className="grid">
              <div className="field">
                <label htmlFor={`bill_no_${index}`}>Bill no.</label>
                <input
                  id={`bill_no_${index}`}
                  type="text"
                  value={bill.billNo}
                  onChange={(event) => updateBill(index, { billNo: event.target.value })}
                />
                {errorFor(`sauda_bills[${index}].bill_no`) && (
                  <p className="field__error">{errorFor(`sauda_bills[${index}].bill_no`)}</p>
                )}
              </div>

              <div className="field">
                <label htmlFor={`bill_date_${index}`}>Bill date</label>
                <input
                  id={`bill_date_${index}`}
                  type="date"
                  value={bill.billDate}
                  onChange={(event) => updateBill(index, { billDate: event.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor={`bilty_no_${index}`}>Bilty no.</label>
                <input
                  id={`bilty_no_${index}`}
                  type="text"
                  value={bill.biltyNo}
                  onChange={(event) => updateBill(index, { biltyNo: event.target.value })}
                />
                {errorFor(`sauda_bills[${index}].bilty_no`) && (
                  <p className="field__error">{errorFor(`sauda_bills[${index}].bilty_no`)}</p>
                )}
              </div>

              <div className="field">
                <label htmlFor={`bilty_date_${index}`}>Bilty date</label>
                <input
                  id={`bilty_date_${index}`}
                  type="date"
                  value={bill.biltyDate}
                  onChange={(event) => updateBill(index, { biltyDate: event.target.value })}
                />
              </div>
            </div>

            {!allLots && (
              <div className="field">
                <label>Lot no.</label>
                {availableLotNos.length === 0 ? (
                  <p className="muted">
                    Enter lot numbers under Marks above to assign them to a bill.
                  </p>
                ) : (
                  <div className="checkbox-group">
                    {availableLotNos.map((lotNo) => {
                      const assignedElsewhere = bills.some(
                        (other, otherIndex) => otherIndex !== index && other.lotNos.includes(lotNo),
                      );
                      return (
                        <label key={lotNo} className="checkbox-group__item">
                          <input
                            type="checkbox"
                            checked={bill.lotNos.includes(lotNo)}
                            disabled={assignedElsewhere}
                            onChange={(event) =>
                              toggleBillLotNo(index, lotNo, event.target.checked)
                            }
                          />
                          {lotNo}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {!allLots && (
          <button type="button" className="button" onClick={addBill}>
            + Add another bill
          </button>
        )}
        {errorFor("sauda_bills") && <p className="field__error">{errorFor("sauda_bills")}</p>}
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

          <div className="field">
            <label htmlFor="credit_due">Credit due</label>
            <input
              id="credit_due"
              type="number"
              min="0"
              step="0.01"
              value={values.credit_due}
              onChange={setField("credit_due")}
            />
            {errorFor("credit_due") && <p className="field__error">{errorFor("credit_due")}</p>}
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
            <div className="derived__row">
              <dt>Round off</dt>
              <dd>{formatMoney(derived.roundOff)}</dd>
            </div>
            <div className="derived__row derived__row--total">
              <dt>Final amount</dt>
              <dd>{formatMoney(derived.finalAmount)}</dd>
            </div>
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
  sauda_bills: "Bills",
  lot_nos: "lot no.",
  bill_no: "bill no.",
  bilty_no: "bilty no.",
  sauda_no: "sauda no.",
  sauda_date: "sauda date",
  discount_percent: "discount %",
  credit_due: "credit due",
};

const label = (attribute) => LABELS[attribute] ?? attribute.replace(/_/g, " ");

// "sauda_marks[0].sauda_grades[1].bags" -> "Mark 1 grade 2 bags"
function humanize(key) {
  const readable = key
    .replace(/sauda_marks\[(\d+)\]\./g, (_, index) => `Mark ${Number(index) + 1} `)
    .replace(/sauda_grades\[(\d+)\]\./g, (_, index) => `grade ${Number(index) + 1} `)
    .replace(/sauda_bills\[(\d+)\]\./g, (_, index) => `Bill ${Number(index) + 1} `);

  if (readable !== key) return readable.replace(/([\w.]+)$/, (attribute) => label(attribute));

  return label(key).replace(/^./, (character) => character.toUpperCase());
}
