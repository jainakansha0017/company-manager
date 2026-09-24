import React, { useEffect, useState } from "react";
import { deleteSauda, listParties, listSaudas, saudaRegisterUrl } from "../lib/api";
import Combobox from "./Combobox";
import SaudaList from "./SaudaList";

// The sauda register starts from a seller: pick one (or create one on the spot)
// and the register for that seller opens below.
export default function SaudaRegister({
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
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let current = true;
    setLoadingSellers(true);

    listParties("seller")
      .then((records) => {
        if (!current) return;
        setSellers(records);
        setError(null);
      })
      .catch(() => {
        if (current) setError("Could not load the seller list.");
      })
      .finally(() => {
        if (current) setLoadingSellers(false);
      });

    return () => {
      current = false;
    };
  }, []);

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
      return: `/companies/${companyId}/sauda-register`,
    });
    if (name) params.set("name", name);

    onNavigate(`/sellers/new?${params}`);
  };

  // A download leaves the page where it is, so the menu has to be shut by hand.
  const closeDropdown = (event) => {
    event.currentTarget.closest("details").open = false;
  };

  const addNewSauda = () =>
    onNavigate(`/companies/${companyId}/sauda-register/new?seller_id=${selectedId}`);

  const editSauda = (sauda) =>
    onNavigate(
      `/companies/${companyId}/sauda-register/edit?seller_id=${selectedId}&sauda_id=${sauda.id}`,
    );

  // A sauda takes its marks and grades down with it, so the confirmation names
  // the sauda rather than asking about "this row".
  const removeSauda = async (sauda) => {
    const label = sauda.sauda_no ? `sauda ${sauda.sauda_no}` : "this sauda";
    if (!window.confirm(`Delete ${label} for ${sauda.buyer_name}? This cannot be undone.`)) {
      return;
    }

    setDeletingId(sauda.id);
    try {
      await deleteSauda(sauda.id);
      setSaudas((records) => records.filter((record) => record.id !== sauda.id));
      setError(null);
    } catch {
      setError("Could not delete that sauda.");
    } finally {
      setDeletingId(null);
    }
  };

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
          <div className="panel__actions">
            {/* A native disclosure rather than a menu built from state: the open
                and closed of it, and the keyboard, are the browser's job. */}
            <details className="dropdown">
              <summary className="button">Export</summary>
              <ul className="dropdown__menu" onClick={closeDropdown}>
                <li>
                  <a
                    className="dropdown__item"
                    href={saudaRegisterUrl(companyId, selectedId, "pdf")}
                    download
                  >
                    PDF
                  </a>
                </li>
                <li>
                  <a
                    className="dropdown__item"
                    href={saudaRegisterUrl(companyId, selectedId, "xlsx")}
                    download
                  >
                    Excel
                  </a>
                </li>
              </ul>
            </details>

            <button type="button" className="button button--primary" onClick={addNewSauda}>
              Add New Sauda
            </button>
          </div>
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
        emptyMessage="No sellers on record yet."
      />

      {selected ? (
        <SaudaList
          saudas={saudas}
          loading={loadingSaudas}
          sellerName={selected.name}
          onEdit={editSauda}
          onDelete={removeSauda}
          deletingId={deletingId}
        />
      ) : (
        <p className="muted">
          Pick a seller to see their saudas. Not in the list? Type the name and choose “Add
          new seller”.
        </p>
      )}
    </div>
  );
}
