import React, { useCallback, useEffect, useState } from "react";
import { getSession, listCompanies, logOut } from "../lib/api";
import HomePage from "./HomePage";
import CompaniesPage from "./CompaniesPage";
import CompanyWorkspace, { DEFAULT_TAB } from "./CompanyWorkspace";
import LoginPage from "./LoginPage";
import PartyPage from "./PartyPage";

// /companies/:id, /companies/:id/:tab, /companies/:id/:tab/:action
const COMPANY_PATH = /^\/companies\/(\d+)(?:\/([\w-]+))?(?:\/([\w-]+))?\/?$/;
const PARTY_PATH = /^\/(buyers|sellers)(\/new)?\/?$/;

function parseRoute(href) {
  const url = new URL(href, window.location.origin);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const query = url.searchParams;

  if (pathname === "/companies") return { name: "manage" };

  const party = pathname.match(PARTY_PATH);
  if (party) {
    return {
      name: party[1],
      // /sellers/new?company_id=3&name=Acme&return=/companies/3/sauda-register
      startNew: Boolean(party[2]),
      initialCompanyId: query.get("company_id") ?? "",
      prefillName: query.get("name") ?? "",
      returnTo: query.get("return") ?? null,
    };
  }

  const company = pathname.match(COMPANY_PATH);
  if (company) {
    return {
      name: "company",
      companyId: company[1],
      tab: company[2] || DEFAULT_TAB,
      action: company[3] ?? null,
      sellerId: query.get("seller_id"),
      buyerId: query.get("buyer_id"),
      saudaId: query.get("sauda_id"),
      sellerJustAdded: query.get("added") === "1",
      saudaSaved: query.get("saved") === "1",
    };
  }

  return { name: "home" };
}

const currentHref = () => window.location.pathname + window.location.search;

// Which top-level nav item should light up for a given route.
const NAV_FOR = { home: "companies", manage: "companies", company: "companies" };

const NAV = [
  { key: "companies", path: "/", label: "Companies" },
  { key: "buyers", path: "/buyers", label: "Buyer" },
  { key: "sellers", path: "/sellers", label: "Seller" },
];

export default function App() {
  const [route, setRoute] = useState(() => parseRoute(currentHref()));

  // `undefined` while we are still asking the server; `null` once we know
  // nobody is signed in. The difference matters — rendering the login form
  // before the answer arrives flashes it at someone who is already signed in.
  const [currentUser, setCurrentUser] = useState(undefined);

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      setCompanies(await listCompanies());
      setError(null);
    } catch (failure) {
      // The session can lapse while the tab sits open. Drop back to the login
      // form rather than showing a load error that a retry cannot fix.
      if (failure.status === 401) setCurrentUser(null);
      else setError("Could not load companies. Is the server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getSession()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  // Companies are only fetched once there is someone to fetch them for, and
  // again after a different user signs in.
  useEffect(() => {
    if (currentUser) loadCompanies();
  }, [currentUser, loadCompanies]);

  const signOut = useCallback(async () => {
    try {
      await logOut();
    } finally {
      // Whatever the server said, this browser is done with the session.
      setCurrentUser(null);
      setCompanies([]);
      setError(null);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute(currentHref()));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((path) => {
    window.history.pushState({}, "", path);
    setRoute(parseRoute(path));
    window.scrollTo(0, 0);
  }, []);

  const activeNav = NAV_FOR[route.name] ?? route.name;

  // The register sets fifteen columns side by side, so it is given more of the
  // window than the forms and short lists the rest of the app is made of.
  const wide =
    route.name === "company" && route.tab === "sauda-register" && !route.action;

  const renderRoute = () => {
    switch (route.name) {
      case "manage":
        return (
          <CompaniesPage
            companies={companies}
            loading={loading}
            error={error}
            onChanged={setCompanies}
            onNavigate={navigate}
          />
        );
      case "company":
        return (
          <CompanyWorkspace
            companyId={route.companyId}
            company={companies.find((entry) => String(entry.id) === route.companyId)}
            tab={route.tab}
            action={route.action}
            sellerId={route.sellerId}
            buyerId={route.buyerId}
            saudaId={route.saudaId}
            sellerJustAdded={route.sellerJustAdded}
            saudaSaved={route.saudaSaved}
            loading={loading}
            onNavigate={navigate}
          />
        );
      case "buyers":
      case "sellers":
        return (
          <PartyPage
            key={`${route.name}${route.startNew ? "-new" : ""}`}
            role={route.name === "buyers" ? "buyer" : "seller"}
            companies={companies}
            companiesLoading={loading}
            startNew={route.startNew}
            initialCompanyId={route.initialCompanyId}
            prefillName={route.prefillName}
            returnTo={route.returnTo}
            onNavigate={navigate}
          />
        );
      default:
        return (
          <HomePage
            companies={companies}
            loading={loading}
            error={error}
            onChanged={setCompanies}
            onNavigate={navigate}
          />
        );
    }
  };

  // Nothing is worth drawing until we know who is asking.
  if (currentUser === undefined) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (currentUser === null) {
    return (
      <div className="page">
        <LoginPage onSignedIn={setCurrentUser} />
      </div>
    );
  }

  return (
    <div className={`page${wide ? " page--wide" : ""}`}>
      <nav className="nav">
        {NAV.map((entry) => (
          <a
            key={entry.key}
            href={entry.path}
            className={`nav__link${activeNav === entry.key ? " nav__link--active" : ""}`}
            onClick={(event) => {
              event.preventDefault();
              navigate(entry.path);
            }}
          >
            {entry.label}
          </a>
        ))}

        <div className="nav__user">
          <span className="nav__user-name">{currentUser.name}</span>
          <button type="button" className="button button--small" onClick={signOut}>
            Sign out
          </button>
        </div>
      </nav>

      {renderRoute()}
    </div>
  );
}
