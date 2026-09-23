import React, { useCallback, useEffect, useState } from "react";
import { listCompanies } from "../lib/api";
import HomePage from "./HomePage";
import CompaniesPage from "./CompaniesPage";
import CompanyWorkspace, { DEFAULT_TAB } from "./CompanyWorkspace";
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

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      setCompanies(await listCompanies());
      setError(null);
    } catch {
      setError("Could not load companies. Is the server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

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
      </nav>

      {renderRoute()}
    </div>
  );
}
