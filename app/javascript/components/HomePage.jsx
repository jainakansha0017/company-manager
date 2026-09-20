import React, { useState } from "react";
import { createCompany } from "../lib/api";
import EntityForm from "./EntityForm";

// Landing page: pick a company to work in, or add a new one.
export default function HomePage({ companies, loading, error, onChanged, onNavigate }) {
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState(null);

  const handleSelect = (event) => {
    const { value } = event.target;
    if (value) onNavigate(`/companies/${value}`);
  };

  const handleSaved = (company) => {
    onChanged([company, ...companies]);
    setFlash(`${company.name} was added.`);
    setAdding(false);
  };

  if (adding) {
    return (
      <>
        <header className="page__header">
          <h1>New Company</h1>
        </header>
        <EntityForm
          heading="New Company"
          includeFinancialYear
          onSubmit={createCompany}
          onSaved={handleSaved}
          onCancel={() => setAdding(false)}
        />
      </>
    );
  }

  return (
    <>
      <header className="page__header">
        <h1>Companies</h1>
      </header>

      {flash && <p className="alert alert--success">{flash}</p>}
      {error && <p className="alert alert--error">{error}</p>}

      <div className="card card--narrow">
        <div className="field">
          <label htmlFor="company_selector">Select a company</label>
          <select id="company_selector" defaultValue="" onChange={handleSelect}>
            <option value="">
              {loading ? "Loading companies…" : "Select a company…"}
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        {!loading && companies.length === 0 && (
          <p className="muted">No companies yet. Add the first one to get started.</p>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              setFlash(null);
              setAdding(true);
            }}
          >
            + Add New Company
          </button>
          <a
            href="/companies"
            className="link"
            onClick={(event) => {
              event.preventDefault();
              onNavigate("/companies");
            }}
          >
            Manage companies
          </a>
        </div>
      </div>
    </>
  );
}
