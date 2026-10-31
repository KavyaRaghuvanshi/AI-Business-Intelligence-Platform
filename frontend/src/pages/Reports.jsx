
import { useEffect, useState } from "react";
import "./Reports.css";
import { API } from "../services/api";

function Reports() {
  const [datasets, setDatasets] = useState([]);
  const [datasetId, setDatasetId] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

 

  useEffect(() => {
    fetch(`${API}/datasets`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load datasets.");
        }
        return response.json();
      })
      .then((data) => {
        setDatasets(data);

        if (data.length > 0) {
          setDatasetId(String(data[0].id));
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!datasetId) {
  return;
}

    let cancelled = false;

    async function loadReportData() {
      setLoading(true);
      setError("");
      setAnalysis(null);
      setInsights(null);

      try {
        const [analysisResponse, insightsResponse] =
          await Promise.all([
            fetch(`${API}/datasets/${datasetId}/analysis`),
            fetch(`${API}/datasets/${datasetId}/insights`),
          ]);

        if (!analysisResponse.ok) {
          throw new Error("Failed to load dataset analysis.");
        }

        if (!insightsResponse.ok) {
          throw new Error("Failed to load AI insights.");
        }

        const analysisData = await analysisResponse.json();
        const insightsData = await insightsResponse.json();

        if (!cancelled) {
          setAnalysis(analysisData);
          setInsights(insightsData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadReportData();

    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  function downloadReport() {
    if (!analysis) return;

    const report = {
      report_title: "AI Business Intelligence Report",
      dataset: datasets.find(
        (item) => String(item.id) === datasetId
      )?.filename,
      generated_at: new Date().toISOString(),
      analysis: analysis,
      ai_insights: insights,
    };

    const blob = new Blob(
      [JSON.stringify(report, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `BI_Report_${datasetId}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  
async function downloadPDF() {
  if (!analysis) return;

  const { default: jsPDF } = await import("jspdf");

  const pdf = new jsPDF();
  const filename =
    datasets.find(
      (item) => String(item.id) === datasetId
    )?.filename || "Dataset";

  pdf.setFontSize(20);
  pdf.text("AI Business Intelligence Report", 20, 20);

  pdf.setFontSize(12);
  pdf.text(`Dataset: ${filename}`, 20, 35);
  pdf.text(
    `Generated: ${new Date().toLocaleString()}`,
    20,
    45
  );

  let y = 60;

  function addSection(title, data) {
    if (y > 250) {
      pdf.addPage();
      y = 20;
    }

    pdf.setFontSize(15);
    pdf.text(title, 20, y);
    y += 10;

    pdf.setFontSize(10);

    const content = JSON.stringify(data, null, 2);
    const lines = pdf.splitTextToSize(content, 170);

    lines.forEach((line) => {
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }

      pdf.text(line, 20, y);
      y += 5;
    });

    y += 10;
  }

  addSection("Analysis Summary", analysis);
  addSection("AI Insights", insights);

  pdf.save(`BI_Report_${datasetId}.pdf`);
}

  function renderData(data) {
    if (data === null || data === undefined) {
      return "No data available";
    }

    if (typeof data === "object") {
      return (
        <pre className="report-json">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
    }

    return String(data);
  }

  return (
    <div className="reports-page">
     

      <section className="dataset-section">
        <h2>Select Dataset</h2>

        <select
          value={datasetId}
          onChange={(event) => setDatasetId(event.target.value)}
          disabled={datasets.length === 0}
        >
          {datasets.length === 0 && (
            <option value="">No datasets available</option>
          )}

          {datasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.filename}
            </option>
          ))}
        </select>

        <p>
          Available datasets: {datasets.length}
        </p>
      </section>

      {loading && datasetId && <p>Generating report...</p> }

      {error && (
        <p className="report-error">{error}</p>
      )}

      {!loading && datasetId && analysis && (
        <>
          <section className="dataset-section">
            <h2>Analysis Summary</h2>
            <p>
              Dataset:{" "}
              {datasets.find(
                (item) => String(item.id) === datasetId
              )?.filename}
            </p>

            {renderData(analysis)}
          </section>

          <section className="dataset-section">
            <h2>AI Insights</h2>
            {renderData(insights)}
          </section>

          <div className="report-actions">
  <button onClick={downloadPDF}>
    Download PDF Report
  </button>

  <button onClick={downloadReport}>
    Download JSON Report
  </button>
</div>
        </>
      )}
    </div>
  );
}



export default Reports;
