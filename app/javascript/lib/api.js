const csrfMeta = () => document.querySelector('meta[name="csrf-token"]');

const csrfToken = () => csrfMeta()?.content || "";

// Signing in and out resets the session, which rotates the CSRF token and kills
// the one this page was served with. The session endpoints hand the new one
// back so the app can carry on without a reload.
const setCsrfToken = (token) => {
  const meta = csrfMeta();
  if (meta && token) meta.content = token;
};

// The session lapses after fifteen minutes of idleness, and signing in on
// another device ends it outright, so any request can come back a 401. Whichever
// one notices first says so here, and the app drops to the login form rather
// than showing a load error that a retry cannot fix.
let onUnauthorized = () => {};

export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

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
    if (response.status === 401) onUnauthorized();

    const error = new Error("Request failed");
    error.status = response.status;
    error.errors = body?.errors || {};
    throw error;
  }

  return body;
}

// Who is signed in. Throws with `status === 401` when nobody is, which is how
// the app decides to show the login form rather than an error.
export const getSession = () => request("/api/v1/session");

export const logIn = async (email, password) => {
  const user = await request("/api/v1/session", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setCsrfToken(user.csrf_token);
  return user;
};

export const logOut = async () => {
  const body = await request("/api/v1/session", { method: "DELETE" });
  setCsrfToken(body?.csrf_token);
};

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
// Master data, so the list is the same whichever company is being worked on.
export const listParties = (role) => request(`/api/v1/${role}s`);

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

// The same register as a file. A plain link rather than a fetch, so the browser
// saves it itself; the session cookie rides along and keeps it behind the login.
// An empty financialYear leaves the file covering every year, as on screen.
export const saudaRegisterUrl = (companyId, sellerId, format, financialYear = "") => {
  const params = new URLSearchParams({ company_id: companyId, seller_id: sellerId });
  if (financialYear) params.set("financial_year", financialYear);

  return `/api/v1/saudas.${format}?${params}`;
};

// One sauda on its own, for the edit form.
export const getSauda = (id) => request(`/api/v1/saudas/${id}`);

export const createSauda = (sauda) =>
  request("/api/v1/saudas", { method: "POST", body: JSON.stringify({ sauda }) });

export const updateSauda = (id, sauda) =>
  request(`/api/v1/saudas/${id}`, { method: "PATCH", body: JSON.stringify({ sauda }) });

export const deleteSauda = (id) => request(`/api/v1/saudas/${id}`, { method: "DELETE" });

// Marks belong to a seller, and can be created from the sauda form itself.
export const listMarks = (sellerId) =>
  request(`/api/v1/marks?seller_id=${encodeURIComponent(sellerId)}`);

export const createMark = (sellerId, name) =>
  request("/api/v1/marks", {
    method: "POST",
    body: JSON.stringify({ mark: { seller_id: sellerId, name } }),
  });
