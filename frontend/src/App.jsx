import AIInsights from "./pages/AIInsights";
import { useEffect, useState } from "react";
import "./App.css";
import Datasets from "./pages/Dataset";
import DatasetPreview from "./DatasetPreview";
import Analytics from "./pages/Analytics";

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [dashboardData, setDashboardData] = useState({
    total_users: 0,
    total_datasets: 0,
  });

  useEffect(() => {
    fetch("http://127.0.0.1:8000/dashboard")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch dashboard data");
        }
        return response.json();
      })
      .then((data) => {
        setDashboardData(data);
      })
      .catch((error) => {
        console.error("Error fetching dashboard:", error);
      });
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">AI BI</div>

        <nav>
          <a
            className={currentPage === "dashboard" ? "active" : ""}
            onClick={() => setCurrentPage("dashboard")}
          >
            Dashboard
          </a>

          <a
            className={currentPage === "datasets" ? "active" : ""}
            onClick={() => setCurrentPage("datasets")}
          >
            Datasets
          </a>

          <a
            className={currentPage === "preview" ? "active" : ""}
            onClick={() => setCurrentPage("preview")}
          >
            Dataset Preview
          </a>

          <a
            className={currentPage === "analytics" ? "active" : ""}
            onClick={() => setCurrentPage("analytics")}
          >
            Analytics
          </a>

          <a
            className={currentPage === "insights" ? "active" : ""}
            onClick={() => setCurrentPage("insights")}
          >
            AI Insights
          </a>

          <a
            className={currentPage === "reports" ? "active" : ""}
            onClick={() => setCurrentPage("reports")}
          >
            Reports
          </a>

          <a
            className={currentPage === "settings" ? "active" : ""}
            onClick={() => setCurrentPage("settings")}
          >
            Settings
          </a>
        </nav>
      </aside>

      <main className="main-content">
        {currentPage === "dashboard" && (
          <>
            <header className="header">
              <div>
                <h1>Dashboard</h1>
                <p>
                  Welcome to your AI Business Intelligence Platform
                </p>
              </div>

              <div className="user">
                <div className="avatar">K</div>
                <span>User</span>
              </div>
            </header>

            <section className="stats">
              <div className="card">
                <h3>Total Users</h3>
                <p>{dashboardData.total_users}</p>
                <span>Registered users</span>
              </div>

              <div className="card">
                <h3>Total Datasets</h3>
                <p>{dashboardData.total_datasets}</p>
                <span>Uploaded datasets</span>
              </div>

              <div className="card">
                <h3>Total Records</h3>
                <p>--</p>
                <span>Coming soon</span>
              </div>

              <div className="card">
                <h3>AI Insights</h3>
                <p>--</p>
                <span>Coming soon</span>
              </div>
            </section>

            <section className="dataset-section">
              <div className="section-header">
                <div>
                  <h2>Recent Datasets</h2>
                  <p>Your uploaded business datasets</p>
                </div>

                <button onClick={() => setCurrentPage("datasets")}>
                  View Datasets
                </button>
              </div>

              <p>
                Select Datasets from the sidebar to view and manage
                your uploaded files.
              </p>
            </section>
          </>
        )}

        {currentPage === "datasets" && <Datasets />}

        {currentPage === "preview" && <DatasetPreview />}

        {currentPage === "analytics" && <Analytics />}

        {currentPage === "insights" && <AIInsights/>}

        {currentPage === "reports" && <h1>Reports - Coming Soon</h1>}

        {currentPage === "settings" && <h1>Settings - Coming Soon</h1>}
      </main>
    </div>
  );
}

export default App;
