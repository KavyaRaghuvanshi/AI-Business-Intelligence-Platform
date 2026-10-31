import { lazy, Suspense, useEffect, useState } from "react";
import "./App.css";
import { API } from "./services/api";
const Datasets = lazy(() => import("./pages/Dataset"));
const DatasetPreview = lazy(() => import("./DatasetPreview"));
const AIInsights = lazy(() => import("./pages/AIInsights"));
const Reports = lazy(() => import("./pages/Reports"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const InsightTrace = lazy(() => import("./pages/InsightTrace"));

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: "▦", group: "WORKSPACE" },
  { id: "datasets", label: "Datasets", icon: "▤", group: "WORKSPACE" },
  { id: "preview", label: "Data Preview", icon: "◫", group: "WORKSPACE" },

  { id: "insights", label: "AI Insights", icon: "✧", group: "INTELLIGENCE" },
  { id: "insighttrace", label: "InsightTrace AI", icon: "⌕", group: "INTELLIGENCE" },
  { id: "reports", label: "Reports", icon: "▧", group: "MANAGEMENT" },
  { id: "settings", label: "Settings", icon: "⚙", group: "MANAGEMENT" },
];

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [dashboardData, setDashboardData] = useState({
    total_users: 0,
    total_datasets: 0,
  });
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("bi-theme") || "light"
  );

  useEffect(() => {
    localStorage.setItem("bi-theme", theme);
  }, [theme]);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setApiError("");

      try {
        const [dashboardResponse, datasetsResponse] = await Promise.all([
          fetch(`${API}/dashboard`),
          fetch(`${API}/datasets`),
        ]);

        if (!dashboardResponse.ok || !datasetsResponse.ok) {
          throw new Error("Could not load all dashboard data.");
        }

        const dashboard = await dashboardResponse.json();
        const datasetList = await datasetsResponse.json();

        setDashboardData(dashboard);
        setDatasets(Array.isArray(datasetList) ? datasetList : []);
      } catch (error) {
        console.error("Dashboard loading error:", error);
        setApiError(
          "Unable to connect to the backend. Check that FastAPI is running."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const pageTitles = {
    dashboard: ["Dashboard", "Your business intelligence at a glance"],
    datasets: ["Datasets", "Upload and manage your business data"],
    preview: ["Data Preview", "Explore your uploaded records"],
   
    insights: ["AI Insights", "Explore automated data insights"],
    insighttrace: ["InsightTrace AI", "Evidence-backed business intelligence"],
    reports: ["Reports", "Create and export analysis reports"],
    settings: ["Settings", "Manage your application preferences"],
  };

  const [title, subtitle] = pageTitles[currentPage] || pageTitles.dashboard;

  function openPage(page) {
    setCurrentPage(page);
  }

  return (
    <div className={`app-shell ${theme === "dark" ? "dark-mode" : ""}`}>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => openPage("dashboard")}
          aria-label="Go to dashboard"
        >
          <span className="brand-mark">B</span>
          <span className="brand-copy">
            <strong>InsightFlow</strong>
            <small>BUSINESS INTELLIGENCE</small>
          </span>
        </button>

        <div className="workspace-switcher">
          <span className="workspace-avatar">A</span>
          <span className="workspace-copy">
            <strong>My Workspace</strong>
            <small>Personal workspace</small>
          </span>
          <span className="workspace-chevron">⌄</span>
        </div>

        {["WORKSPACE", "INTELLIGENCE", "MANAGEMENT"].map((group) => (
          <div className="nav-group" key={group}>
            <p className="nav-heading">{group}</p>
            {navigation
              .filter((item) => item.group === group)
              .map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${
                    currentPage === item.id ? "active" : ""
                  }`}
                  onClick={() => openPage(item.id)}
                  aria-current={currentPage === item.id ? "page" : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {item.id === "insighttrace" && (
                    <span className="nav-badge">AI</span>
                  )}
                </button>
              ))}
          </div>
        ))}

        <div className="sidebar-bottom">
          

          <div className="sidebar-footer">
            <span className="user-avatar">K</span>
            <div className="user-details">
              <strong>Workspace User</strong>
              <small>BI Analyst</small>
            </div>
            <button
              className="icon-button sidebar-theme"
              type="button"
              title="Toggle theme"
              aria-label="Toggle theme"
              onClick={() =>
                setTheme((previous) =>
                  previous === "dark" ? "light" : "dark"
                )
              }
            >
              {theme === "dark" ? "☀" : "◐"}
            </button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="connection-status">
              <span className="status-dot" />
              BI Workspace
            </span>
            <span className="topbar-avatar">K</span>
          </div>
        </header>

        <div className="page-content">
          {currentPage === "dashboard" ? (
            <Dashboard
              dashboardData={dashboardData}
              datasets={datasets}
              loading={loading}
              apiError={apiError}
              openPage={openPage}
            />
          ) : (
            <div className="page-heading">
              <div>
                <p className="eyebrow">YOUR WORKSPACE</p>
                <h1>{title}</h1>
                <p className="page-subtitle">{subtitle}</p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => openPage("dashboard")}
              >
                ← Dashboard
              </button>
            </div>
          )}

          <Suspense
  fallback={
    <div className="page-loading" role="status">
      Loading workspace page...
    </div>
  }
>
  {currentPage === "datasets" && <Datasets />}

  {currentPage === "preview" && <DatasetPreview />}

  {currentPage === "insights" && <AIInsights />}

  {currentPage === "insighttrace" && <InsightTrace />}

  {currentPage === "reports" && <Reports />}

  {currentPage === "settings" && (
    <SettingsPage theme={theme} setTheme={setTheme} />
  )}
</Suspense>
        </div>
      </main>
    </div>
  );
}

function Dashboard({
  dashboardData,
  datasets,
  loading,
  apiError,
  openPage,
}) {
  const totalUsers = dashboardData?.total_users ?? 0;
  const totalDatasets =
    datasets.length > 0 ? datasets.length : dashboardData?.total_datasets ?? 0;

  return (
    <div className="dashboard">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>
            Good to see You  <span>✦</span>
          </h1>
          <p className="page-subtitle">
            Here’s what’s happening with your data today.
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => openPage("datasets")}
        >
          <span>＋</span> Manage datasets
        </button>
      </section>

      {apiError && (
        <div className="error-banner" role="alert">
          {apiError}
        </div>
      )}

      <section className="metric-grid">
        <MetricCard
          label="Total users"
          value={loading ? "—" : totalUsers}
          detail="Registered platform users"
          icon="♙"
          tone="blue"
        />
        <MetricCard
          label="Uploaded datasets"
          value={loading ? "—" : totalDatasets}
          detail="Available for analysis"
          icon="▤"
          tone="violet"
        />
        <MetricCard
          label="Recent uploads"
          value={loading ? "—" : datasets.length}
          detail="Datasets currently available"
          icon="↥"
          tone="teal"
        />
        <MetricCard
          label="AI workspace"
          value="Ready"
          detail="Analysis tools available"
          icon="✧"
          tone="orange"
          status
        />
      </section>

      <section className="dashboard-grid">
        <div className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent datasets</h2>
              <p>Your latest uploaded data sources</p>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => openPage("datasets")}
            >
              View all <span>→</span>
            </button>
          </div>

          {loading ? (
            <div className="empty-state">Loading your datasets…</div>
          ) : datasets.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">▤</span>
              <h3>No datasets yet</h3>
              <p>Upload a CSV file to start exploring your business data.</p>
              <button
                className="primary-button"
                type="button"
                onClick={() => openPage("datasets")}
              >
                Upload your first dataset
              </button>
            </div>
          ) : (
            <div className="dataset-list">
              {datasets.slice(0, 5).map((dataset) => (
                <div className="dataset-row" key={dataset.id}>
                  <div className="file-icon">CSV</div>
                  <div className="dataset-info">
                    <strong>{dataset.filename}</strong>
                    <small>
                      {dataset.uploaded_at
                        ? `Uploaded ${new Date(
                            dataset.uploaded_at
                          ).toLocaleDateString()}`
                        : "Uploaded dataset"}
                    </small>
                  </div>
                  <span className="file-status">
                    <span /> Available
                  </span>
                  <button
                    className="row-action"
                    type="button"
                    title={`Open data preview for ${dataset.filename}`}
                    aria-label={`Open data preview for ${dataset.filename}`}
                    onClick={() => openPage("preview")}
                  >
                    →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel actions-panel">
          <div className="panel-heading">
            <div>
              <h2>Quick actions</h2>
              <p>Jump into your workflow</p>
            </div>
          </div>

          <QuickAction
            icon="▤"
            tone="blue"
            title="Manage datasets"
            description="Upload or browse your data"
            onClick={() => openPage("datasets")}
          />
          

          <QuickAction
            icon="✧"
            tone="violet"
            title="AI insights"
            description="Discover important findings"
            onClick={() => openPage("insights")}
          />
          <QuickAction
            icon="⌕"
            tone="orange"
            title="InsightTrace AI"
            description="Inspect findings and supporting evidence"
            onClick={() => openPage("insighttrace")}
          />
        </div>
      </section>

      <section className="insight-banner">
        <div className="banner-symbol">✧</div>
        <div className="banner-copy">
          <span>INTRODUCING YOUR AI WORKSPACE</span>
          <h2>Turn raw data into clearer decisions.</h2>
          <p>
            Explore evidence-backed findings and practical recommendations
            with InsightTrace AI.
          </p>
        </div>
        <button
          className="banner-button"
          type="button"
          onClick={() => openPage("insighttrace")}
        >
          Explore InsightTrace <span>→</span>
        </button>
        <div className="banner-decoration" aria-hidden="true">
          ✳
        </div>
      </section>

      <footer className="dashboard-footer">
        <span>InsightFlow BI</span>
        <span>Business intelligence workspace</span>
      </footer>
    </div>
  );
}

function MetricCard({ label, value, detail, icon, tone, status }) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span className={`metric-icon ${tone}`} aria-hidden="true">
          {icon}
        </span>
        {status && (
          <span className="live-label">
            <span /> Active
          </span>
        )}
      </div>
      <p className="metric-label">{label}</p>
      <h2>{value}</h2>
      <p className="metric-detail">{detail}</p>
    </article>
  );
}

function QuickAction({ icon, tone, title, description, onClick }) {
  return (
    <button className="quick-action" type="button" onClick={onClick}>
      <span className={`quick-icon ${tone}`} aria-hidden="true">
        {icon}
      </span>
      <span className="quick-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="quick-arrow" aria-hidden="true">
        →
      </span>
    </button>
  );
}

export default App;
