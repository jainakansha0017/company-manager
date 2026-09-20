import React, { useEffect, useState } from "react";
import { listParties, listSaudas } from "../lib/api";
import Combobox from "./Combobox";
import SaudaList from "./SaudaList";

// The sauda register starts from a seller: pick one (or create one on the spot)
// and the register for that seller opens below.
export default function SaudaRegister({
  company,
  companyId,
  sellerId,
  sellerJustAdded,
  saudaSaved,
  onNavigate,
}) {
  const [sellers, setSellers] = useState([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(sellerId ?? null);

  const [saudas, setSaudas] = useState([]);
  const [loadingSaudas, setLoadingSaudas] = useState(false);

  useEffect(() => {
    let current = true;
    setLoadingSellers(true);

    listParties("seller", companyId)
      .then((records) => {
        if (!current) return;
        setSellers(records);
        setError(null);
      })
      .catch(() => {
        if (current) setError("Could not load sellers for this company.");
      })
      .finally(() => {
        if (current) setLoadingSellers(false);
      });

    return () => {
      current = false;
    };
  }, [companyId]);

  // Arriving back from "add new" with ?seller_id=… preselects what was created.
  useEffect(() => {
    setSelectedId(sellerId ?? null);
  }, [sellerId]);

  useEffect(() => {
    if (!selectedId) {
      setSaudas([]);
      return undefined;
    }

    let current = true;
    setLoadingSaudas(true);

    listSaudas(companyId, selectedId)
      .then((records) => {
        if (!current) return;
        setSaudas(records);
        setError(null);
      })
      .catch(() => {
        if (current) setError("Could not load the sauda register for this seller.");
      })
      .finally(() => {
        if (current) setLoadingSaudas(false);
      });

    return () => {
      current = false;
    };
  }, [companyId, selectedId]);

  const addNewSeller = (name) => {
    const params = new URLSearchParams({
      company_id: companyId,
      return: `/companies/${companyId}/sauda-register`,
    });
    if (name) params.set("name", name);

    onNavigate(`/sellers/new?${params}`);
  };

  const addNewSauda = () =>
    onNavigate(`/companies/${companyId}/sauda-register/new?seller_id=${selectedId}`);

  const selected = sellers.find((seller) => String(seller.id) === String(selectedId)) ?? null;
  // Both flashes are driven by the query string, so they only belong to the
  // seller we were sent back with.
  const cameBackWith = selected && String(sellerId) === String(selected.id);
  const justAdded = sellerJustAdded && cameBackWith;
  const justSaved = saudaSaved && cameBackWith;

  return (
    <div className="card panel" role="tabpanel">
      <div className="panel__header">
        <h2>Sauda Register</h2>
        {selected && (
          <button type="button" className="button button--primary" onClick={addNewSauda}>
            Add New Sauda
          </button>
        )}
      </div>

      {error && <p className="alert alert--error">{error}</p>}
      {justAdded && (
        <p className="alert alert--success">{selected.name} was added and selected.</p>
      )}
      {justSaved && <p className="alert alert--success">Sauda saved.</p>}

      <Combobox
        label="Seller"
        options={sellers}
        value={selectedId}
        loading={loadingSellers}
        onSelect={(seller) => setSelectedId(seller ? seller.id : null)}
        onAddNew={addNewSeller}
        addNewLabel="Add new seller"
        placeholder="Type a seller name…"
        emptyMessage={`No sellers for ${company.name} yet.`}
      />

      {selected ? (
        <SaudaList saudas={saudas} loading={loadingSaudas} sellerName={selected.name} />
      ) : (
        <p className="muted">
          Pick a seller to see their saudas. Not in the list? Type the name and choose “Add
          new seller”.
        </p>
      )}
    </div>
  );
}
