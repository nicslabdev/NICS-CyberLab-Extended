const API_BASE = "/api/ciberia";

document.addEventListener("DOMContentLoaded", () => {
  const feedbackEl = document.getElementById("global-feedback");

  function setFeedback(message, kind = "idle") {
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
    feedbackEl.className = `feedback ${kind}`;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }

  function renderSummary(containerId, summary) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!summary) {
      el.innerHTML = "";
      return;
    }

    const entries = Object.entries(summary)
      .map(([k, v]) => `<div><strong>${k}</strong>: ${v}</div>`)
      .join("");

    el.innerHTML = `<div class="summary">${entries}</div>`;
  }

  function renderTable(containerId, rows, limit = 50) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!rows || rows.length === 0) {
      el.innerHTML = "";
      return;
    }

    const data = rows.slice(0, limit);
    const cols = Object.keys(data[0]);

    const head = cols.map(c => `<th>${c}</th>`).join("");
    const body = data.map(row => {
      const cells = cols.map(c => {
        const val = typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c];
        return `<td>${val}</td>`;
      }).join("");
      return `<tr>${cells}</tr>`;
    }).join("");

    el.innerHTML = `
      <div class="small">Showing ${data.length} rows</div>
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    `;
  }

  function setButtonsDisabled(disabled) {
    document.querySelectorAll("button").forEach(btn => {
      btn.disabled = disabled;
    });
  }

  async function jsonRequest(url, options = {}, startMessage = "Executing request...") {
    setFeedback(startMessage, "running");
    setButtonsDisabled(true);

    try {
      const res = await fetch(url, options);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      setFeedback("Operation completed successfully.", "success");
      return data;
    } catch (e) {
      setFeedback(`Operation failed: ${e.message}`, "error");
      throw e;
    } finally {
      setButtonsDisabled(false);
    }
  }

  async function formRequest(url, fileInput, startMessage = "Uploading file...") {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      throw new Error("Select a file first");
    }

    const form = new FormData();
    form.append("file", fileInput.files[0]);

    setFeedback(`${startMessage} ${fileInput.files[0].name}`, "running");
    setButtonsDisabled(true);

    try {
      const res = await fetch(url, {
        method: "POST",
        body: form
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      setFeedback("Operation completed successfully.", "success");
      return data;
    } catch (e) {
      setFeedback(`Operation failed: ${e.message}`, "error");
      throw e;
    } finally {
      setButtonsDisabled(false);
    }
  }

  const btnHealth = document.getElementById("btn-health");
  const btnStatus = document.getElementById("btn-status");
  const btnTrain = document.getElementById("btn-train");
  const btnEvaluate = document.getElementById("btn-evaluate");
  const btnExportSample = document.getElementById("btn-export-sample");
  const btnPredictCsv = document.getElementById("btn-predict-csv");
  const btnExtractPcap = document.getElementById("btn-extract-pcap");
  const btnPredictPcap = document.getElementById("btn-predict-pcap");

  if (btnHealth) {
    btnHealth.addEventListener("click", async () => {
      try {
        const data = await jsonRequest(`${API_BASE}/health`, {}, "Running health check...");
        setText("status-output", data);
      } catch (e) {
        setText("status-output", { ok: false, error: e.message });
      }
    });
  }

  if (btnStatus) {
    btnStatus.addEventListener("click", async () => {
      try {
        const data = await jsonRequest(`${API_BASE}/status`, {}, "Loading module status...");
        setText("status-output", data);
      } catch (e) {
        setText("status-output", { ok: false, error: e.message });
      }
    });
  }

  if (btnTrain) {
    btnTrain.addEventListener("click", async () => {
      const dataset = document.getElementById("dataset-select")?.value || "2017";
      try {
        const data = await jsonRequest(
          `${API_BASE}/train-default`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataset, set_active: true })
          },
          `Training model on dataset ${dataset}...`
        );

        setText("train-output", data);
        renderTable(
          "metrics-container",
          Object.entries(data.classification_report || {})
            .map(([k, v]) => ({
              label: k,
              precision: v.precision,
              recall: v.recall,
              f1_score: v["f1-score"],
              support: v.support
            }))
            .filter(x => x.precision !== undefined)
        );
      } catch (e) {
        setText("train-output", { ok: false, error: e.message });
      }
    });
  }

  if (btnEvaluate) {
    btnEvaluate.addEventListener("click", async () => {
      const dataset = document.getElementById("dataset-select")?.value || "2017";
      try {
        const data = await jsonRequest(
          `${API_BASE}/evaluate-default`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataset })
          },
          `Evaluating active model on dataset ${dataset}...`
        );

        setText("train-output", data);
        renderTable(
          "metrics-container",
          Object.entries(data.classification_report || {})
            .map(([k, v]) => ({
              label: k,
              precision: v.precision,
              recall: v.recall,
              f1_score: v["f1-score"],
              support: v.support
            }))
            .filter(x => x.precision !== undefined)
        );
      } catch (e) {
        setText("train-output", { ok: false, error: e.message });
      }
    });
  }

  if (btnExportSample) {
    btnExportSample.addEventListener("click", async () => {
      const dataset = document.getElementById("dataset-select")?.value || "2017";
      try {
        const data = await jsonRequest(
          `${API_BASE}/export-sample-csv?dataset=${encodeURIComponent(dataset)}&split=test&rows=50&include_label=1`,
          {},
          `Exporting real sample CSV from dataset ${dataset}...`
        );

        setText("train-output", data);
        renderTable("metrics-container", data.preview || []);
      } catch (e) {
        setText("train-output", { ok: false, error: e.message });
      }
    });
  }

  if (btnPredictCsv) {
    btnPredictCsv.addEventListener("click", async () => {
      try {
        const input = document.getElementById("csv-file");
        const data = await formRequest(`${API_BASE}/predict-csv`, input, "Uploading CSV and running prediction...");

        setText("csv-output", data);
        renderSummary("csv-summary", data.summary);
        renderTable("csv-results", data.results || []);
      } catch (e) {
        setText("csv-output", { ok: false, error: e.message });
        renderSummary("csv-summary", null);
        renderTable("csv-results", []);
      }
    });
  }

  if (btnExtractPcap) {
    btnExtractPcap.addEventListener("click", async () => {
      try {
        const input = document.getElementById("pcap-file-extract");
        const data = await formRequest(`${API_BASE}/extract-from-pcap`, input, "Uploading PCAP and generating CSV...");

        setText("pcap-extract-output", data);
        renderTable("pcap-preview", data.preview || []);
      } catch (e) {
        setText("pcap-extract-output", { ok: false, error: e.message });
        renderTable("pcap-preview", []);
      }
    });
  }

  if (btnPredictPcap) {
    btnPredictPcap.addEventListener("click", async () => {
      try {
        const input = document.getElementById("pcap-file-predict");
        const data = await formRequest(`${API_BASE}/predict-pcap`, input, "Uploading PCAP and running prediction...");

        setText("pcap-predict-output", data);
        renderSummary("pcap-summary", data.summary);
        renderTable("pcap-results", data.results || []);
      } catch (e) {
        setText("pcap-predict-output", { ok: false, error: e.message });
        renderSummary("pcap-summary", null);
        renderTable("pcap-results", []);
      }
    });
  }

  setFeedback("Frontend loaded. Ready.", "success");
});