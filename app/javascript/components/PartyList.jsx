import React from "react";

export default function PartyList({ parties, loading, roleLabel, onEdit, onDelete, deletingId }) {
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
