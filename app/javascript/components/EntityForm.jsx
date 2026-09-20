import React, { useState } from "react";
import BankAccountFields from "./BankAccountFields";

const blankBankAccount = () => ({
  bank_name: "",
  branch: "",
  account_number: "",
  ifsc_code: "",
  account_type: "",
});

// Shared by companies, buyers and sellers. Companies additionally carry a
// financial year; everything else is identical.
const BASE_FIELDS = {
  name: "",
  address: "",
  email: "",
  phone_no: "",
  pan: "",
  gst_registered: false,
  gst_no: "",
  trade_license_no: "",
  food_license_no: "",
};

// The API returns absent values as null; the inputs are controlled, so coerce
// them back to "".
const toFormValues = (record, blank) =>
  Object.fromEntries(Object.keys(blank).map((key) => [key, record[key] ?? blank[key]]));

export default function EntityForm({
  heading,
  entity,
  prefill,
  includeFinancialYear = false,
  onSubmit,
  onSaved,
  onCancel,
}) {
  const blank = includeFinancialYear ? { ...BASE_FIELDS, financial_year: "" } : BASE_FIELDS;
  const isEditing = Boolean(entity);

  // `prefill` seeds a new record (e.g. the name typed into a combobox) without
  // turning the form into an edit.
  const [values, setValues] = useState(() => toFormValues(entity ?? prefill ?? {}, blank));
  const [bankAccounts, setBankAccounts] = useState(() =>
    isEditing && entity.bank_accounts?.length > 0
      ? entity.bank_accounts.map((account) => ({
          id: account.id,
          ...toFormValues(account, blankBankAccount()),
        }))
      : [blankBankAccount()],
  );
  // Saved accounts the user removed, replayed as `_destroy` on submit.
  const [removedBankAccounts, setRemovedBankAccounts] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const setField = (name) => (event) =>
    setValues({ ...values, [name]: event.target.value });

  const setGstRegistered = (registered) =>
    setValues({
      ...values,
      gst_registered: registered,
      gst_no: registered ? values.gst_no : "",
    });

  const updateBankAccount = (index, field, value) =>
    setBankAccounts(
      bankAccounts.map((account, i) =>
        i === index ? { ...account, [field]: value } : account,
      ),
    );

  const addBankAccount = () => setBankAccounts([...bankAccounts, blankBankAccount()]);

  const removeBankAccount = (index) => {
    const removed = bankAccounts[index];
    if (removed.id) {
      setRemovedBankAccounts([...removedBankAccounts, { id: removed.id, _destroy: true }]);
    }
    setBankAccounts(bankAccounts.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const saved = await onSubmit({
        ...values,
        bank_accounts_attributes: [...bankAccounts, ...removedBankAccounts],
      });
      onSaved(saved);
    } catch (error) {
      setErrors(error.errors || { base: ["Something went wrong. Please try again."] });
    } finally {
      setSubmitting(false);
    }
  };

  const errorFor = (name) => errors[name]?.[0];

  const field = (name, label, { type = "text", required = false, ...rest } = {}) => (
    <div className="field">
      <label htmlFor={name}>
        {label}
        {required && <span className="field__required"> *</span>}
      </label>
      <input id={name} type={type} value={values[name]} onChange={setField(name)} {...rest} />
      {errorFor(name) && <p className="field__error">{errorFor(name)}</p>}
    </div>
  );

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h2>{heading}</h2>

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
        <legend>Details</legend>
        <div className="grid">
          {field("name", "Name", { required: true })}
          {field("email", "Email", { type: "email", required: true })}
          {field("phone_no", "Phone no.", { required: true })}
          {includeFinancialYear &&
            field("financial_year", "Financial year", {
              required: true,
              placeholder: "2025-26",
            })}
        </div>

        <div className="field">
          <label htmlFor="address">
            Address<span className="field__required"> *</span>
          </label>
          <textarea
            id="address"
            rows={3}
            value={values.address}
            onChange={setField("address")}
          />
          {errorFor("address") && <p className="field__error">{errorFor("address")}</p>}
        </div>
      </fieldset>

      <fieldset>
        <legend>Registrations</legend>
        <div className="grid">
          {field("pan", "PAN", { placeholder: "ABCDE1234F", maxLength: 10 })}
          {field("trade_license_no", "Trade license no.")}
          {field("food_license_no", "Food license no.")}
        </div>

        <div className="field">
          <span className="field__label">GST registered?</span>
          <div className="radio-row">
            <label>
              <input
                type="radio"
                name="gst_registered"
                checked={values.gst_registered === true}
                onChange={() => setGstRegistered(true)}
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                name="gst_registered"
                checked={values.gst_registered === false}
                onChange={() => setGstRegistered(false)}
              />
              No
            </label>
          </div>
        </div>

        {values.gst_registered &&
          field("gst_no", "GST no.", {
            required: true,
            placeholder: "19ABCDE1234F1Z5",
            maxLength: 15,
          })}
      </fieldset>

      <fieldset>
        <legend>Bank accounts</legend>
        {bankAccounts.map((account, index) => (
          <BankAccountFields
            key={account.id ?? `new-${index}`}
            index={index}
            account={account}
            errors={errors}
            onChange={updateBankAccount}
            onRemove={bankAccounts.length > 1 ? removeBankAccount : null}
          />
        ))}
        <button type="button" className="button" onClick={addBankAccount}>
          + Add another bank
        </button>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? "Saving…" : isEditing ? "Update" : "Save"}
        </button>
        <button type="button" className="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// Acronyms that "pan" -> "Pan" would mangle.
const LABELS = {
  pan: "PAN",
  gst_no: "GST no.",
  gst_registered: "GST registration",
  ifsc_code: "IFSC code",
  phone_no: "Phone no.",
  bank_accounts: "Bank accounts",
};

const label = (attribute) =>
  LABELS[attribute] ?? attribute.replace(/_/g, " ");

// "bank_accounts[0].account_number" -> "Bank 1 account number"
function humanize(key) {
  const nested = key.match(/^bank_accounts\[(\d+)\]\.(.+)$/);
  if (nested) {
    return `Bank ${Number(nested[1]) + 1} ${label(nested[2])}`;
  }

  return label(key).replace(/^./, (character) => character.toUpperCase());
}
