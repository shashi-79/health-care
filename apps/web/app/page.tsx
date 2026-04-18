import PrototypeHost from "./prototype-host";

export default function HomePage() {
  return (
    <main className="prototype-shell">
      <header className="prototype-topbar">
        <h1 className="prototype-title">CareChat Prototype (Structured App Host)</h1>
        <p className="prototype-subtitle">
          Migrated UI is mounted directly in the app shell and aligned to modular route/package lanes.
        </p>
      </header>
      <PrototypeHost />
    </main>
  );
}
