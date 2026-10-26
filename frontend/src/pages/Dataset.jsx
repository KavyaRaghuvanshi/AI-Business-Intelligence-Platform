
import { useEffect, useState } from "react";

function Datasets() {
  const [datasets, setDatasets] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const API = "http://127.0.0.1:8000";

  const fetchDatasets = async () => {
    try {
      const response = await fetch(`${API}/datasets`);
      if (!response.ok) throw new Error("Failed to fetch datasets");

      const data = await response.json();
      setDatasets(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage("Please select a CSV file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API}/datasets/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Upload failed");
      }

      setMessage("Dataset uploaded successfully!");
      setSelectedFile(null);
      await fetchDatasets();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (id) => {
    try {
      const response = await fetch(`${API}/datasets/${id}/preview`);
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Preview failed");
      }

      setPreview(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Datasets</h1>
          <p>Manage your uploaded business datasets</p>
        </div>
      </div>

      <div className="dataset-card">
        <h2>Upload Dataset</h2>

        <input
          type="file"
          accept=".csv"
          onChange={(e) => setSelectedFile(e.target.files[0])}
        />

        <button onClick={handleUpload} disabled={loading}>
          {loading ? "Uploading..." : "Upload CSV"}
        </button>

        {message && <p>{message}</p>}
      </div>

      <div className="dataset-card">
        <h2>Uploaded Datasets</h2>

        {datasets.length === 0 ? (
          <p>No datasets uploaded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Dataset</th>
                <th>Uploaded</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {datasets.map((dataset) => (
                <tr key={dataset.id}>
                  <td>{dataset.id}</td>
                  <td>{dataset.filename}</td>
                  <td>
                    {dataset.uploaded_at
                      ? new Date(dataset.uploaded_at).toLocaleString()
                      : "Not available"}
                  </td>
                  <td>
                    <button
                      className="view-btn"
                      onClick={() => handlePreview(dataset.id)}
                    >
                      Preview
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {preview && (
        <div className="dataset-card">
          <div className="section-header">
            <h2>Preview: {preview.filename}</h2>
            <button onClick={() => setPreview(null)}>Close</button>
          </div>

          <p>Total rows: {preview.rows}</p>
          <p>Columns: {preview.columns.join(", ")}</p>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  {preview.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {preview.preview.map((row, index) => (
                  <tr key={index}>
                    {preview.columns.map((column) => (
                      <td key={column}>
                        {String(row[column] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Datasets;