import React, { useCallback, useEffect, useState } from "react";
import { createParty, deleteParty, listParties, updateParty } from "../lib/api";
import EntityForm from "./EntityForm";
import PartyList from "./PartyList";

// Drives both the Buyer and Seller pages; `role` is "buyer" or "seller".
// `/sellers/new` opens straight on the form, and `returnTo` sends the user back
// where they came from (e.g. the sauda register) with the new record selected.
export default function PartyPage({
  role,
  companies,
  companiesLoading,
  startNew = false,
  initialCompanyId = "",
  prefillName = "",
  returnTo = null,
  onNavigate,
}) {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(startNew ? "new" : null);
  const [deletingId, setDeletingId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState(null);

  // Preselect when there is only one company to choose from.
  useEffect(() => {
    if (!companyId && companies.length === 1) setCompanyId(String(companies[0].id));
  }, [companies, companyId]);

  const loadParties = useCallback(async () => {
    if (!companyId) {
      setParties([]);
      return;
    }

    setLoading(true);
    try {
      setParties(await listParties(role, companyId));
      setError(null);
    } catch {
      setError(`Could not load ${roleLabel.toLowerCase()}s.`);
    } finally {
      setLoading(false);
    }
  }, [role, roleLabel, companyId]);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  const selectCompany = (event) => {
    setCompanyId(event.target.value);
    setEditing(null);
    setFlash(null);
    setError(null);
  };

  const handleSubmit = (payload) => {
    const body = { ...payload, company_id: Number(companyId) };
    return editing === "new"
      ? createParty(role, body)
      : updateParty(role, editing.id, body);
  };

  const handleSaved = (party) => {
    if (returnTo) {
      const url = new URL(returnTo, window.location.origin);
      url.searchParams.set(`${role}_id`, party.id);
      // Distinguishes "just created this" from merely being preselected.
      url.searchParams.set("added", "1");
      onNavigate(`${url.pathname}${url.search}`);
      return;
    }

    setParties((current) => {
      const next = current.some((entry) => entry.id === party.id)
        ? current.map((entry) => (entry.id === party.id ? party : entry))
        : [...current, party];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
    setFlash(`${party.name} was ${editing === "new" ? "added" : "updated"}.`);
    setEditing(null);
  };

  const handleDelete = async (party) => {
    if (!window.confirm(`Delete ${party.name} and all of its bank accounts?`)) return;

    setDeletingId(party.id);
    setFlash(null);
    setError(null);

    try {
      await deleteParty(role, party.id);
      setParties((current) => current.filter((entry) => entry.id !== party.id));
      setFlash(`${party.name} was deleted.`);
    } catch {
      setError(`Could not delete ${party.name}. Please try again.`);
    } finally {
      setDeletingId(null);
    }
  };

  const selectedCompany = companies.find((company) => String(company.id) === companyId);

  return (
    <>
      <header className="page__header">
        <h1>{roleLabel}s</h1>
        {companyId && !editing && (
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              setFlash(null);
              setEditing("new");
            }}
          >
            Add New {roleLabel}
          </button>
        )}
      </header>

      <div className="field field--inline">
        <label htmlFor="company_selector">Company</label>
        <select id="company_selector" value={companyId} onChange={selectCompany}>
          <option value="">
            {companiesLoading ? "Loading companies…" : "Select a company…"}
          </option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>

      {flash && <p className="alert alert--success">{flash}</p>}
      {error && <p className="alert alert--error">{error}</p>}

      {!companyId && !companiesLoading && companies.length === 0 && (
        <p className="muted">
          Add a company first — {roleLabel.toLowerCase()}s belong to a company.
        </p>
      )}

      {!companyId && companies.length > 0 && (
        <p className="muted">
          Select a company to see its {roleLabel.toLowerCase()}s.
        </p>
      )}

      {companyId &&
        (editing ? (
          <EntityForm
            key={editing === "new" ? "new" : editing.id}
            heading={
              editing === "new"
                ? `New ${roleLabel} for ${selectedCompany?.name ?? "company"}`
                : `Edit ${editing.name}`
            }
            entity={editing === "new" ? null : editing}
            prefill={editing === "new" && prefillName ? { name: prefillName } : null}
            includeBrokerage={role === "seller"}
            onSubmit={handleSubmit}
            onSaved={handleSaved}
            onCancel={() => (returnTo ? onNavigate(returnTo) : setEditing(null))}
          />
        ) : (
          <PartyList
            parties={parties}
            loading={loading}
            roleLabel={roleLabel}
            onEdit={(party) => {
              setFlash(null);
              setEditing(party);
            }}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        ))}
    </>
  );
}
