const csrfToken = () =>
  document.querySelector('meta[name="csrf-token"]')?.content || "";

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-CSRF-Token": csrfToken(),
      ...options.headers,
    },
  });

  const body = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    const error = new Error("Request failed");
    error.status = response.status;
    error.errors = body?.errors || {};
    throw error;
  }

  return body;
}

export const listCompanies = () => request("/api/v1/companies");

export const createCompany = (company) =>
  request("/api/v1/companies", {
    method: "POST",
    body: JSON.stringify({ company }),
  });

export const updateCompany = (id, company) =>
  request(`/api/v1/companies/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ company }),
  });

export const deleteCompany = (id) =>
  request(`/api/v1/companies/${id}`, { method: "DELETE" });

// Buyers and sellers share one API shape; `role` is "buyer" or "seller".
export const listParties = (role, companyId) =>
  request(`/api/v1/${role}s?company_id=${encodeURIComponent(companyId)}`);

export const createParty = (role, party) =>
  request(`/api/v1/${role}s`, {
    method: "POST",
    body: JSON.stringify({ [role]: party }),
  });

export const updateParty = (role, id, party) =>
  request(`/api/v1/${role}s/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ [role]: party }),
  });

export const deleteParty = (role, id) =>
  request(`/api/v1/${role}s/${id}`, { method: "DELETE" });

// The sauda register is always read one seller at a time.
export const listSaudas = (companyId, sellerId) =>
  request(
    `/api/v1/saudas?company_id=${encodeURIComponent(companyId)}` +
      `&seller_id=${encodeURIComponent(sellerId)}`,
  );

export const createSauda = (sauda) =>
  request("/api/v1/saudas", { method: "POST", body: JSON.stringify({ sauda }) });

// Marks belong to a seller, and can be created from the sauda form itself.
export const listMarks = (sellerId) =>
  request(`/api/v1/marks?seller_id=${encodeURIComponent(sellerId)}`);

export const createMark = (sellerId, name) =>
  request("/api/v1/marks", {
    method: "POST",
    body: JSON.stringify({ mark: { seller_id: sellerId, name } }),
  });
