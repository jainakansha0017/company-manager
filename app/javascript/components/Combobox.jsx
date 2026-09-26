import React, { useEffect, useId, useRef, useState } from "react";

// A text input you can type into that filters a list of options, plus an
// optional "Add new" row that shows up whenever what you typed is not already
// one of the options.
export default function Combobox({
  label,
  options,
  value,
  onSelect,
  onAddNew,
  addNewLabel = "Add new",
  placeholder = "Type to search…",
  loading = false,
  disabled = false,
  emptyMessage = "No matches.",
}) {
  const id = useId();
  const listId = `${id}-listbox`;

  const selected = options.find((option) => String(option.id) === String(value)) ?? null;

  const [query, setQuery] = useState(selected ? selected.name : "");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);

  // Keep the input text in step when the selection is changed from outside,
  // e.g. after coming back from the "add new" page, or a sibling field
  // resetting this one's value (changing the seller clears the mark). Skipped
  // while the input has focus so it doesn't stomp on what's being typed —
  // typing over a selection clears it via onChange below instead.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setQuery(selected ? selected.name : "");
  }, [selected?.id]);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? options.filter((option) => option.name.toLowerCase().includes(needle))
    : options;
  const exactMatch = options.some((option) => option.name.trim().toLowerCase() === needle);

  // The whole point of the add-new row: it appears when what you typed is not
  // an existing option.
  const canAddNew = Boolean(onAddNew) && !exactMatch;
  const rows = [
    ...matches.map((option) => ({ kind: "option", option })),
    ...(canAddNew ? [{ kind: "add" }] : []),
  ];

  const show = (next) => {
    setOpen(next);
    if (next) setHighlight(0);
  };

  const commit = (row) => {
    if (!row) return;

    if (row.kind === "add") {
      setOpen(false);
      onAddNew(query.trim());
      return;
    }

    setQuery(row.option.name);
    setOpen(false);
    onSelect(row.option);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        show(true);
        return;
      }
      if (rows.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((current) => (current + step + rows.length) % rows.length);
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      commit(rows[highlight]);
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setQuery(selected ? selected.name : "");
      return;
    }

    if (event.key === "Tab") setOpen(false);
  };

  // Clears whatever is picked and reopens the list on the full set of
  // options, so a preselected value can be swapped for another without
  // first typing over it to clear it.
  const clear = () => {
    onSelect(null);
    setQuery("");
    setHighlight(0);
    inputRef.current?.focus();
    show(true);
  };

  return (
    <div className="combobox">
      {label && <label htmlFor={id}>{label}</label>}

      <div className={`combobox__control${selected ? " combobox__control--clearable" : ""}`}>
        <input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && rows[highlight] ? `${id}-row-${highlight}` : undefined}
          placeholder={loading ? "Loading…" : placeholder}
          disabled={disabled || loading}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
            setOpen(true);
            // Typing over a selection clears it until something is picked again.
            if (selected && event.target.value !== selected.name) onSelect(null);
          }}
          onFocus={() => show(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setOpen(false);
            setQuery(selected ? selected.name : "");
          }}
        />

        {selected && !disabled && !loading && (
          <button
            type="button"
            className="combobox__clear"
            aria-label={label ? `Clear ${label.toLowerCase()}` : "Clear"}
            // Keep focus in the input rather than letting the button steal
            // it and fire the input's own onBlur first.
            onMouseDown={(event) => event.preventDefault()}
            onClick={clear}
          >
            ×
          </button>
        )}

        {open && (
          <ul className="combobox__list" id={listId} role="listbox">
            {rows.map((row, index) => (
              <li
                key={row.kind === "add" ? "add-new" : row.option.id}
                id={`${id}-row-${index}`}
                role="option"
                aria-selected={index === highlight}
                className={`combobox__option${
                  index === highlight ? " combobox__option--active" : ""
                }${row.kind === "add" ? " combobox__option--add" : ""}`}
                // Keep focus in the input so the list is not torn down before
                // the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => commit(row)}
              >
                {row.kind === "add"
                  ? query.trim()
                    ? `+ ${addNewLabel} “${query.trim()}”`
                    : `+ ${addNewLabel}`
                  : row.option.name}
              </li>
            ))}

            {rows.length === 0 && <li className="combobox__empty">{emptyMessage}</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
