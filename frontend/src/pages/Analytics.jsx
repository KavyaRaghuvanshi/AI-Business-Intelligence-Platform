
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

function Analytics() {
  const [datasets, setDatasets] = useState([]);
  const [datasetId, setDatasetId] = useState("");
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [xColumn, setXColumn] = useState("");
  const [yColumn, setYColumn] = useState("");
  const [chartType, setChartType] = useState("bar");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/datasets")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load datasets");
        return response.json();
      })
      .then((result) => setDatasets(result))
      .catch(() => setMessage("Could not load datasets. Check the backend."));
  }, []);

  useEffect(() => {
    if (!datasetId) {
      setData([]);
      setColumns([]);
      return;
    }

    fetch(`http://127.0.0.1:8000/datasets/${datasetId}/preview`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load dataset");
        return response.json();
      })
      .then((result) => {
        const rows = result.preview || [];
        const availableColumns = result.columns || [];

        setData(rows);
        setColumns(availableColumns);
        setXColumn(availableColumns[0] || "");

        const numericColumn = availableColumns.find((column) =>
          rows.some(
            (row) =>
              row[column] !== null &&
              row[column] !== "" &&
              Number.isFinite(Number(row[column]))
          )
        );

        setYColumn(numericColumn || availableColumns[1] || "");
        setMessage("");
      })
      .catch(() => setMessage("Could not load this dataset's data."));
  }, [datasetId]);

  const chartData = data.reduce((result, row) => {
    const label = String(row[xColumn] ?? "Unknown");
    const value = Number(row[yColumn]);

    if (chartType === "pie") {
      const existing = result.find((item) => item.name === label);
      if (existing) {
        existing.value += Number.isFinite(value) ? value : 1;
      } else {
        result.push({
          name: label,
          value: Number.isFinite(value) && row[yColumn] !== "" ? value : 1,
        });
      }
    } else {
      result.push({
        name: label,
        value: Number.isFinite(value) && row[yColumn] !== "" ? value : 0,
      });
    }

    return result;
  }, []);

  const colors = [
    "#6366f1",
    "#14b8a6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#0ea5e9",
  ];

  return (
    <div style={{ padding: "24px" }}>
      <h1>Interactive Analytics</h1>
      <p>Explore your uploaded datasets through interactive charts.</p>

      {message && <p style={{ color: "#f87171" }}>{message}</p>}

      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          margin: "20px 0",
        }}
      >
        <select
          value={datasetId}
          onChange={(event) => setDatasetId(event.target.value)}
          style={{ padding: "10px", minWidth: "180px" }}
        >
          <option value="">Select a dataset</option>
          {datasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.filename}
            </option>
          ))}
        </select>

        <select
          value={chartType}
          onChange={(event) => setChartType(event.target.value)}
          style={{ padding: "10px" }}
        >
          <option value="bar">Bar Chart</option>
          <option value="line">Line Chart</option>
          <option value="pie">Pie Chart</option>
        </select>

        <select
          value={xColumn}
          onChange={(event) => setXColumn(event.target.value)}
          style={{ padding: "10px", minWidth: "150px" }}
        >
          {columns.map((column) => (
            <option key={column} value={column}>
              X-axis: {column}
            </option>
          ))}
        </select>

        <select
          value={yColumn}
          onChange={(event) => setYColumn(event.target.value)}
          style={{ padding: "10px", minWidth: "150px" }}
        >
          {columns.map((column) => (
            <option key={column} value={column}>
              Y-axis: {column}
            </option>
          ))}
        </select>
      </div>

      {!datasetId && <p>Select a dataset to begin.</p>}

      {datasetId && data.length > 0 && (
        <div
          style={{
            background: "#111827",
            border: "1px solid #374151",
            borderRadius: "12px",
            padding: "20px",
            height: "420px",
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#d1d5db" />
                <YAxis stroke="#d1d5db" />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#6366f1" name={yColumn} />
              </BarChart>
            ) : chartType === "line" ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#d1d5db" />
                <YAxis stroke="#d1d5db" />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#14b8a6"
                  name={yColumn}
                />
              </LineChart>
            ) : (
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={140}
                  label
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={colors[index % colors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {datasetId && data.length === 0 && !message && (
        <p>No preview data is available for this dataset.</p>
      )}
    </div>
  );
}

export default Analytics;
