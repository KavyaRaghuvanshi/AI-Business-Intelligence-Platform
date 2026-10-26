
import { useState } from "react";

const cardStyle = {
  background: "#ffffff",
  padding: "20px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  flex: "1 1 150px",
  minWidth: "130px",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left",
};

const cellStyle = {
  padding: "12px",
  border: "1px solid #e2e8f0",
};

function DatasetPreview() {
  const [datasetId, setDatasetId] = useState("1");
  const [dataset, setDataset] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchDataset = async () => {
    if (!datasetId.trim() || Number(datasetId) < 1) {
      setError("Please enter a valid dataset ID.");
      return;
    }

    setLoading(true);
    setError("");
    setDataset(null);
    setAnalysis(null);

    try {
      const [previewResponse, analysisResponse] = await Promise.all([
        fetch(`http://127.0.0.1:8000/datasets/${datasetId}/preview`),
        fetch(`http://127.0.0.1:8000/datasets/${datasetId}/analysis`),
      ]);

      const previewData = await previewResponse.json();
      const analysisData = await analysisResponse.json();

      if (!previewResponse.ok) {
        throw new Error(
          previewData.detail || "Failed to load dataset preview."
        );
      }

      if (!analysisResponse.ok) {
        throw new Error(
          analysisData.detail || "Failed to analyze dataset."
        );
      }

      setDataset(previewData);
      setAnalysis(analysisData);
    } catch (err) {
      setError(err.message || "Could not connect to the backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        color: "#1e293b",
        background: "#f8fafc",
        minHeight: "100%",
      }}
    >
      <h2>Dataset Preview & Analysis</h2>
      <p style={{ color: "#64748b" }}>
        Explore your uploaded data and check its quality.
      </p>

      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <input
          type="number"
          min="1"
          value={datasetId}
          onChange={(e) => setDatasetId(e.target.value)}
          placeholder="Dataset ID"
          style={{
            padding: "12px",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
          }}
        />

        <button
          onClick={fetchDataset}
          disabled={loading}
          style={{
            padding: "12px 18px",
            border: "none",
            borderRadius: "8px",
            background: "#2563eb",
            color: "white",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Analyzing..." : "Preview & Analyze"}
        </button>
      </div>

      {error && (
        <p style={{ color: "#dc2626" }} role="alert">
          {error}
        </p>
      )}

      {dataset && analysis && (
        <>
          <h3>{dataset.filename}</h3>

          <div
            style={{
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              margin: "20px 0 30px",
            }}
          >
            <div style={cardStyle}>
              <p style={{ color: "#64748b", margin: 0 }}>Total Rows</p>
              <h2>{analysis.total_rows.toLocaleString()}</h2>
            </div>

            <div style={cardStyle}>
              <p style={{ color: "#64748b", margin: 0 }}>Total Columns</p>
              <h2>{analysis.total_columns}</h2>
            </div>

            <div style={cardStyle}>
              <p style={{ color: "#64748b", margin: 0 }}>Duplicate Rows</p>
              <h2>{analysis.duplicate_rows}</h2>
            </div>

            <div style={cardStyle}>
              <p style={{ color: "#64748b", margin: 0 }}>Missing Values</p>
              <h2>
                {Object.values(analysis.missing_values).reduce(
                  (total, count) => total + count,
                  0
                )}
              </h2>
            </div>
          </div>

          <section style={{ marginBottom: "32px" }}>
            <h3>Data Quality Report</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "#e2e8f0" }}>
                    <th style={cellStyle}>Column</th>
                    <th style={cellStyle}>Data Type</th>
                    <th style={cellStyle}>Missing Values</th>
                    <th style={cellStyle}>Quality Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(analysis.column_types).map(
                    ([column, type]) => {
                      const missing =
                        analysis.missing_values[column] ?? 0;

                      return (
                        <tr key={column}>
                          <td style={cellStyle}>{column}</td>
                          <td style={cellStyle}>{type}</td>
                          <td style={cellStyle}>{missing}</td>
                          <td style={cellStyle}>
                            <span
                              style={{
                                color: missing > 0 ? "#b45309" : "#15803d",
                                fontWeight: "bold",
                              }}
                            >
                              {missing > 0 ? "Needs attention" : "No missing values"}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ marginBottom: "32px" }}>
            <h3>Numeric Column Statistics</h3>
            {Object.keys(analysis.numeric_summary).length === 0 ? (
              <p>No numeric columns found in this dataset.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={{ background: "#e2e8f0" }}>
                      <th style={cellStyle}>Column</th>
                      <th style={cellStyle}>Mean</th>
                      <th style={cellStyle}>Minimum</th>
                      <th style={cellStyle}>Maximum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analysis.numeric_summary).map(
                      ([column, stats]) => (
                        <tr key={column}>
                          <td style={cellStyle}>{column}</td>
                          <td style={cellStyle}>
                            {stats.mean == null
                              ? "—"
                              : Number(stats.mean).toLocaleString(
                                  undefined,
                                  { maximumFractionDigits: 2 }
                                )}
                          </td>
                          <td style={cellStyle}>
                            {stats.minimum == null
                              ? "—"
                              : Number(stats.minimum).toLocaleString()}
                          </td>
                          <td style={cellStyle}>
                            {stats.maximum == null
                              ? "—"
                              : Number(stats.maximum).toLocaleString()}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h3>CSV Data Preview</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "#e2e8f0" }}>
                    {dataset.columns.map((column) => (
                      <th key={column} style={cellStyle}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.preview.map((row, index) => (
                    <tr key={index}>
                      {dataset.columns.map((column) => (
                        <td key={column} style={cellStyle}>
                          {row[column] == null ? "—" : String(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ color: "#64748b" }}>
              Showing up to 10 rows.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

export default DatasetPreview;
