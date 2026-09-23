import React from "react";
import SaudaRegister from "./SaudaRegister";
import SaudaForm from "./SaudaForm";

export const TABS = [
  { key: "sauda-register", label: "Sauda Register" },
  { key: "inventory", label: "Inventory" },
  { key: "accounts", label: "Accounts" },
];

export const DEFAULT_TAB = TABS[0].key;

// Everything you do inside one company. Inventory and Accounts are still
// placeholders until their features are specified.
export default function CompanyWorkspace({
  company,
  companyId,
  tab,
  action,
  sellerId,
  buyerId,
  saudaId,
  sellerJustAdded,
  saudaSaved,
  loading,
  onNavigate,
}) {
  if (loading) return <p className="muted">Loading…</p>;

  if (!company) {
    return (
      <>
        <p className="alert alert--error">That company no longer exists.</p>
        <a
          href="/"
          className="link"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("/");
          }}
        >
          ← Back to companies
        </a>
      </>
    );
  }

  const active = TABS.some((entry) => entry.key === tab) ? tab : DEFAULT_TAB;
  const activeLabel = TABS.find((entry) => entry.key === active).label;

  return (
    <>
      <header className="page__header">
        <div>
          <h1>{company.name}</h1>
          <p className="muted page__subtitle">
            Financial year {company.financial_year}
          </p>
        </div>
        <a
          href="/"
          className="link"
          onClick={(event) => {
            event.preventDefault();
            onNavigate("/");
          }}
        >
          Change company
        </a>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((entry) => (
          <a
            key={entry.key}
            role="tab"
            aria-selected={entry.key === active}
            href={`/companies/${companyId}/${entry.key}`}
            className={`tabs__tab${entry.key === active ? " tabs__tab--active" : ""}`}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(`/companies/${companyId}/${entry.key}`);
            }}
          >
            {entry.label}
          </a>
        ))}
      </div>

      {active === "sauda-register" && (action === "new" || action === "edit") ? (
        <SaudaForm
          key={saudaId ?? "new"}
          companyId={companyId}
          sellerId={sellerId}
          saudaId={action === "edit" ? saudaId : null}
          buyerId={buyerId}
          onNavigate={onNavigate}
        />
      ) : active === "sauda-register" ? (
        <SaudaRegister
          key={companyId}
          company={company}
          companyId={companyId}
          sellerId={sellerId}
          sellerJustAdded={sellerJustAdded}
          saudaSaved={saudaSaved}
          onNavigate={onNavigate}
        />
      ) : (
        <div className="card panel" role="tabpanel">
          <h2>{activeLabel}</h2>
          <p className="muted">
            {activeLabel} for {company.name} is not built yet.
          </p>
        </div>
      )}
    </>
  );
}
