import React, { useEffect, useMemo, useState } from "react";
import { deleteSauda, listParties, listSaudas, saudaRegisterUrl } from "../lib/api";
import Combobox from "./Combobox";
import SaudaList from "./SaudaList";

// What the year dropdown means when nothing is being narrowed to.
const ALL_YEARS = "";

// Years are matched on the four digits they start with, which is all that says
// which financial year something falls in.
const startYear = (year) => String(year ?? "").slice(0, 4);

// India's financial year runs 1 April to 31 March, so January to March still
// belong to the year that started the previous April. Only the April boundary
// is read here; the labels themselves are written by the server.
const currentStartYear = () => {
  const today = new Date();
  return String(today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear());
};

// The sauda register starts from a seller: pick one (or create one on the spot)
// and the register for that seller opens below.
export default function SaudaRegister({
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
  const [year, setYear] = useState(ALL_YEARS);

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

    listSaudas(selectedId)
      .then((records) => {
        if (!current) return;
        setSaudas(records);
        // Open on the financial year we are in when the seller has saudas in it,
        // and on everything when they do not, so the register never opens empty
        // on a year nothing was traded in.
        const thisYear = records.find(
          (sauda) => startYear(sauda.financial_year) === currentStartYear(),
        );
        setYear(thisYear ? thisYear.financial_year : ALL_YEARS);
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
  }, [selectedId]);

  const addNewSeller = (name) => {
    const params = new URLSearchParams({ return: "/sauda" });
    if (name) params.set("name", name);

    onNavigate(`/sellers/new?${params}`);
  };

  // A download leaves the page where it is, so the menu has to be shut by hand.
  const closeDropdown = (event) => {
    event.currentTarget.closest("details").open = false;
  };

  // The new-sauda form picks its own seller from a dropdown rather than
  // inheriting whichever one is selected here, so nothing is passed along.
  const addNewSauda = () => onNavigate("/sauda/new");

  const editSauda = (sauda) =>
    onNavigate(`/sauda/edit?seller_id=${selectedId}&sauda_id=${sauda.id}`);

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

  // Only the years this seller has saudas in, newest first. Deleting the last
  // sauda of a year takes that year off the list, so what is chosen is read
  // back through it rather than trusted on its own.
  const years = useMemo(
    () => [...new Set(saudas.map((sauda) => sauda.financial_year))].sort().reverse(),
    [saudas],
  );
  const activeYear = years.includes(year) ? year : ALL_YEARS;
  const visible = useMemo(
    () =>
      activeYear === ALL_YEARS
        ? saudas
        : saudas.filter((sauda) => sauda.financial_year === activeYear),
    [saudas, activeYear],
  );

  // Both flashes are driven by the query string, so they only belong to the
  // seller we were sent back with.
  const cameBackWith = selected && String(sellerId) === String(selected.id);
  const justAdded = sellerJustAdded && cameBackWith;
  const justSaved = saudaSaved && cameBackWith;

  return (
    <div className="card panel" role="tabpanel">
      <div className="panel__header">
        <h2>Sauda Register</h2>
        <div className="panel__actions">
          {/* A native disclosure rather than a menu built from state: the open
              and closed of it, and the keyboard, are the browser's job. Only
              worth offering once there is a seller (and so a register) to
              export. */}
          {selected && (
            <details className="dropdown">
              <summary className="button">Export</summary>
              <ul className="dropdown__menu" onClick={closeDropdown}>
                <li>
                  <a
                    className="dropdown__item"
                    href={saudaRegisterUrl(selectedId, "pdf", activeYear)}
                    download
                  >
                    PDF
                  </a>
                </li>
                <li>
                  <a
                    className="dropdown__item"
                    href={saudaRegisterUrl(selectedId, "xlsx", activeYear)}
                    download
                  >
                    Excel
                  </a>
                </li>
              </ul>
            </details>
          )}

          {/* Always available: the new-sauda form picks its own seller from a
              dropdown rather than requiring one to already be selected here. */}
          <button type="button" className="button button--primary" onClick={addNewSauda}>
            New Sauda
          </button>
        </div>
      </div>

      {error && <p className="alert alert--error">{error}</p>}
      {justAdded && (
        <p className="alert alert--success">{selected.name} was added and selected.</p>
      )}
      {justSaved && <p className="alert alert--success">Sauda saved.</p>}

      <div className="filters">
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

        {/* Only the years the seller has traded in are worth offering. */}
        {selected && years.length > 0 && (
          <div className="field">
            <label htmlFor="register-year">Financial year</label>
            <select
              id="register-year"
              value={activeYear}
              onChange={(event) => setYear(event.target.value)}
            >
              {years.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
              <option value={ALL_YEARS}>All years</option>
            </select>
          </div>
        )}
      </div>

      {selected ? (
        <SaudaList
          saudas={visible}
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
