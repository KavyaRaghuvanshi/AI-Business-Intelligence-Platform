
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


function AIInsights() {
  const [datasets, setDatasets] = useState([]);
  const [datasetId, setDatasetId] = useState("");
  const [trace, setTrace] = useState(null);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [expandedFindings, setExpandedFindings] = useState({});
  const [filter, setFilter] = useState("all");

  const findings = Array.isArray(trace?.findings)
    ? trace.findings
    : [];

  const ai = trace?.ai || {};
  const filename = trace?.filename || "";

  // Load the available datasets.
  useEffect(() => {
    let cancelled = false;

    async function loadDatasets() {
      setLoadingDatasets(true);

      try {
        const response = await fetch(`${API}/datasets`);

        if (!response.ok) {
          throw new Error("Could not load datasets.");
        }

        const result = await response.json();

        if (!cancelled) {
          const list = Array.isArray(result) ? result : [];
          setDatasets(list);

          // Select the first dataset automatically.
          setDatasetId((currentId) => {
            if (currentId && list.some(
              (item) => String(item.id) === currentId
            )) {
              return currentId;
            }

            return list.length ? String(list[0].id) : "";
          });
        }
      } catch {
        if (!cancelled) {
          setError(
            "Could not load datasets. Check your backend connection."
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
  }, []);

  // Fetch evidence and AI explanations from the existing endpoint.
  useEffect(() => {
    if (!datasetId) {
  return;
}

    let cancelled = false;

    async function loadInsights() {
      setLoading(true);
      setError("");
      setTrace(null);
      setExpandedFindings({});

      try {
        const response = await fetch(
          `${API}/datasets/${datasetId}/insighttrace`
        );

        if (!response.ok) {
          let message = "Could not analyze this dataset.";

          try {
            const body = await response.json();
            if (body.detail) message = body.detail;
          } catch {
            // Use the default message if the response isn't JSON.
          }

          throw new Error(message);
        }

        const result = await response.json();

        if (!cancelled) {
          setTrace(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message ||
            "Could not generate insights. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInsights();

    return () => {
      cancelled = true;
    };
  }, [datasetId, retryKey]);

  // Match each AI explanation to its evidence-based finding.
  const explanationMap = useMemo(() => {
    const map = {};

    if (Array.isArray(ai.explanations)) {
      ai.explanations.forEach((item) => {
        if (item.finding_id) {
          map[item.finding_id] = item;
        }
      });
    }

    return map;
  }, [ai.explanations]);

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

  function getFindingIcon(category) {
    if (category === "data_quality") {
      return <ShieldCheck size={21} />;
    }

    if (category === "numeric_analysis") {
      return <ChartNoAxesCombined size={21} />;
    }

    if (category === "outlier_detection") {
      return <TriangleAlert size={21} />;
    }

    if (category === "overview") {
      return <Database size={21} />;
    }

    return <Lightbulb size={21} />;
  }

  function getSeverity(severity) {
    if (severity === "warning") return "warning";
    if (severity === "success") return "success";
    return "info";
  }

  function toggleFinding(id) {
    setExpandedFindings((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function formatValue(value) {
    if (value === null || value === undefined) {
      return "Not available";
    }

    if (typeof value === "number") {
      return Number.isInteger(value)
        ? value.toLocaleString()
        : value.toLocaleString(undefined, {
            maximumFractionDigits: 4,
          });
    }

    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  }

  return (
    <div className="ai-insights-page">
      {/* Hero */}
      <header className="ai-insights-hero">
        <div className="ai-insights-hero-copy">
          <span className="ai-insights-eyebrow">
            <Sparkles size={14} />
            INTELLIGENCE CENTER
          </span>

          <h1>AI-powered insights</h1>

          <p>
            Turn your dataset into understandable findings,
            evidence-backed explanations, and actionable business
            recommendations.
          </p>

          <div className="ai-insights-hero-meta">
            <span>
              <BrainCircuit size={15} />
              AI-assisted analysis
            </span>
            <span>
              <ShieldCheck size={15} />
              Evidence-based findings
            </span>
          </div>
        </div>

        <div className="ai-insights-hero-art" aria-hidden="true">
          <div className="ai-insights-orbit orbit-one" />
          <div className="ai-insights-orbit orbit-two" />

          <div className="ai-insights-brain">
            <BrainCircuit size={48} />
          </div>

          <Sparkles
            className="ai-insights-sparkle sparkle-one"
            size={22}
          />
          <Sparkles
            className="ai-insights-sparkle sparkle-two"
            size={15}
          />
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="ai-insights-error panel" role="alert">
          <AlertCircle size={20} />

          <p>{error}</p>

          <button
            className="ai-insights-retry-button"
            onClick={() => {
              setError("");
              setRetryKey((value) => value + 1);
            }}
          >
            <RefreshCw size={15} />
            Retry
          </button>
        </div>
      )}

      {/* Dataset selector */}
      <section className="ai-insights-selector panel">
        <div className="ai-insights-selector-copy">
          <span className="ai-insights-selector-icon">
            <Database size={20} />
          </span>

          <div>
            <h2>Choose your dataset</h2>
            <p>
              Select an uploaded CSV file to generate its insights.
            </p>
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
          onClick={() => setRetryKey((value) => value + 1)}
          disabled={!datasetId || loading}
          aria-label="Refresh insights"
          title="Refresh insights"
        >
          <RefreshCw size={17} />
        </button>
      </section>

      {loading && datasetId && (
        <div className="ai-insights-current-dataset">
          <span className="ai-insights-dataset-dot" />
          Analyzing <strong>{filename}</strong>
        </div>
      )}

      {/* Loading */}
      {!loading && !error && datasetId && trace && (
        <div className="ai-insights-state panel" aria-live="polite">
          <span className="ai-insights-loading-icon">
            <LoaderCircle size={28} className="ai-insights-spin" />
          </span>

          <h2>Analyzing your dataset</h2>
          <p>
            Examining the data, collecting evidence, and preparing
            explanations where AI is available.
          </p>
        </div>
      )}

      {/* Main results */}
      {!error && !datasetId && (
        <>
          {/* Metrics */}
          <section className="ai-insights-metrics">
            <article className="ai-insights-metric">
              <div className="ai-insights-metric-top">
                <span className="ai-insights-metric-icon indigo">
                  <FileSearch size={20} />
                </span>
                <span className="ai-insights-metric-caption">
                  TOTAL FINDINGS
                </span>
              </div>

              <strong>{findings.length}</strong>
              <p>Evidence-based findings</p>
            </article>

            <article className="ai-insights-metric">
              <div className="ai-insights-metric-top">
                <span className="ai-insights-metric-icon amber">
                  <TriangleAlert size={20} />
                </span>
                <span className="ai-insights-metric-caption">
                  ATTENTION
                </span>
              </div>

              <strong>{warningCount}</strong>
              <p>Findings requiring review</p>
            </article>

            <article className="ai-insights-metric">
              <div className="ai-insights-metric-top">
                <span className="ai-insights-metric-icon green">
                  <CheckCircle2 size={20} />
                </span>
                <span className="ai-insights-metric-caption">
                  POSITIVE CHECKS
                </span>
              </div>

              <strong>{successCount}</strong>
              <p>Checks passed</p>
            </article>
          </section>

          {/* AI summary */}
          <section className="ai-insights-summary panel">
            <div className="ai-insights-summary-heading">
              <span className="ai-insights-summary-icon">
                <BrainCircuit size={22} />
              </span>

              <div>
                <span className="ai-insights-eyebrow">
                  AI ANALYST
                </span>
                <h2>Executive summary</h2>
              </div>

              <span
                className={`ai-insights-ai-status ${
                  ai.available ? "available" : "unavailable"
                }`}
              >
                <span />
                {ai.available ? "AI explanation available" : "Evidence mode"}
              </span>
            </div>

            {ai.summary ? (
              <p className="ai-insights-summary-text">
                {ai.summary}
              </p>
            ) : (
              <p className="ai-insights-summary-text">
                {ai.message ||
                  "Evidence-based findings are available below. Configure your AI provider to enable generated explanations."}
              </p>
            )}

            {!ai.available && (
              <div className="ai-insights-fallback-note">
                <Info size={16} />
                <span>
                  AI explanations are unavailable for this request.
                  Findings below are generated from the dataset using
                  your analysis rules.
                </span>
              </div>
            )}
          </section>

          {/* Findings heading and filters */}
          <div className="ai-insights-section-heading">
            <div>
              <span className="ai-insights-eyebrow">
                YOUR ANALYSIS
              </span>
              <h2>Findings &amp; recommendations</h2>
              <p>
                Expand a finding to inspect its evidence, AI explanation,
                and recommended business action.
              </p>
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
                className={`ai-insights-filter ${
                  filter === option.value ? "active" : ""
                }`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Finding cards */}
          {filteredFindings.length > 0 ? (
            <section className="ai-insights-grid">
              {filteredFindings.map((item, index) => {
                const severity = getSeverity(item.severity);
                const explanation = explanationMap[item.id];
                const expanded = Boolean(expandedFindings[item.id]);

                return (
                  <article
                    className={`ai-insight-card severity-${severity}`}
                    key={item.id || `${item.category}-${index}`}
                  >
                    <div className="ai-insight-card-top">
                      <span className={`ai-insight-type-icon ${severity}`}>
                        {getFindingIcon(item.category)}
                      </span>

                      <span className={`ai-insight-severity ${severity}`}>
                        <span />
                        {item.severity || "info"}
                      </span>
                    </div>

                    <span className="ai-insight-index">
                      FINDING {String(index + 1).padStart(2, "0")}
                    </span>

                    <h3>{item.title || "Data finding"}</h3>

                    <p className="ai-insight-description">
                      {item.claim || "No finding description was provided."}
                    </p>

                    <div className="ai-insight-recommendation">
                      <span className="ai-insight-recommendation-icon">
                        <Target size={17} />
                      </span>

                      <div>
                        <strong>Recommended action</strong>
                        <p>
                          {explanation?.business_action ||
                            item.recommendation ||
                            "Review this finding to determine the appropriate next step."}
                        </p>
                      </div>
                    </div>

                    {explanation?.explanation && (
                      <div className="ai-insight-ai-explanation">
                        <div className="ai-insight-ai-explanation-title">
                          <Sparkles size={16} />
                          <strong>AI explanation</strong>
                        </div>

                        <p>{explanation.explanation}</p>
                      </div>
                    )}

                    <button
                      type="button"
                      className="ai-insight-evidence-toggle"
                      onClick={() => toggleFinding(item.id || index)}
                      aria-expanded={expanded}
                    >
                      <span>
                        <FileSearch size={16} />
                        View supporting evidence
                      </span>

                      {expanded ? (
                        <ChevronUp size={17} />
                      ) : (
                        <ChevronDown size={17} />
                      )}
                    </button>

                    {expanded && (
                      <div className="ai-insight-evidence">
                        {item.evidence &&
                        Object.keys(item.evidence).length > 0 ? (
                          Object.entries(item.evidence).map(
                            ([key, value]) => (
                              <div
                                className="ai-insight-evidence-row"
                                key={key}
                              >
                                <span>
                                  {key.replaceAll("_", " ")}
                                </span>

                                {typeof value === "object" &&
                                value !== null ? (
                                  <pre>{formatValue(value)}</pre>
                                ) : (
                                  <strong>{formatValue(value)}</strong>
                                )}
                              </div>
                            )
                          )
                        ) : (
                          <p>No supporting evidence was returned.</p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          ) : (
            <div className="ai-insights-state panel">
              <span className="ai-insights-state-icon">
                <FileSearch size={27} />
              </span>

              <h2>No findings in this filter</h2>
              <p>Try another filter to see more results.</p>

              <button
                type="button"
                className="ai-insights-retry-button"
                onClick={() => setFilter("all")}
              >
                Show all findings
                <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* AI explanation coverage */}
          {findings.length > 0 && (
            <div className="ai-insights-footer-note">
              <Lightbulb size={17} />
              <p>
                Findings come from your dataset analysis engine. AI
                explanations are shown only when a returned explanation
                matches the finding ID. Always verify recommendations
                against your business context.
              </p>
            </div>
          )}
        </>
      )}

      {/* No dataset selected */}
      {!loading && !error && !datasetId && (
        <div className="ai-insights-state panel">
          <span className="ai-insights-state-icon">
            <Database size={27} />
          </span>

          <h2>Your insights start with a dataset</h2>
          <p>
            Select a dataset above to view its findings and AI explanations.
          </p>

          {datasets.length === 0 && !loadingDatasets && (
            <p className="ai-insights-state-hint">
              Upload a CSV file from the Datasets page to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default AIInsights;
