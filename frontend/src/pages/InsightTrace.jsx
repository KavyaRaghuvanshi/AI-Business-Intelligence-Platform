import "./InsightTrace.css";
import { useEffect, useState } from "react";
import { API } from "../services/api";


function InsightTrace() {
  const [datasets, setDatasets] = useState([]);
  const [datasetId, setDatasetId] = useState("");
  const [result, setResult] = useState(null);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/datasets`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load datasets.");
        return response.json();
      })
      .then((data) => {
        setDatasets(data);
        if (data.length > 0) {
          setDatasetId(String(data[0].id));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingDatasets(false));
  }, []);

  async function generateInsights() {
    if (!datasetId) {
      setError("Please select a dataset.");
      return;
    }

    setLoadingInsights(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        `${API}/datasets/${datasetId}/insighttrace`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not generate findings.");
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoadingInsights(false);
    }
  }

  if (loadingDatasets) {
    return <div className="insighttrace-page">Loading datasets...</div>;
  }

  return (
    <div className="insighttrace-page">
   
      <div className="insighttrace-controls">
        <label htmlFor="trace-dataset">Select dataset</label>

        <select
          id="trace-dataset"
          value={datasetId}
          onChange={(event) => {
            setDatasetId(event.target.value);
            setResult(null);
            setError("");
          }}
        >
          {datasets.length === 0 && (
            <option value="">No datasets available</option>
          )}

          {datasets.map((dataset) => (
            <option key={dataset.id} value={String(dataset.id)}>
              {dataset.filename}
            </option>
          ))}
        </select>

        <button
          onClick={generateInsights}
          disabled={!datasetId || loadingInsights}
        >
          {loadingInsights ? "Analyzing..." : "Generate Findings"}
        </button>
      </div>

      {error && <p className="trace-error">{error}</p>}

      {result && (
        <>
          <div className="trace-summary">
            <h2>{result.filename}</h2>
            <p>Total findings: {result.total_findings}</p>
            <p>
              AI status:{" "}
              {result.ai?.available
                ? "Explanations generated"
                : "Evidence mode — AI unavailable or not configured"}
            </p>
          </div>

          {result.ai?.summary && (
            <section className="trace-card">
              <h2>AI Business Summary</h2>
              <p>{result.ai.summary}</p>
            </section>
          )}

          <h2>Evidence-backed Findings</h2>

          {result.findings.map((finding) => {
            const explanation = result.ai?.explanations?.find(
              (item) => item.finding_id === finding.id
            );

            return (
              <section className="trace-card" key={finding.id}>
                <div className="trace-card-heading">
                  <h3>{finding.title}</h3>
                  <span className={`trace-severity ${finding.severity}`}>
                    {finding.severity}
                  </span>
                </div>

                <p>{finding.claim}</p>

                <details>
                  <summary>View supporting evidence</summary>
                  <pre>
                    {JSON.stringify(finding.evidence, null, 2)}
                  </pre>
                </details>

                <p>
                  <strong>Recommendation:</strong>{" "}
                  {finding.recommendation}
                </p>

                {explanation && (
                  <div className="trace-ai-explanation">
                    <p>
                      <strong>AI explanation:</strong>{" "}
                      {explanation.explanation}
                    </p>
                    <p>
                      <strong>Suggested business action:</strong>{" "}
                      {explanation.business_action}
                    </p>
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

export default InsightTrace;
