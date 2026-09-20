import React from "react";

export default function CompanyList({ companies, loading, onEdit, onDelete, deletingId }) {
  if (loading) return <p className="muted">Loading companies…</p>;

  if (companies.length === 0) {
    return (
      <p className="muted">
        No companies yet. Use “Add New Company” to create the first one.
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
          <th>Financial year</th>
          <th>Banks</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {companies.map((company) => (
          <tr key={company.id}>
            <td>{company.name}</td>
            <td>{company.email}</td>
            <td>{company.phone_no}</td>
            <td>{company.pan || "—"}</td>
            <td>{company.gst_registered ? company.gst_no : "Not registered"}</td>
            <td>{company.financial_year}</td>
            <td>
              {company.bank_accounts
                .map((account) => account.bank_name)
                .join(", ")}
            </td>
            <td className="table__actions">
              <button
                type="button"
                className="button button--small"
                onClick={() => onEdit(company)}
              >
                Edit
              </button>
              <button
                type="button"
                className="button button--small button--danger"
                onClick={() => onDelete(company)}
                disabled={deletingId === company.id}
              >
                {deletingId === company.id ? "Deleting…" : "Delete"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
