import React, { useState } from "react";
import { createCompany, deleteCompany, updateCompany } from "../lib/api";
import CompanyList from "./CompanyList";
import EntityForm from "./EntityForm";

export default function CompaniesPage({ companies, loading, error, onChanged }) {
  // null = list view, "new" = blank form, otherwise the company being edited.
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [actionError, setActionError] = useState(null);

  const handleSubmit = (payload) =>
    editing === "new" ? createCompany(payload) : updateCompany(editing.id, payload);

  const handleSaved = (company) => {
    onChanged(
      companies.some((entry) => entry.id === company.id)
        ? companies.map((entry) => (entry.id === company.id ? company : entry))
        : [company, ...companies],
    );
    setFlash(`${company.name} was ${editing === "new" ? "added" : "updated"}.`);
    setEditing(null);
  };

  const handleDelete = async (company) => {
    if (!window.confirm(`Delete ${company.name} and all of its bank accounts?`)) return;

    setDeletingId(company.id);
    setFlash(null);
    setActionError(null);

    try {
      await deleteCompany(company.id);
      onChanged(companies.filter((entry) => entry.id !== company.id));
      setFlash(`${company.name} was deleted.`);
    } catch {
      setActionError(`Could not delete ${company.name}. Please try again.`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <header className="page__header">
        <h1>Manage companies</h1>
        {!editing && (
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              setFlash(null);
              setEditing("new");
            }}
          >
            Add New Company
          </button>
        )}
      </header>

      {flash && <p className="alert alert--success">{flash}</p>}
      {(error || actionError) && (
        <p className="alert alert--error">{error || actionError}</p>
      )}

      {editing ? (
        <EntityForm
          key={editing === "new" ? "new" : editing.id}
          heading={editing === "new" ? "New Company" : `Edit ${editing.name}`}
          entity={editing === "new" ? null : editing}
          includeFinancialYear
          onSubmit={handleSubmit}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <CompanyList
          companies={companies}
          loading={loading}
          onEdit={(company) => {
            setFlash(null);
            setEditing(company);
          }}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      )}
    </>
  );
}
