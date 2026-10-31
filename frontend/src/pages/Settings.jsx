import "./Settings.css";
import { useState } from "react";

function Settings({ theme, setTheme }) {
  const [notifications, setNotifications] = useState(
    localStorage.getItem("notifications") !== "false"
  );

  const [message, setMessage] = useState("");

  function saveSettings() {
    localStorage.setItem("theme", theme);
    localStorage.setItem("notifications", String(notifications));
    setMessage("Settings saved successfully!");
  }

  return (
    <div className="settings-page">
      

      <section className="dataset-section">
        <h2>Appearance</h2>
        <p>Select your preferred theme.</p>

        <label>
          <input
            type="radio"
            name="theme"
            checked={theme === "light"}
            onChange={() => {
              setTheme("light");
              setMessage("");
            }}
          />
          Light Mode
        </label>

        <br />

        <label>
          <input
            type="radio"
            name="theme"
            checked={theme === "dark"}
            onChange={() => {
              setTheme("dark");
              setMessage("");
            }}
          />
          Dark Mode
        </label>
      </section>

      <section className="dataset-section">
        <h2>Notifications</h2>
        <p>Manage your notification preference.</p>

        <label>
          <input
            type="checkbox"
            checked={notifications}
            onChange={(e) => setNotifications(e.target.checked)}
          />
          Enable notifications preference
        </label>
      </section>

      <section className="dataset-section">
        <h2>Workspace Information</h2>
        <p>AI Business Intelligence Platform</p>
        <p>Analyze datasets, explore AI insights, and prepare reports.</p>
      </section>

      <button onClick={saveSettings}>Save Settings</button>

      {message && <p>{message}</p>}
    </div>
  );
}

export default Settings;
