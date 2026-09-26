import React, { useCallback, useEffect, useState } from "react";
import {
  createMark,
  createParty,
  deleteMark,
  deleteParty,
  listMarks,
  listParties,
  updateParty,
} from "../lib/api";
import EntityForm from "./EntityForm";
import PartyList from "./PartyList";

// Drives both the Buyer and Seller pages; `role` is "buyer" or "seller".
// These are master data — one list each, not one per company.
// `/sellers/new` opens straight on the form, and `returnTo` sends the user back
// where they came from (e.g. the sauda register) with the new record selected.
export default function PartyPage({
  role,
  startNew = false,
  prefillName = "",
  returnTo = null,
  onNavigate,
}) {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(startNew ? "new" : null);
  const [deletingId, setDeletingId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState(null);

  const loadParties = useCallback(async () => {
    setLoading(true);
    try {
      setParties(await listParties(role));
      setError(null);
    } catch {
      setError(`Could not load ${roleLabel.toLowerCase()}s.`);
    } finally {
      setLoading(false);
    }
  }, [role, roleLabel]);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  // Marks belong to sellers, so they only come into it on the seller page —
  // grouped by seller here rather than fetched one seller at a time, since
  // the whole list is on screen at once anyway.
  const isSellerPage = role === "seller";
  const [marksBySeller, setMarksBySeller] = useState({});
  const [markError, setMarkError] = useState(null);

  const loadMarks = useCallback(async () => {
    if (!isSellerPage) return;

    try {
      const records = await listMarks();
      const grouped = {};
      records.forEach((mark) => {
        (grouped[mark.seller_id] ??= []).push(mark);
      });
      setMarksBySeller(grouped);
      setMarkError(null);
    } catch {
      setMarkError("Could not load marks.");
    }
  }, [isSellerPage]);

  useEffect(() => {
    loadMarks();
  }, [loadMarks]);

  const handleAddMark = async (sellerId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const mark = await createMark(sellerId, trimmed);
    setMarksBySeller((current) => ({
      ...current,
      [sellerId]: [...(current[sellerId] ?? []), mark].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    }));
    setMarkError(null);
  };

  // The server refuses this while a sauda still uses the mark, so that
  // sauda's history keeps naming what it actually shipped under — the error
  // it gives back is shown as-is rather than replaced with something vaguer.
  const handleDeleteMark = async (mark) => {
    if (!window.confirm(`Delete mark "${mark.name}"? This cannot be undone.`)) return;

    try {
      await deleteMark(mark.id);
      setMarksBySeller((current) => ({
        ...current,
        [mark.seller_id]: (current[mark.seller_id] ?? []).filter(
          (entry) => entry.id !== mark.id,
        ),
      }));
      setMarkError(null);
    } catch (failure) {
      setMarkError(failure.errors?.base?.[0] || `Could not delete mark "${mark.name}".`);
    }
  };

  const handleSubmit = (payload) =>
    editing === "new"
      ? createParty(role, payload)
      : updateParty(role, editing.id, payload);

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

  return (
    <>
      <header className="page__header">
        <h1>{roleLabel}s</h1>
        {!editing && (
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

      {flash && <p className="alert alert--success">{flash}</p>}
      {error && <p className="alert alert--error">{error}</p>}
      {markError && <p className="alert alert--error">{markError}</p>}

      {editing ? (
        <EntityForm
          key={editing === "new" ? "new" : editing.id}
          heading={editing === "new" ? `New ${roleLabel}` : `Edit ${editing.name}`}
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
          showMarks={isSellerPage}
          marksBySeller={marksBySeller}
          onAddMark={handleAddMark}
          onDeleteMark={handleDeleteMark}
        />
      )}
    </>
  );
}
