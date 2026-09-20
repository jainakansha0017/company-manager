import React from "react";

const ACCOUNT_TYPES = ["Savings", "Current", "OD", "CC"];

export default function BankAccountFields({
  index,
  account,
  errors,
  onChange,
  onRemove,
}) {
  const handle = (field) => (event) => onChange(index, field, event.target.value);
  const errorFor = (field) => errors[`bank_accounts[${index}].${field}`]?.[0];

  return (
    <div className="bank-account">
      <div className="bank-account__header">
        <h3>Bank {index + 1}</h3>
        {onRemove && (
          <button
            type="button"
            className="button button--link"
            onClick={() => onRemove(index)}
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid">
        <div className="field">
          <label htmlFor={`bank_name_${index}`}>
            Bank name<span className="field__required"> *</span>
          </label>
          <input
            id={`bank_name_${index}`}
            value={account.bank_name}
            onChange={handle("bank_name")}
          />
          {errorFor("bank_name") && (
            <p className="field__error">{errorFor("bank_name")}</p>
          )}
        </div>

        <div className="field">
          <label htmlFor={`account_number_${index}`}>
            Account number<span className="field__required"> *</span>
          </label>
          <input
            id={`account_number_${index}`}
            value={account.account_number}
            onChange={handle("account_number")}
            inputMode="numeric"
          />
          {errorFor("account_number") && (
            <p className="field__error">{errorFor("account_number")}</p>
          )}
        </div>

        <div className="field">
          <label htmlFor={`ifsc_code_${index}`}>IFSC code</label>
          <input
            id={`ifsc_code_${index}`}
            value={account.ifsc_code}
            onChange={handle("ifsc_code")}
            placeholder="HDFC0001234"
            maxLength={11}
          />
          {errorFor("ifsc_code") && (
            <p className="field__error">{errorFor("ifsc_code")}</p>
          )}
        </div>

        <div className="field">
          <label htmlFor={`branch_${index}`}>Branch</label>
          <input
            id={`branch_${index}`}
            value={account.branch}
            onChange={handle("branch")}
          />
        </div>

        <div className="field">
          <label htmlFor={`account_type_${index}`}>Account type</label>
          <select
            id={`account_type_${index}`}
            value={account.account_type}
            onChange={handle("account_type")}
          >
            <option value="">Select…</option>
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errorFor("account_type") && (
            <p className="field__error">{errorFor("account_type")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
