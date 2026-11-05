import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Database,
  ShieldCheck,
  ChartNoAxesCombined,
  TriangleAlert,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LoaderCircle,
  ArrowRight,
  BrainCircuit,
  FileSearch,
  ChevronDown,
  ChevronUp,
  Target,
  Info,
} from "lucide-react";
import "./AIInsights.css";
import { API } from "../services/api";

const REQUEST_TIMEOUT_MS = 90000;

function getSeverity(severity) {
  if (severity === "warning") return "warning";
  if (severity === "success") return "success";
  return "info";
}

function getFindingIcon(category) {
  if (category === "data_quality") return <ShieldCheck size={21} />;
  if (category === "numeric_analysis") return <ChartNoAxesCombined size={21} />;
  if (category === "outlier_detection") return <TriangleAlert size={21} />;
  if (category === "overview") return <Database size={21} />;
  return <Lightbulb size={21} />;
}

function buildEvidence(item) {
  if (item.evidence && typeof item.evidence === "object") {
    return item.evidence;
  }

  const evidence = {};

  if (Array.isArray(item.columns) && item.columns.length > 0) {
    evidence.affected_columns = item.columns;
  }

  [
    "column",
    "mean",
    "median",
    "minimum",
    "maximum",
    "outlier_count",
    "valid_values",
    "missing_values",
  ].forEach((key) => {
    if (item[key] !== undefined && item[key] !== null) {
      evidence[key] = item[key];
    }
  });

  return evidence;
}

function formatValue(value) {
  if (value === null || value === undefined) return "Not available";

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function AIInsights() {
  const [datasets, setDatasets] = useState([]);
  const [datasetId, setDatasetId] = useState("");
  const [insights, setInsights] = useState([]);
  const [filename, setFilename] = useState("");
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [expandedFindings, setExpandedFindings] = useState({});
  const [filter, setFilter] = useState("all");

  // Load the dataset list and select the newest returned dataset by default.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadDatasets() {
      setLoadingDatasets(true);
      setError("");

      try {
        const response = await fetch(`${API}/datasets`, {
          signal: controller.signal,
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.detail || "Could not load datasets.");
        }

        if (!cancelled) {
          const list = Array.isArray(result) ? result : [];
          setDatasets(list);
          setDatasetId((currentId) => {
            if (currentId && list.some((item) => String(item.id) === currentId)) {
              return currentId;
            }
            return list.length ? String(list[0].id) : "";
          });
        }
      } catch (err) {
        if (!cancelled && err.name !== "AbortError") {
          setError(err.message || "Could not load datasets. Check your backend connection.");
        }
      } finally {
        if (!cancelled) setLoadingDatasets(false);
      }
    }

    loadDatasets();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // AI Insights uses the fast evidence endpoint. The separate InsightTrace AI
  // page can call /insighttrace when generated AI explanations are required.
  useEffect(() => {
    if (!datasetId) {
      setInsights([]);
      setFilename("");
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;

    async function loadInsights() {
      setLoading(true);
      setError("");
      setInsights([]);
      setFilename("");
      setExpandedFindings({});

      const timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(
          `${API}/datasets/${datasetId}/insights`,
          { signal: controller.signal }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            result.detail || `Analysis request failed (${response.status}).`
          );
        }

        if (!cancelled) {
          setInsights(Array.isArray(result.insights) ? result.insights : []);
          setFilename(result.filename || "");
        }
      } catch (err) {
        if (!cancelled) {
          if (timedOut) {
            setError(
              "Analysis exceeded 90 seconds. The backend may be waking up or the dataset may be too large. Please retry."
            );
          } else if (err.name === "AbortError") {
            setError("The analysis request was cancelled. Please try again.");
          } else {
            setError(err.message || "Could not generate insights. Please try again.");
          }
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    }

    loadInsights();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [datasetId, retryKey]);

  const findings = useMemo(
    () =>
      insights.map((item, index) => ({
        ...item,
        id: item.id || `${item.type || "finding"}-${index}`,
        category: item.category || item.type || "general",
        claim: item.claim || item.description || "No finding description was provided.",
        evidence: buildEvidence(item),
      })),
    [insights]
  );

  const warningCount = findings.filter(
    (item) => item.severity === "warning"
  ).length;
  const successCount = findings.filter(
    (item) => item.severity === "success"
  ).length;

  const filteredFindings = findings.filter((item) => {
    if (filter === "all") return true;
    return item.severity === filter;
  });

  function retryAnalysis() {
    setError("");
    setRetryKey((value) => value + 1);
  }

  function toggleFinding(id) {
    setExpandedFindings((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  return (
    <div className="ai-insights-page">
      <header className="ai-insights-hero">
        <div className="ai-insights-hero-copy">
          <span className="ai-insights-eyebrow">
            <Sparkles size={14} /> INTELLIGENCE CENTER
          </span>
          <h1>AI-powered insights</h1>
          <p>
            Turn your dataset into understandable findings, evidence-backed
            checks, and actionable business recommendations.
          </p>
          <div className="ai-insights-hero-meta">
            <span><BrainCircuit size={15} /> Automated data analysis</span>
            <span><ShieldCheck size={15} /> Evidence-based findings</span>
          </div>
        </div>

        <div className="ai-insights-hero-art" aria-hidden="true">
          <div className="ai-insights-orbit orbit-one" />
          <div className="ai-insights-orbit orbit-two" />
          <div className="ai-insights-brain"><BrainCircuit size={48} /></div>
          <Sparkles className="ai-insights-sparkle sparkle-one" size={22} />
          <Sparkles className="ai-insights-sparkle sparkle-two" size={15} />
        </div>
      </header>

      {error && (
        <div className="ai-insights-error panel" role="alert">
          <AlertCircle size={20} />
          <p>{error}</p>
          <button
            type="button"
            className="ai-insights-retry-button"
            onClick={retryAnalysis}
            disabled={loadingDatasets}
          >
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      )}

      <section className="ai-insights-selector panel">
        <div className="ai-insights-selector-copy">
          <span className="ai-insights-selector-icon"><Database size={20} /></span>
          <div>
            <h2>Choose your dataset</h2>
            <p>Select an uploaded CSV file to generate its insights.</p>
          </div>
        </div>

        <select
          aria-label="Select dataset for AI insights"
          value={datasetId}
          onChange={(event) => {
            setDatasetId(event.target.value);
            setError("");
            setFilter("all");
          }}
          disabled={loadingDatasets || datasets.length === 0}
        >
          <option value="">
            {loadingDatasets
              ? "Loading datasets..."
              : datasets.length
                ? "Choose a dataset"
                : "No datasets available"}
          </option>
          {datasets.map((dataset) => (
            <option key={dataset.id} value={String(dataset.id)}>
              {dataset.filename}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="ai-insights-refresh-button"
          onClick={retryAnalysis}
          disabled={!datasetId || loading || loadingDatasets}
          aria-label="Refresh insights"
          title="Refresh insights"
        >
          <RefreshCw size={17} />
        </button>
      </section>

      {loading && datasetId && (
        <div className="ai-insights-current-dataset" aria-live="polite">
          <span className="ai-insights-dataset-dot" />
          Analyzing <strong>{datasets.find((item) => String(item.id) === datasetId)?.filename || "selected dataset"}</strong>
        </div>
      )}

      {/* Loading state is shown only while the request is actually pending. */}
      {loading && datasetId && (
        <div className="ai-insights-state panel" aria-live="polite">
          <span className="ai-insights-loading-icon">
            <LoaderCircle size={28} className="ai-insights-spin" />
          </span>
          <h2>Analyzing your dataset</h2>
          <p>
            Checking data quality, duplicate records, numeric summaries, and
            potential outliers. A sleeping backend may need a brief warm-up.
          </p>
        </div>
      )}

      {/* Dataset results appear after a successful response. */}
      {!loading && !error && datasetId && (
        <>
          {filename && (
            <div className="ai-insights-current-dataset">
              <span className="ai-insights-dataset-dot" />
              Showing findings for <strong>{filename}</strong>
            </div>
          )}

          <section className="ai-insights-metrics">
            <article className="ai-insights-metric">
              <div className="ai-insights-metric-top">
                <span className="ai-insights-metric-icon indigo"><FileSearch size={20} /></span>
                <span className="ai-insights-metric-caption">TOTAL FINDINGS</span>
              </div>
              <strong>{findings.length}</strong>
              <p>Evidence-based findings</p>
            </article>

            <article className="ai-insights-metric">
              <div className="ai-insights-metric-top">
                <span className="ai-insights-metric-icon amber"><TriangleAlert size={20} /></span>
                <span className="ai-insights-metric-caption">ATTENTION</span>
              </div>
              <strong>{warningCount}</strong>
              <p>Findings requiring review</p>
            </article>

            <article className="ai-insights-metric">
              <div className="ai-insights-metric-top">
                <span className="ai-insights-metric-icon green"><CheckCircle2 size={20} /></span>
                <span className="ai-insights-metric-caption">POSITIVE CHECKS</span>
              </div>
              <strong>{successCount}</strong>
              <p>Checks passed</p>
            </article>
          </section>

          <section className="ai-insights-summary panel">
            <div className="ai-insights-summary-heading">
              <span className="ai-insights-summary-icon"><BrainCircuit size={22} /></span>
              <div>
                <span className="ai-insights-eyebrow">ANALYSIS ENGINE</span>
                <h2>Analysis summary</h2>
              </div>
              <span className="ai-insights-ai-status available"><span /> Evidence analysis</span>
            </div>
            <p className="ai-insights-summary-text">
              The fast analysis checks dataset structure, missing values,
              duplicate records, numeric distributions, and potential outliers.
              For generated executive explanations, open the separate InsightTrace AI page.
            </p>
            <div className="ai-insights-fallback-note">
              <Info size={16} />
              <span>
                These findings are calculated from the dataset. Review the supporting
                evidence and business context before acting on a recommendation.
              </span>
            </div>
          </section>

          <div className="ai-insights-section-heading">
            <div>
              <span className="ai-insights-eyebrow">YOUR ANALYSIS</span>
              <h2>Findings &amp; recommendations</h2>
              <p>Expand a finding to inspect its available supporting evidence.</p>
            </div>
            <span className="ai-insights-result-count">
              {filteredFindings.length} of {findings.length} findings
            </span>
          </div>

          <div className="ai-insights-filters">
            {[
              { value: "all", label: "All findings" },
              { value: "warning", label: "Needs attention" },
              { value: "success", label: "Passed checks" },
              { value: "info", label: "Informational" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={`ai-insights-filter ${filter === option.value ? "active" : ""}`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {filteredFindings.length > 0 ? (
            <section className="ai-insights-grid">
              {filteredFindings.map((item, index) => {
                const severity = getSeverity(item.severity);
                const expanded = Boolean(expandedFindings[item.id]);
                const evidenceEntries = Object.entries(item.evidence || {});

                return (
                  <article
                    className={`ai-insight-card severity-${severity}`}
                    key={item.id}
                  >
                    <div className="ai-insight-card-top">
                      <span className={`ai-insight-type-icon ${severity}`}>
                        {getFindingIcon(item.category)}
                      </span>
                      <span className={`ai-insight-severity ${severity}`}>
                        <span /> {item.severity || "info"}
                      </span>
                    </div>

                    <span className="ai-insight-index">
                      FINDING {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3>{item.title || "Data finding"}</h3>
                    <p className="ai-insight-description">{item.claim}</p>

                    <div className="ai-insight-recommendation">
                      <span className="ai-insight-recommendation-icon"><Target size={17} /></span>
                      <div>
                        <strong>Recommended action</strong>
                        <p>{item.recommendation || "Review this finding in the context of your business objective."}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="ai-insight-evidence-toggle"
                      onClick={() => toggleFinding(item.id)}
                      aria-expanded={expanded}
                    >
                      <span><FileSearch size={16} /> View supporting evidence</span>
                      {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                    </button>

                    {expanded && (
                      <div className="ai-insight-evidence">
                        {evidenceEntries.length > 0 ? (
                          evidenceEntries.map(([key, value]) => (
                            <div className="ai-insight-evidence-row" key={key}>
                              <span>{key.replaceAll("_", " ")}</span>
                              {typeof value === "object" && value !== null ? (
                                <pre>{formatValue(value)}</pre>
                              ) : (
                                <strong>{formatValue(value)}</strong>
                              )}
                            </div>
                          ))
                        ) : (
                          <p>No additional supporting evidence was returned for this finding.</p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          ) : (
            <div className="ai-insights-state panel">
              <span className="ai-insights-state-icon"><FileSearch size={27} /></span>
              <h2>No findings in this filter</h2>
              <p>Try another filter to see more results.</p>
              <button type="button" className="ai-insights-retry-button" onClick={() => setFilter("all")}>
                Show all findings <ArrowRight size={15} />
              </button>
            </div>
          )}

          {findings.length > 0 && (
            <div className="ai-insights-footer-note">
              <Lightbulb size={17} />
              <p>
                Findings are generated by the dataset analysis engine. Potential
                outliers are statistical flags, not necessarily data errors.
                Validate results against your business context.
              </p>
            </div>
          )}
        </>
      )}

      {!loading && !error && !datasetId && !loadingDatasets && (
        <div className="ai-insights-state panel">
          <span className="ai-insights-state-icon"><Database size={27} /></span>
          <h2>Your insights start with a dataset</h2>
          <p>Select a dataset above to view its findings and recommendations.</p>
          {datasets.length === 0 && (
            <p className="ai-insights-state-hint">Upload a CSV file from the Datasets page to get started.</p>
          )}
        </div>
      )}

      {loadingDatasets && (
        <div className="ai-insights-state panel" aria-live="polite">
          <LoaderCircle size={25} className="ai-insights-spin" />
          <h2>Loading datasets</h2>
          <p>Retrieving your dataset library.</p>
        </div>
      )}
    </div>
  );
}

export default AIInsights;
