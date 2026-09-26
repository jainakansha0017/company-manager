import React, { useCallback, useEffect, useRef, useState } from "react";
import { getSession, listCompanies, logOut, setUnauthorizedHandler } from "../lib/api";
import CompaniesPage from "./CompaniesPage";
import SaudaRegister from "./SaudaRegister";
import SaudaForm from "./SaudaForm";
import LoginPage from "./LoginPage";
import PartyPage from "./PartyPage";

// /sauda, /sauda/new, /sauda/edit — the register itself and its form. Nothing
// company-specific is in the path any more: a sauda is read and written by
// seller alone.
const SAUDA_PATH = /^\/sauda(?:\/(new|edit))?\/?$/;
const PARTY_PATH = /^\/(buyers|sellers)(\/new)?\/?$/;

function parseRoute(href) {
  const url = new URL(href, window.location.origin);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const query = url.searchParams;

  if (pathname === "/companies") return { name: "companies" };

  const party = pathname.match(PARTY_PATH);
  if (party) {
    return {
      name: party[1],
      // /sellers/new?name=Acme&return=/sauda
      startNew: Boolean(party[2]),
      prefillName: query.get("name") ?? "",
      returnTo: query.get("return") ?? null,
    };
  }

  const sauda = pathname.match(SAUDA_PATH);

  // Sauda is the default: "/" and anything not otherwise recognised (an old
  // link, say) still open on the register rather than a blank page.
  return {
    name: "sauda",
    action: sauda ? sauda[1] ?? null : null,
    sellerId: query.get("seller_id"),
    buyerId: query.get("buyer_id"),
    saudaId: query.get("sauda_id"),
    sellerJustAdded: query.get("added") === "1",
    saudaSaved: query.get("saved") === "1",
  };
}

const currentHref = () => window.location.pathname + window.location.search;

const NAV = [
  { key: "sauda", path: "/", label: "Sauda" },
  { key: "sellers", path: "/sellers", label: "Seller" },
  { key: "buyers", path: "/buyers", label: "Buyer" },
  { key: "companies", path: "/companies", label: "Companies" },
];

export default function App() {
  const [route, setRoute] = useState(() => parseRoute(currentHref()));
  const [navOpen, setNavOpen] = useState(false);

  // `undefined` while we are still asking the server; `null` once we know
  // nobody is signed in. The difference matters — rendering the login form
  // before the answer arrives flashes it at someone who is already signed in.
  const [currentUser, setCurrentUser] = useState(undefined);

  // Why the login form is being shown, when it is not simply that nobody has
  // signed in yet.
  const [endedSession, setEndedSession] = useState(false);

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      setCompanies(await listCompanies());
      setError(null);
    } catch (failure) {
      // A 401 has already dropped the app to the login form; saying the list
      // could not be loaded on top of that would only confuse.
      if (failure.status !== 401) setError("Could not load companies. Is the server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getSession()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  // Read by the 401 handler below, which is registered once and so cannot see
  // the state as it changes.
  const signedIn = useRef(false);
  useEffect(() => {
    signedIn.current = Boolean(currentUser);
  }, [currentUser]);

  // Only worth saying something when a session was actually lost. A 401 while
  // signed out is the ordinary answer to "who am I?" and to a wrong password.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!signedIn.current) return;

      setCurrentUser(null);
      setCompanies([]);
      setError(null);
      setEndedSession(true);
    });
  }, []);

  // Companies are only fetched once there is someone to fetch them for, and
  // again after a different user signs in.
  useEffect(() => {
    if (currentUser) loadCompanies();
  }, [currentUser, loadCompanies]);

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute(currentHref()));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((path) => {
    window.history.pushState({}, "", path);
    setRoute(parseRoute(path));
    window.scrollTo(0, 0);
    setNavOpen(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logOut();
    } finally {
      // Whatever the server said, this browser is done with the session.
      setCurrentUser(null);
      setCompanies([]);
      setError(null);
      // Back to the front door, so signing in again does not drop whoever comes
      // next onto the page the last one happened to leave open.
      navigate("/");
    }
  }, [navigate]);

  const activeNav = route.name;

  // The register sets fifteen columns side by side, so it is given more of the
  // window than the forms and short lists the rest of the app is made of.
  const wide = route.name === "sauda" && !route.action;

  const renderRoute = () => {
    switch (route.name) {
      case "companies":
        return (
          <CompaniesPage
            companies={companies}
            loading={loading}
            error={error}
            onChanged={setCompanies}
          />
        );
      case "buyers":
      case "sellers":
        return (
          <PartyPage
            key={`${route.name}${route.startNew ? "-new" : ""}`}
            role={route.name === "buyers" ? "buyer" : "seller"}
            startNew={route.startNew}
            prefillName={route.prefillName}
            returnTo={route.returnTo}
            onNavigate={navigate}
          />
        );
      default:
        return route.action === "new" || route.action === "edit" ? (
          <SaudaForm
            key={route.saudaId ?? "new"}
            sellerId={route.sellerId}
            saudaId={route.action === "edit" ? route.saudaId : null}
            buyerId={route.buyerId}
            onNavigate={navigate}
          />
        ) : (
          <SaudaRegister
            sellerId={route.sellerId}
            sellerJustAdded={route.sellerJustAdded}
            saudaSaved={route.saudaSaved}
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
        <LoginPage
          notice={
            endedSession
              ? "You were signed out after fifteen minutes without activity, or because " +
                "this account was signed in somewhere else."
              : null
          }
          onSignedIn={(user) => {
            setEndedSession(false);
            setCurrentUser(user);
            // Signing in always opens on the home page, whatever page a
            // lapsed session or a stale link happened to be sitting on.
            navigate("/");
          }}
        />
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <button
          type="button"
          className="hamburger"
          aria-label={navOpen ? "Close menu" : "Open menu"}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="nav__user">
          <span className="nav__user-name">{currentUser.name}</span>
          <button type="button" className="button button--small" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      {navOpen && <div className="nav-overlay" onClick={() => setNavOpen(false)} />}

      <nav className={`nav-drawer${navOpen ? " nav-drawer--open" : ""}`}>
        {NAV.map((entry) => (
          <a
            key={entry.key}
            href={entry.path}
            className={`nav-drawer__link${
              activeNav === entry.key ? " nav-drawer__link--active" : ""
            }`}
            onClick={(event) => {
              event.preventDefault();
              navigate(entry.path);
            }}
          >
            {entry.label}
          </a>
        ))}
      </nav>

      <div className={`page${wide ? " page--wide" : ""}`}>{renderRoute()}</div>
    </>
  );
}
