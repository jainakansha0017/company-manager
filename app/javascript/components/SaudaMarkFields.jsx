import React from "react";
import Combobox from "./Combobox";

// "A; B ;;C" -> ["A", "B", "C"]
export const splitList = (text) =>
  text
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);

export const bags = (grade) => Number(grade.bags) || 0;

export const kilos = (grade) => bags(grade) * (Number(grade.weight) || 0);

// What a grade comes to: its kilos at its rate per kilo. Null when unpriced, so
// an unpriced grade reads as a dash rather than as nothing owed.
export const gradeAmount = (grade) => {
  if (grade.rate === "" || grade.rate == null) return null;

  return Math.round((kilos(grade) * Number(grade.rate) + Number.EPSILON) * 100) / 100;
};

export const formatKg = (value) =>
  value.toLocaleString("en-IN", { maximumFractionDigits: 3 });

export const formatMoney = (value) =>
  value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// One mark on the sauda: which mark, its lot numbers, and a row per grade.
export default function SaudaMarkFields({
  index,
  line,
  marks,
  marksLoading,
  marksEmptyMessage = "No marks for this seller yet.",
  onChange,
  onRemove,
  onSelectMark,
  onCreateMark,
  errorFor,
}) {
  const update = (patch) => onChange(index, patch);

  // Re-deriving the grade rows keeps whatever bags/weight were already typed
  // for a grade that is still in the list.
  const setGradeText = (text) =>
    update({
      gradeText: text,
      grades: splitList(text).map((grade) => {
        const existing = line.grades.find(
          (entry) => entry.grade.toLowerCase() === grade.toLowerCase(),
        );
        return {
          grade,
          bags: existing?.bags ?? "",
          weight: existing?.weight ?? "",
          rate: existing?.rate ?? "",
        };
      }),
    });

  const setGrade = (gradeIndex, field, value) =>
    update({
      grades: line.grades.map((grade, i) =>
        i === gradeIndex ? { ...grade, [field]: value } : grade,
      ),
    });

  const subtotalBags = line.grades.reduce((sum, grade) => sum + bags(grade), 0);
  const subtotal = line.grades.reduce((sum, grade) => sum + kilos(grade), 0);

  const pricedAmounts = line.grades.map(gradeAmount).filter((value) => value !== null);
  const subtotalAmount = pricedAmounts.length
    ? pricedAmounts.reduce((sum, value) => sum + value, 0)
    : null;

  return (
    <div className="sauda-mark">
      <div className="sauda-mark__header">
        <h3>Mark {index + 1}</h3>
        {onRemove && (
          <button type="button" className="button button--small" onClick={() => onRemove(index)}>
            Remove mark
          </button>
        )}
      </div>

      <div className="grid">
        <Combobox
          label="Mark"
          options={marks}
          value={line.markId}
          loading={marksLoading}
          onSelect={(mark) => onSelectMark(index, mark)}
          onAddNew={onCreateMark ? (name) => onCreateMark(index, name) : undefined}
          addNewLabel="Add new mark"
          placeholder="Type a mark…"
          emptyMessage={marksEmptyMessage}
        />

        <div className="field">
          <label htmlFor={`lot_nos_${index}`}>Lot no.</label>
          <input
            id={`lot_nos_${index}`}
            type="text"
            value={line.lotNos}
            placeholder="Separate with ;"
            onChange={(event) => update({ lotNos: event.target.value })}
          />
          <p className="field__hint">Many lots: L-1; L-2; L-3</p>
        </div>

        <div className="field">
          <label htmlFor={`grades_${index}`}>Grades</label>
          <input
            id={`grades_${index}`}
            type="text"
            value={line.gradeText}
            placeholder="Separate with ;"
            onChange={(event) => setGradeText(event.target.value)}
          />
          <p className="field__hint">Many grades: PD; BOP; FNGS</p>
        </div>
      </div>

      {errorFor(`sauda_marks[${index}].mark`) && (
        <p className="field__error">{errorFor(`sauda_marks[${index}].mark`)}</p>
      )}

      {line.grades.length === 0 ? (
        <p className="muted">Type the grades above to enter bags and weight for each.</p>
      ) : (
        <div className="table-scroll">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Grade</th>
                <th>Bags</th>
                <th>Weight per bag (kg)</th>
                <th className="numeric">Kg</th>
                <th>Rate per kg</th>
                <th className="numeric">Amount</th>
              </tr>
            </thead>
            <tbody>
              {line.grades.map((grade, gradeIndex) => (
                <tr key={grade.grade}>
                  <td>{grade.grade}</td>
                  <td>
                    <input
                      aria-label={`Bags for ${grade.grade}`}
                      type="number"
                      min="1"
                      step="1"
                      value={grade.bags}
                      onChange={(event) => setGrade(gradeIndex, "bags", event.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Weight per bag for ${grade.grade}`}
                      type="number"
                      min="0"
                      step="0.001"
                      value={grade.weight}
                      onChange={(event) => setGrade(gradeIndex, "weight", event.target.value)}
                    />
                  </td>
                  <td className="numeric">{formatKg(kilos(grade))}</td>
                  <td>
                    <input
                      aria-label={`Rate per kg for ${grade.grade}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={grade.rate ?? ""}
                      onChange={(event) => setGrade(gradeIndex, "rate", event.target.value)}
                    />
                  </td>
                  <td className="numeric">
                    {gradeAmount(grade) === null ? "—" : formatMoney(gradeAmount(grade))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Mark {index + 1} total</td>
                <td>{subtotalBags} bags</td>
                <td />
                <td className="numeric">{formatKg(subtotal)} kg</td>
                <td />
                <td className="numeric">
                  {subtotalAmount === null ? "—" : formatMoney(subtotalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
