
import { useEffect, useState } from "react";
import {
  Database,
  FileSpreadsheet,
  Rows3,
  Columns3,
  Copy,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  BarChart3,
  ShieldCheck,
  LoaderCircle,
  Sparkles,
  Table2,
  FileSearch,
} from "lucide-react";
import "./DatasetPreview.css";
import { API } from "./services/api";


function DatasetPreview() {
  const [datasets, setDatasets] = useState([]);
  const [datasetId, setDatasetId] = useState("");
  const [dataset, setDataset] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [datasetError, setDatasetError] = useState("");
  const [search, setSearch] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  // Load the available datasets.
  useEffect(() => {
    let cancelled = false;

    async function loadDatasets() {
      setLoadingDatasets(true);
      setDatasetError("");

      try {
        const response = await fetch(`${API}/datasets`);

        if (!response.ok) {
          throw new Error("Could not load your datasets.");
        }

        const result = await response.json();

        if (!Array.isArray(result)) {
          throw new Error("The backend returned an invalid dataset list.");
        }

        if (!cancelled) {
          setDatasets(result);

          // Keep the selected dataset if it still exists.
          setDatasetId((current) => {
            if (result.some((item) => String(item.id) === current)) {
              return current;
            }

            return result.length ? String(result[0].id) : "";
          });
        }
      } catch (err) {
        if (!cancelled) {
          setDatasetError(
            err.message || "Could not connect to the backend."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingDatasets(false);
        }
      }
    }

    loadDatasets();

    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  // Fetch the selected dataset's preview and analysis.
  useEffect(() => {
    if (!datasetId) {
  return;
}

    let cancelled = false;

    async function fetchDataset() {
      setLoading(true);
      setError("");
      setDataset(null);
      setAnalysis(null);
      setSearch("");

      try {
        const [previewResponse, analysisResponse] = await Promise.all([
          fetch(`${API}/datasets/${datasetId}/preview`),
          fetch(`${API}/datasets/${datasetId}/analysis`),
        ]);

        const [previewData, analysisData] = await Promise.all([
          previewResponse.json(),
          analysisResponse.json(),
        ]);

        if (!previewResponse.ok) {
          throw new Error(
            previewData.detail || "Failed to load dataset preview."
          );
        }

        if (!analysisResponse.ok) {
          throw new Error(
            analysisData.detail || "Failed to analyze the dataset."
          );
        }

        if (!cancelled) {
          setDataset(previewData);
          setAnalysis(analysisData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message || "Could not connect to the backend."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDataset();

    return () => {
      cancelled = true;
    };
  }, [datasetId,retryKey]);

  const columns = Array.isArray(dataset?.columns)
    ? dataset.columns
    : [];

  const previewRows = Array.isArray(dataset?.preview)
    ? dataset.preview
    : [];

  const columnTypes = analysis?.column_types || {};
  const missingValues = analysis?.missing_values || {};
  const numericSummary = analysis?.numeric_summary || {};

  const totalMissing = Object.values(missingValues).reduce(
    (total, count) => total + (Number(count) || 0),
    0
  );

  const duplicateRows = Number(analysis?.duplicate_rows) || 0;
  const totalRows = Number(analysis?.total_rows) || 0;
  const totalColumns = Number(
    analysis?.total_columns ?? columns.length
  );

  const filteredRows = previewRows.filter((row) =>
    columns.some((column) =>
      String(row?.[column] ?? "")
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  );

  function formatNumber(value, maximumFractionDigits = 2) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    const number = Number(value);

    return Number.isFinite(number)
      ? number.toLocaleString(undefined, { maximumFractionDigits })
      : String(value);
  }

  function retry() {
    setError("");
    setDatasetError("");
    setRetryKey((value) => value + 1);
  }

  return (
    <div className="dataset-preview-page">
      <section className="preview-hero">
        <div className="preview-hero-content">
          <div className="preview-eyebrow">
            <Sparkles size={15} />
            DATA EXPLORATION
          </div>

          <h2>Dataset Preview &amp; Analysis</h2>

          <p>
            Explore your records, understand data quality, and review
            statistical summaries before making business decisions.
          </p>

          <div className="preview-hero-tags">
            <span><ShieldCheck size={15} /> Data quality</span>
            <span><BarChart3 size={15} /> Statistical analysis</span>
            <span><Table2 size={15} /> Record preview</span>
          </div>
        </div>

        <div className="preview-hero-visual" aria-hidden="true">
          <div className="preview-visual-circle">
            <Database size={43} />
          </div>
          <span className="preview-floating-icon preview-float-one">
            <Rows3 size={19} />
          </span>
          <span className="preview-floating-icon preview-float-two">
            <BarChart3 size={19} />
          </span>
          <span className="preview-floating-icon preview-float-three">
            <ShieldCheck size={19} />
          </span>
        </div>
      </section>

      <section className="preview-selector panel">
        <div className="preview-selector-info">
          <span className="preview-selector-icon">
            <FileSpreadsheet size={22} />
          </span>
          <div>
            <h3>Select a dataset</h3>
            <p>Choose an uploaded dataset to inspect its records.</p>
          </div>
        </div>

        <div className="preview-selector-controls">
          <select
            aria-label="Choose a dataset"
            value={datasetId}
            onChange={(event) => setDatasetId(event.target.value)}
            disabled={loadingDatasets || datasets.length === 0}
          >
            <option value="">
              {loadingDatasets
                ? "Loading datasets..."
                : datasets.length
                  ? "Select a dataset"
                  : "No datasets available"}
            </option>

            {datasets.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.filename}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="preview-button preview-button-primary"
            onClick={() => {
              if (datasetId) {
                setError("");
                setDataset(null);
                setAnalysis(null);
                setSearch("");
                // Changing the ID triggers the fetch automatically.
                // Use retryKey for refreshing the same dataset.
                setRetryKey((value) => value + 1);
              } else {
                retry();
              }
            }}
            disabled={loading || loadingDatasets}
          >
            <RefreshCw size={16} className={loading ? "preview-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      {datasetError && (
        <div className="preview-error" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>Unable to load datasets</strong>
            <p>{datasetError}</p>
          </div>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      )}

      {error && (
        <div className="preview-error" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>Could not load analysis</strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError("");
              setRetryKey((value) => value + 1);
            }}
          >
            Retry
          </button>
        </div>
      )}

      {loading && datasetId && (
        <div className="preview-state panel" aria-live="polite">
          <span className="preview-state-icon preview-loading-icon">
            <LoaderCircle size={30} className="preview-spin" />
          </span>
          <h3>Analyzing your dataset</h3>
          <p>Loading the preview, checking data quality, and calculating statistics.</p>
        </div>
      )}

      {!error && !datasetError && !datasetId && (
        <div className="preview-state panel">
          <span className="preview-state-icon">
            <FileSearch size={30} />
          </span>
          <h3>No dataset selected</h3>
          <p>
            Select a dataset above to view its records and analysis.
            Upload a CSV from the Datasets page if you have not uploaded one yet.
          </p>
        </div>
      )}

      {!loading && datasetId && !error && dataset && analysis && (
        <>
          <section className="preview-file-banner">
            <div className="preview-file-main">
              <span className="preview-file-icon">
                <FileSpreadsheet size={23} />
              </span>
              <div>
                <span className="preview-overline">CURRENT DATASET</span>
                <h3>{dataset.filename || "Uploaded dataset"}</h3>
                <p>
                  Dataset ID: {datasetId} · Preview of up to 10 records
                </p>
              </div>
            </div>

            <span className="preview-status">
              <CheckCircle2 size={15} />
              Analysis loaded
            </span>
          </section>

          <section className="preview-metrics">
            <article className="preview-metric-card">
              <div className="preview-metric-top">
                <span className="preview-metric-icon blue">
                  <Rows3 size={20} />
                </span>
                <span className="preview-metric-label">TOTAL ROWS</span>
              </div>
              <strong>{formatNumber(analysis.total_rows, 0)}</strong>
              <p>Records in this dataset</p>
            </article>

            <article className="preview-metric-card">
              <div className="preview-metric-top">
                <span className="preview-metric-icon violet">
                  <Columns3 size={20} />
                </span>
                <span className="preview-metric-label">TOTAL COLUMNS</span>
              </div>
              <strong>{formatNumber(totalColumns, 0)}</strong>
              <p>Available data fields</p>
            </article>

            <article className="preview-metric-card">
              <div className="preview-metric-top">
                <span className="preview-metric-icon amber">
                  <AlertTriangle size={20} />
                </span>
                <span className="preview-metric-label">MISSING VALUES</span>
              </div>
              <strong>{formatNumber(totalMissing, 0)}</strong>
              <p>Missing cells across columns</p>
            </article>

            <article className="preview-metric-card">
              <div className="preview-metric-top">
                <span className="preview-metric-icon green">
                  <Copy size={20} />
                </span>
                <span className="preview-metric-label">DUPLICATE ROWS</span>
              </div>
              <strong>{formatNumber(duplicateRows, 0)}</strong>
              <p>Repeated records detected</p>
            </article>
          </section>

          <section className="preview-section panel">
            <div className="preview-section-heading">
              <div className="preview-section-title-icon">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3>Data quality report</h3>
                <p>Check data types and missing values for every column.</p>
              </div>
              <span className="preview-section-count">
                {Object.keys(columnTypes).length} columns
              </span>
            </div>

            {Object.keys(columnTypes).length === 0 ? (
              <div className="preview-empty-inline">
                No column quality information is available.
              </div>
            ) : (
              <div className="preview-table-wrap">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Column name</th>
                      <th>Data type</th>
                      <th>Missing values</th>
                      <th>Quality status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(columnTypes).map(([column, type]) => {
                      const missing = Number(missingValues[column]) || 0;

                      return (
                        <tr key={column}>
                          <td className="preview-column-name">{column}</td>
                          <td><span className="preview-type-chip">{String(type)}</span></td>
                          <td>{formatNumber(missing, 0)}</td>
                          <td>
                            <span className={`preview-quality ${missing > 0 ? "needs-attention" : "quality-good"}`}>
                              {missing > 0 ? (
                                <><AlertTriangle size={14} /> Needs attention</>
                              ) : (
                                <><CheckCircle2 size={14} /> No missing values</>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="preview-section panel">
            <div className="preview-section-heading">
              <div className="preview-section-title-icon violet">
                <BarChart3 size={20} />
              </div>
              <div>
                <h3>Numeric column statistics</h3>
                <p>Review averages and ranges for numeric fields.</p>
              </div>
              <span className="preview-section-count">
                {Object.keys(numericSummary).length} numeric columns
              </span>
            </div>

            {Object.keys(numericSummary).length === 0 ? (
              <div className="preview-empty-inline">
                <BarChart3 size={20} />
                No numeric columns were found in this dataset.
              </div>
            ) : (
              <div className="preview-table-wrap">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Column name</th>
                      <th>Mean</th>
                      <th>Minimum</th>
                      <th>Maximum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(numericSummary).map(([column, stats]) => (
                      <tr key={column}>
                        <td className="preview-column-name">{column}</td>
                        <td>{formatNumber(stats.mean)}</td>
                        <td>{formatNumber(stats.minimum)}</td>
                        <td>{formatNumber(stats.maximum)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="preview-section panel">
            <div className="preview-section-heading preview-record-heading">
              <div className="preview-section-title-icon teal">
                <Table2 size={20} />
              </div>
              <div>
                <h3>CSV data preview</h3>
                <p>Inspect the first 10 records returned by the preview endpoint.</p>
              </div>
              <span className="preview-section-count">
                {filteredRows.length} of {previewRows.length} rows
              </span>
            </div>

            <div className="preview-record-toolbar">
              <div className="preview-search">
                <Search size={17} />
                <input
                  type="search"
                  aria-label="Search preview rows"
                  placeholder="Search visible records..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <span className="preview-record-note">
                <Database size={14} />
                Read-only preview
              </span>
            </div>

            {columns.length === 0 || filteredRows.length === 0 ? (
              <div className="preview-empty-inline">
                {search
                  ? "No preview records match your search."
                  : "No preview records are available for this dataset."}
              </div>
            ) : (
              <div className="preview-table-wrap preview-data-wrap">
                <table className="preview-table preview-data-table">
                  <thead>
                    <tr>
                      <th className="preview-row-number">#</th>
                      {columns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, index) => (
                      <tr key={index}>
                        <td className="preview-row-number">{index + 1}</td>
                        {columns.map((column) => (
                          <td key={column}>
                            {row?.[column] == null || row[column] === ""
                              ? <span className="preview-null">—</span>
                              : String(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="preview-table-footer">
              <span>Showing records from the dataset preview.</span>
              <span>{formatNumber(totalRows, 0)} total records</span>
            </div>
          </section>
        </>
      )}

      {!loading && datasetId && dataset && !analysis && !error && (
        <div className="preview-state panel">
          <h3>Analysis is not available</h3>
          <p>The preview loaded, but analysis data was not returned.</p>
          <button className="preview-button preview-button-primary" onClick={retry}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      )}
    </div>
  );
}

export default DatasetPreview;
