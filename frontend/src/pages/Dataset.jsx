
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Upload,
  Search,
  FileSpreadsheet,
  FileJson,
  Database,
  Eye,
  Download,
  RefreshCw,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Table2,
  Rows3,
  Columns3,
  ArrowUpRight,
} from "lucide-react";
import "./Dataset.css";
import { API } from "../services/api";



const demoInfo = {
  "BankCredit.csv": {
    title: "BankCredit Performance",
    description: "Explore revenue, profit, products and regional performance.",
    icon: "sales",
    color: "blue",
  },
  "Loan.csv": {
    title: "Loan Analytics",
    description: "Explore employee satisfaction and attrition patterns.",
    icon: "hr",
    color: "purple",
  },
};

function Dataset() {
  const [datasets, setDatasets] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewDataset, setPreviewDataset] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  
  const fileInput = useRef(null);


const loadDatasets = useCallback(async () => {
  try {
    const response = await fetch(`${API}/datasets`);

    if (!response.ok) {
      throw new Error("Could not load datasets.");
    }

    const data = await response.json();

    setDatasets(Array.isArray(data) ? data : []);
    setError("");
  } catch (err) {
    setError(err.message || "Unable to connect to the backend.");
  } finally {
    setLoading(false);
  }
}, []);

const prepareDemos = useCallback(async () => {
  try {
    const response = await fetch(`${API}/datasets/demo/register`, {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Could not prepare demo datasets.");
    }

    await loadDatasets();
  } catch (err) {
    setError(
      `${err.message} You can still upload your own CSV files.`
    );
  } finally {
    setRegistering(false);
  }
}, [loadDatasets]);

function refreshDatasets() {
  setLoading(true);
  setError("");
  loadDatasets();
}

function refreshDemoDatasets() {
  setRegistering(true);
  setError("");
  prepareDemos();
}

useEffect(() => {
  async function initialize() {
    await loadDatasets();
    await prepareDemos();
  }

  initialize();
}, [loadDatasets, prepareDemos]);

  const filteredDatasets = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return datasets;

    return datasets.filter((dataset) =>
      String(dataset.filename || "").toLowerCase().includes(query)
    );
  }, [datasets, search]);

  const demos = datasets.filter((dataset) =>
    Object.prototype.hasOwnProperty.call(demoInfo, dataset.filename)
  );

  async function uploadDataset(event) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Please select a CSV file first.");
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Only CSV files are supported.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API}/datasets/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Dataset upload failed.");
      }

      setMessage(`${selectedFile.name} uploaded successfully.`);
      setSelectedFile(null);

      if (fileInput.current) fileInput.current.value = "";

      await loadDatasets();
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function openPreview(dataset) {
    setPreviewDataset(dataset);
    setPreviewData(null);
    setPreviewError("");
    setPreviewLoading(true);

    try {
      const response = await fetch(
        `${API}/datasets/${dataset.id}/preview`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not load dataset preview.");
      }

      setPreviewData(data);
    } catch (err) {
      setPreviewError(err.message || "Preview failed.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewDataset(null);
    setPreviewData(null);
    setPreviewError("");
  }


  async function downloadFile(url, filename, type) {
    const key = `${type}-${filename}`;

    setDownloading((previous) => ({
      ...previous,
      [key]: true,
    }));

    setError("");
    setMessage("");

    try {
      const response = await fetch(url);

      if (!response.ok) {
        let errorMessage = "Download failed.";

        try {
          const data = await response.json();
          errorMessage = data.detail || errorMessage;
        } catch {
          // Keep the default error message.
        }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      setMessage(`${filename} downloaded successfully.`);
    } catch (err) {
      setError(err.message || "Unable to download the file.");
    } finally {
      setDownloading((previous) => ({
        ...previous,
        [key]: false,
      }));
    }
  }

  function downloadSampleCSV(dataset) {
    return downloadFile(
      `${API}/datasets/${dataset.id}/export/csv`,
      dataset.filename || `dataset-${dataset.id}.csv`,
      "csv"
    );
  }

  function downloadAnalysisJSON(dataset) {
    const filename = `${
      (dataset.filename || `dataset-${dataset.id}`).replace(/\.csv$/i, "")
    }-analysis.json`;

    return downloadFile(
      `${API}/datasets/${dataset.id}/analysis`,
      filename,
      "json"
    );
  }


  return (
    <div className="dataset-workspace">
      <section className="dataset-hero">
        <div className="dataset-hero-copy">
          <div className="dataset-eyebrow">
            <Database size={14} />
            DATA WORKSPACE
          </div>
          <h1>Your data, ready to explore.</h1>
          <p>
            Upload your own datasets or start with a demo to explore
            analytics and AI-powered insights.
          </p>
        </div>

        <div className="dataset-hero-art" aria-hidden="true">
          <div className="hero-art-circle circle-one" />
          <div className="hero-art-circle circle-two" />
          <FileSpreadsheet size={64} strokeWidth={1.2} />
          <Sparkles className="hero-art-sparkle" size={24} />
        </div>
      </section>

      {error && (
        <div className="dataset-notice error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}

      {message && (
        <div className="dataset-notice success">
          <CheckCircle2 size={18} />
          <span>{message}</span>
          <button onClick={() => setMessage("")} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      )}

      <section className="upload-section">
        <div className="section-heading">
          <div>
            <h2>Upload a dataset</h2>
            <p>Bring your own CSV file into your workspace.</p>
          </div>
          <span className="supported-format">CSV files only</span>
        </div>

        <form className="dataset-upload-box" onSubmit={uploadDataset}>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) =>
              setSelectedFile(event.target.files?.[0] || null)
            }
          />

          <div className="upload-icon-wrap">
            <Upload size={23} />
          </div>

          <div className="upload-copy">
            <strong>
              {selectedFile ? selectedFile.name : "Choose a CSV file to upload"}
            </strong>
            <span>
              {selectedFile
                ? `${(selectedFile.size / 1024).toFixed(1)} KB selected`
                : "Select a file from your computer to get started."}
            </span>
          </div>

          <button
            type="button"
            className="dataset-secondary-button"
            onClick={() => fileInput.current?.click()}
          >
            Browse files
          </button>

          <button
            type="submit"
            className="dataset-primary-button"
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>
                <LoaderCircle size={16} className="spin" />
                Uploading
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload dataset
              </>
            )}
          </button>
        </form>
      </section>

      <section className="demo-section">
        <div className="section-heading">
          <div>
            <div className="heading-with-sparkle">
              <h2>Try a demo dataset</h2>
              <Sparkles size={17} />
            </div>
            <p>
              Explore sample business data without uploading a file.
            </p>
          </div>

          <span className="demo-count">
            {demos.length} of 2 available
          </span>
        </div>

        <div className="demo-grid">
          {[
            {
              filename: "BankCredit.csv",
              title: "Bank Credit Performance",
              description:
                "Explore revenue, profit, product categories and regional sales.",
              color: "blue",
              icon: <Rows3 size={23} />,
              tags: ["Revenue", "Products", "Regions"],
            },
            {
              filename: "Loan.csv",
              title: "Loan Analytics",
              description:
                "Explore workforce data, employee satisfaction and attrition.",
              color: "purple",
              icon: <Database size={23} />,
              tags: ["Employees", "Satisfaction", "Attrition"],
            },
          ].map((demo) => {
            const registered = demos.find(
              (dataset) => dataset.filename === demo.filename
            );

            return (
              <article className="demo-card" key={demo.filename}>
                <div className="demo-card-top">
                  <div className={`demo-file-icon ${demo.color}`}>
                    {demo.icon}
                  </div>
                  <span className="demo-label">
                    <span /> SAMPLE DATA
                  </span>
                </div>

                <h3>{demo.title}</h3>
                <p>{demo.description}</p>

                <div className="demo-tags">
                  {demo.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>

                <div className="demo-card-footer">
                  <span>
                    <FileSpreadsheet size={14} />
                    {demo.filename}
                  </span>

                  <button
                    className="demo-open-button"
                    disabled={!registered}
                    onClick={() => openPreview(registered)}
                    title={
                      registered
                        ? "Preview this dataset"
                        : "Waiting for demo registration"
                    }
                  >
                    {registered ? "Explore data" : "Preparing…"}
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {registering && (
          <p className="dataset-helper">
            <LoaderCircle size={14} className="spin" />
            Preparing demo datasets…
          </p>
        )}

        {!registering && demos.length < 2 && !error && (
          <button
            className="dataset-link-button"
            onClick={refreshDemoDatasets}
          >
            <RefreshCw size={14} />
            
            Refresh demo datasets
          </button>
        )}
      </section>

      <section className="all-datasets-section">
        <div className="section-heading">
          <div>
            <h2>Your dataset library</h2>
            <p>All uploaded and registered datasets in one place.</p>
          </div>
          <span className="dataset-total">
            {datasets.length} datasets
          </span>
        </div>

        <div className="dataset-library-toolbar">
          <div className="dataset-search">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search datasets by filename…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <button
            className="dataset-secondary-button refresh-button"
            onClick={refreshDatasets}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="dataset-library-empty">
            <LoaderCircle size={24} className="spin" />
            <p>Loading your dataset library…</p>
          </div>
        ) : filteredDatasets.length === 0 ? (
          <div className="dataset-library-empty">
            <Database size={27} />
            <h3>No matching datasets</h3>
            <p>Try another search or upload a CSV file.</p>
          </div>
        ) : (
          <div className="dataset-table-wrap">
            <table className="dataset-table">
              <thead>
                <tr>
                  <th>DATASET</th>
                  <th>TYPE</th>
                  <th>DATE ADDED</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredDatasets.map((dataset) => {
                  const demo = demoInfo[dataset.filename];

                  return (
                    <tr key={dataset.id}>
                      <td>
                        <div className="library-file">
                          <span className="library-file-icon">
                            <FileSpreadsheet size={18} />
                          </span>
                          <span>
                            <strong>
                              {demo?.title || dataset.filename}
                            </strong>
                            <small>{dataset.filename}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="file-type-pill">CSV</span>
                      </td>
                      <td>
                        {dataset.uploaded_at
                          ? new Date(
                              dataset.uploaded_at
                            ).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <span className="dataset-status">
                          <span /> Available
                        </span>
                      </td>
                      <td>
                       
  <div className="dataset-actions">
    <button
      title="Preview dataset"
      aria-label={`Preview ${dataset.filename}`}
      onClick={() => openPreview(dataset)}
    >
      <Eye size={16} />
    </button>

    <button
      title="Download complete CSV"
      aria-label={`Download CSV for ${dataset.filename}`}
      disabled={Boolean(downloading[`csv-${dataset.filename || `dataset-${dataset.id}.csv`}`])}
      onClick={() => downloadSampleCSV(dataset)}
    >
      {downloading[`csv-${dataset.filename || `dataset-${dataset.id}.csv`}`] ? (
        <LoaderCircle size={16} className="spin" />
      ) : (
        <Download size={16} />
      )}
    </button>

    <button
      title="Download analysis report as JSON"
      aria-label={`Download analysis report for ${dataset.filename}`}
      disabled={Boolean(
        downloading[
          `json-${(
            dataset.filename || `dataset-${dataset.id}`
          ).replace(/\.csv$/i, "")}-analysis.json`
        ]
      )}
      onClick={() => downloadAnalysisJSON(dataset)}
    >
      {downloading[
        `json-${(
          dataset.filename || `dataset-${dataset.id}`
        ).replace(/\.csv$/i, "")}-analysis.json`
      ] ? (
        <LoaderCircle size={16} className="spin" />
      ) : (
        <FileJson size={16} />
      )}
    </button>
  </div>

                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {previewDataset && (
        <div
          className="dataset-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
        >
          <section
            className="dataset-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dataset-preview-title"
          >
            <div className="preview-modal-header">
              <div>
                <span className="dataset-eyebrow">
                  <Table2 size={14} />
                  DATASET PREVIEW
                </span>
                <h2 id="dataset-preview-title">
                  {previewDataset.filename}
                </h2>
              </div>
              <button
                className="preview-close-button"
                onClick={closePreview}
                aria-label="Close preview"
              >
                <X size={19} />
              </button>
            </div>

            {previewLoading ? (
              <div className="dataset-library-empty">
                <LoaderCircle size={25} className="spin" />
                <p>Loading data preview…</p>
              </div>
            ) : previewError ? (
              <div className="dataset-notice error">
                <AlertCircle size={18} />
                {previewError}
              </div>
            ) : (
              <PreviewTable data={previewData} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function getPreviewRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.preview)) return data.preview;
  return [];
}

function PreviewTable({ data }) {
  const rows = getPreviewRows(data);

  const columns = useMemo(() => {
    if (Array.isArray(data?.columns)) {
      return data.columns.map((column) =>
        typeof column === "string" ? column : column.name
      );
    }

    return rows.length ? Object.keys(rows[0]) : [];
  }, [data, rows]);

  if (!rows.length || !columns.length) {
    return (
      <div className="dataset-library-empty">
        <Table2 size={27} />
        <h3>Preview format not recognized</h3>
        <p>
          The endpoint responded, but its data format wasn't recognized.
          Check the response from your existing preview endpoint.
        </p>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    );
  }

  return (
    <>
      <div className="preview-stats">
        <span>
          <Rows3 size={15} /> {data?.total_rows ?? rows.length} rows shown
        </span>
        <span>
          <Columns3 size={15} /> {columns.length} columns
        </span>
      </div>

      <div className="dataset-table-wrap preview-table-wrap">
        <table className="dataset-table preview-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column}>
                    {row[column] == null ? "—" : String(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default Dataset;
