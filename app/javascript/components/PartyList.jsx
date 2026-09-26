import React, { useState } from "react";

// One seller's marks: whatever is on record already, plus a small form —
// shown on demand rather than always open, since most rows are just being
// scanned rather than added to — for putting another one on record without
// leaving the seller list for the sauda form.
function SellerMarks({ sellerId, marks, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Which mark's own "×" was clicked — a mark still on a sauda is refused by
  // the server, and only that mark's button should say so while it waits.
  const [deletingId, setDeletingId] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      await onAdd(sellerId, trimmed);
      setName("");
      setAdding(false);
      setError(null);
    } catch {
      setError("Could not add that mark.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (mark) => {
    setDeletingId(mark.id);
    // Errors (e.g. "still used on a sauda") are surfaced by the page above,
    // which knows what to say about them — this only tracks its own spinner.
    await onDelete(mark);
    setDeletingId(null);
  };

  return (
    <div className="mark-cell">
      {marks.length > 0 ? (
        <ul className="mark-tags">
          {marks.map((mark) => (
            <li key={mark.id} className="mark-tag">
              {mark.name}
              <button
                type="button"
                className="mark-tag__remove"
                aria-label={`Delete mark ${mark.name}`}
                disabled={deletingId === mark.id}
                onClick={() => remove(mark)}
              >
                {deletingId === mark.id ? "…" : "×"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted mark-cell__empty">No marks yet.</p>
      )}

      {adding ? (
        <form className="mark-add" onSubmit={submit}>
          <input
            type="text"
            autoFocus
            value={name}
            placeholder="New mark"
            disabled={saving}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="button button--small" disabled={saving}>
            {saving ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            className="mark-add-toggle"
            disabled={saving}
            onClick={() => {
              setAdding(false);
              setName("");
              setError(null);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className="mark-add-toggle" onClick={() => setAdding(true)}>
          + Add mark
        </button>
      )}

      {error && <p className="field__error">{error}</p>}
    </div>
  );
}

export default function PartyList({
  parties,
  loading,
  roleLabel,
  onEdit,
  onDelete,
  deletingId,
  showMarks = false,
  marksBySeller = {},
  onAddMark,
  onDeleteMark,
}) {
  if (loading) return <p className="muted">Loading {roleLabel.toLowerCase()}s…</p>;

  if (parties.length === 0) {
    return (
      <p className="muted">
        No {roleLabel.toLowerCase()}s yet. Use “Add New {roleLabel}” to create the
        first one.
      </p>
    );
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Phone</th>
          <th>PAN</th>
          <th>GST</th>
          <th>Banks</th>
          {showMarks && <th>Marks</th>}
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {parties.map((party) => (
          <tr key={party.id}>
            <td>{party.name}</td>
            <td>{party.email}</td>
            <td>{party.phone_no}</td>
            <td>{party.pan || "—"}</td>
            <td>{party.gst_registered ? party.gst_no : "Not registered"}</td>
            <td>{party.bank_accounts.map((account) => account.bank_name).join(", ")}</td>
            {showMarks && (
              <td>
                <SellerMarks
                  sellerId={party.id}
                  marks={marksBySeller[party.id] ?? []}
                  onAdd={onAddMark}
                  onDelete={onDeleteMark}
                />
              </td>
            )}
            <td className="table__actions">
              <button
                type="button"
                className="button button--small"
                onClick={() => onEdit(party)}
              >
                Edit
              </button>
              <button
                type="button"
                className="button button--small button--danger"
                onClick={() => onDelete(party)}
                disabled={deletingId === party.id}
              >
                {deletingId === party.id ? "Deleting…" : "Delete"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
