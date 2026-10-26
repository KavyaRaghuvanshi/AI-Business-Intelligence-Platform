
import { useEffect, useState } from "react";

function AIInsights() {
  const [datasets, setDatasets] = useState([]);
  const [datasetId, setDatasetId] = useState("");
  const [insights, setInsights] = useState([]);
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/datasets")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load datasets");
        }
        return response.json();
      })
      .then(setDatasets)
      .catch(() => setError("Could not load datasets."));
  }, []);

  useEffect(() => {
    if (!datasetId) {
      setInsights([]);
      setFilename("");
      return;
    }

    setLoading(true);
    setError("");
    setInsights([]);

    fetch(`http://127.0.0.1:8000/datasets/${datasetId}/insights`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to generate insights");
        }
        return response.json();
      })
      .then((result) => {
        setInsights(result.insights || []);
        setFilename(result.filename || "");
      })
      .catch(() => {
        setError("Could not generate insights. Please check your backend.");
      })
      .finally(() => setLoading(false));
  }, [datasetId]);

  const getColor = (severity) => {
    if (severity === "warning") return "#f59e0b";
    if (severity === "success") return "#10b981";
    return "#6366f1";
  };

  const getIcon = (type) => {
    if (type === "data_quality") return "🛡️";
    if (type === "numeric_analysis") return "📊";
    if (type === "outlier_detection") return "⚠️";
    return "💡";
  };

  return (
    <div style={{ padding: "28px"}}>
      <h1>AI-Powered Insights</h1>
      <p>
        Discover data quality issues, statistical patterns, and potential risks.
      </p>

      <div style={{ margin: "24px 0" }}>
        <label style={{ display: "block", marginBottom: "8px" }}>
          Select Dataset
        </label>

        <select
          value={datasetId}
          onChange={(event) => setDatasetId(event.target.value)}
          style={{
            padding: "12px",
            width: "100%",
            maxWidth: "420px",
            borderRadius: "8px",
          }}
        >
          <option value="">Choose an uploaded dataset</option>
          {datasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.filename}
            </option>
          ))}
        </select>
      </div>

      {filename && (
        <p style={{ color: "#a5b4fc" }}>
          Analysis results for: <strong>{filename}</strong>
        </p>
      )}

      {loading && <p>Analyzing your dataset...</p>}

      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      {!datasetId && (
        <p>Select a dataset to generate insights.</p>
      )}

      {!loading && datasetId && !error && insights.length > 0 && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              margin: "24px 0",
            }}
          >
            <div style={cardStyle}>
              <p style={{ color: "#d9dfe8", fontSize: 18 }}>Total Insights</p>
              <h2 style={{color:'#d9dfe8'}}>{insights.length}</h2>
            </div>

            <div style={cardStyle}>
              <p style={{ color: "#d9dfe8", fontSize: 18 }}>Warnings</p>
              <h2 style={{color:'#d9dfe8'}}>
                {insights.filter((item) => item.severity === "warning").length}
              </h2>
            </div>

            <div style={cardStyle}>
              <p style={{ color: "#d9dfe8" , fontSize: 18}}>Positive Checks</p>
              <h2 style={{color:'#d9dfe8'}}>
                {insights.filter((item) => item.severity === "success").length}
              </h2>
            </div>
          </div>

          <h2 style={{ marginBottom: "16px" }}>Findings & Recommendations</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            {insights.map((item, index) => (
              <div
                key={`${item.type}-${index}`}
                style={{
                  ...cardStyle,
                  borderLeft: `4px solid ${getColor(item.severity)}`,
                }}
              >
                <div style={{ fontSize: "25px" }}>
                  {getIcon(item.type)}
                </div>

                <h3 style={{ margin: "12px 0" }}>{item.title}</h3>

                <span
                  style={{
                    color: getColor(item.severity),
                    fontSize: "12px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                  }}
                >
                  {item.severity || "info"}
                </span>

                <p style={{ lineHeight: 1.6, color: "#d1d5db" }}>
                  {item.description}
                </p>

                <div
                  style={{
                    background: "#1f2937",
                    padding: "12px",
                    borderRadius: "8px",
                    marginTop: "12px",
                  }}
                >
                  <strong>Recommendation</strong>
                  <p style={{ marginBottom: 0, color: "#d1d5db" }}>
                    {item.recommendation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const cardStyle = {
  background: "#111827",
  border: "1px solid #374151",
  borderRadius: "12px",
  padding: "20px",
};

export default AIInsights;
