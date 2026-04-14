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

    if (!summary || Object.keys(summary).length === 0) {
      el.innerHTML = "";
      return;
    }

    const rows = Object.entries(summary)
      .map(([k, v]) => `<div><strong>${k}</strong>: ${v}</div>`)
      .join("");

    el.innerHTML = `<div class="summary">${rows}</div>`;
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

    const head = cols.map(c => `<th>${escapeHtml(c)}</th>`).join("");
    const body = data.map(row => {
      const cells = cols.map(c => {
        const val = row[c];
        const text = typeof val === "object" ? JSON.stringify(val) : String(val);
        return `<td>${escapeHtml(text)}</td>`;
      }).join("");
      return `<tr>${cells}</tr>`;
    }).join("");

    el.innerHTML = `
      <div class="small">Showing ${data.length} rows</div>
      <div class="table-wrap">
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function escapeHtml(str) {
    return str
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderBulletBox(containerId, title, items = [], extraText = "") {
    const el = document.getElementById(containerId);
    if (!el) return;

    if ((!items || items.length === 0) && !extraText) {
      el.innerHTML = "";
      return;
    }

    const bullets = items.length
      ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";

    const paragraph = extraText ? `<p>${escapeHtml(extraText)}</p>` : "";

    el.innerHTML = `
      <div class="info-box">
        <h3>${escapeHtml(title)}</h3>
        ${bullets}
        ${paragraph}
      </div>
    `;
  }

  function renderProfileCard(profile) {
    const el = document.getElementById("profile-info");
    if (!el) return;

    if (!profile) {
      el.innerHTML = `<div class="profile-empty">No profile information available.</div>`;
      return;
    }

    el.innerHTML = `
      <div class="info-box">
        <h3>${escapeHtml(profile.title)}</h3>
        <ul>
          <li><strong>Profile:</strong> ${escapeHtml(profile.profile)}</li>
          <li><strong>Notebook:</strong> ${escapeHtml(profile.notebook)}</li>
          <li><strong>Goal:</strong> ${escapeHtml(profile.goal)}</li>
          <li><strong>Split artifact:</strong> <code>${escapeHtml(profile.split_file)}</code></li>
          <li><strong>Base model artifact:</strong> <code>${escapeHtml(profile.base_model_file)}</code></li>
          <li><strong>Mode:</strong> ${escapeHtml(profile.mode)}</li>
        </ul>
      </div>
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

  function buildEvaluationExplanation(data) {
    const summary = data.summary_explanation || {};
    const items = [];

    if (summary.accuracy !== undefined) {
      items.push(`Overall accuracy: ${Number(summary.accuracy).toFixed(6)}`);
    }
    if (summary.macro_f1 !== undefined) {
      items.push(`Macro F1: ${Number(summary.macro_f1).toFixed(6)}`);
    }
    if (summary.rows !== undefined && summary.rows !== null) {
      items.push(`Evaluated rows: ${summary.rows}`);
    }

    const strongest = (summary.strongest_classes || []).map(
      x => `${x.label} with F1 ${Number(x.f1_score).toFixed(6)}`
    );
    if (strongest.length) {
      items.push(`Strongest classes: ${strongest.join(", ")}`);
    }

    const weakest = (summary.weakest_classes || []).map(
      x => `${x.label} with F1 ${Number(x.f1_score).toFixed(6)}`
    );
    if (weakest.length) {
      items.push(`Lowest relative class scores: ${weakest.join(", ")}`);
    }

    renderBulletBox(
      "explanation-box",
      "Result interpretation",
      items,
      summary.interpretation || ""
    );
  }

  function buildPredictionExplanation(containerId, data) {
    const summary = data.summary_explanation || {};
    const items = [];

    if (summary.input_rows !== undefined) {
      items.push(`Input rows: ${summary.input_rows}`);
    }
    if (summary.dominant_class !== null && summary.dominant_class !== undefined) {
      items.push(`Dominant predicted class: ${summary.dominant_class} (${summary.dominant_count} rows)`);
    }
    if (summary.class_diversity !== undefined) {
      items.push(`Predicted class diversity: ${summary.class_diversity}`);
    }
    if (summary.average_confidence !== null && summary.average_confidence !== undefined) {
      items.push(`Average confidence: ${Number(summary.average_confidence).toFixed(6)}`);
    }

    renderBulletBox(
      containerId,
      "Inference interpretation",
      items,
      summary.interpretation || ""
    );
  }

  function getSelectedProfileKey() {
    return document.getElementById("dataset-select")?.value || "2017";
  }

  function renderProfilesResponse(data) {
    const selected = getSelectedProfileKey();
    const profile = (data.profiles || []).find(p => p.profile === selected) || data.profiles?.[0];
    renderProfileCard(profile);
  }

  const btnProfiles = document.getElementById("btn-profiles");
  const btnStatus = document.getElementById("btn-status");
  const btnEvaluate = document.getElementById("btn-evaluate");
  const btnTrain = document.getElementById("btn-train");
  const btnExportSample = document.getElementById("btn-export-sample");
  const btnPredictCsv = document.getElementById("btn-predict-csv");
  const btnExtractPcap = document.getElementById("btn-extract-pcap");
  const btnPredictPcap = document.getElementById("btn-predict-pcap");
  const datasetSelect = document.getElementById("dataset-select");

  let cachedProfiles = null;

  if (btnProfiles) {
    btnProfiles.addEventListener("click", async () => {
      try {
        const data = await jsonRequest(`${API_BASE}/profiles`, {}, "Loading framework profiles...");
        cachedProfiles = data;
        setText("status-output", data);
        renderProfilesResponse(data);
      } catch (e) {
        setText("status-output", { ok: false, error: e.message });
      }
    });
  }

  if (datasetSelect) {
    datasetSelect.addEventListener("change", () => {
      if (cachedProfiles) {
        renderProfilesResponse(cachedProfiles);
      }
    });
  }

  if (btnStatus) {
    btnStatus.addEventListener("click", async () => {
      try {
        const data = await jsonRequest(`${API_BASE}/status`, {}, "Loading active artifact status...");
        setText("status-output", data);
      } catch (e) {
        setText("status-output", { ok: false, error: e.message });
      }
    });
  }

  if (btnEvaluate) {
    btnEvaluate.addEventListener("click", async () => {
      const dataset = getSelectedProfileKey();

      try {
        const data = await jsonRequest(
          `${API_BASE}/baseline/evaluate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataset })
          },
          `Reproducing baseline results for ${dataset}...`
        );

        setText("train-output", data);
        buildEvaluationExplanation(data);
        renderTable("metrics-container", data.classification_rows || []);
      } catch (e) {
        setText("train-output", { ok: false, error: e.message });
      }
    });
  }

  if (btnTrain) {
    btnTrain.addEventListener("click", async () => {
      const dataset = getSelectedProfileKey();

      try {
        const data = await jsonRequest(
          `${API_BASE}/retrain`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataset, set_active: true })
          },
          `Retraining framework model for ${dataset}...`
        );

        setText("train-output", data);
        buildEvaluationExplanation(data);
        renderTable("metrics-container", data.classification_rows || []);
      } catch (e) {
        setText("train-output", { ok: false, error: e.message });
      }
    });
  }

  if (btnExportSample) {
    btnExportSample.addEventListener("click", async () => {
      const dataset = getSelectedProfileKey();

      try {
        const data = await jsonRequest(
          `${API_BASE}/baseline/export-sample-csv?dataset=${encodeURIComponent(dataset)}&split=test&rows=50&include_label=1`,
          {},
          `Exporting prepared framework CSV for ${dataset}...`
        );

        setText("train-output", data);
        renderBulletBox(
          "explanation-box",
          "Prepared CSV explanation",
          [
            `Dataset profile: ${dataset}`,
            `Rows exported: ${data.rows}`,
            `Mode: ${data.mode}`
          ],
          data.message || ""
        );
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
        const data = await formRequest(
          `${API_BASE}/predict-csv`,
          input,
          "Uploading CSV and running framework inference..."
        );

        setText("csv-output", data);
        buildPredictionExplanation("csv-explanation", data);
        renderSummary("csv-summary", data.summary);
        renderTable("csv-results", data.results || []);
      } catch (e) {
        setText("csv-output", { ok: false, error: e.message });
        renderBulletBox("csv-explanation", "", [], "");
        renderSummary("csv-summary", null);
        renderTable("csv-results", []);
      }
    });
  }

  if (btnExtractPcap) {
    btnExtractPcap.addEventListener("click", async () => {
      try {
        const input = document.getElementById("pcap-file-extract");
        const data = await formRequest(
          `${API_BASE}/extract-from-pcap`,
          input,
          "Uploading PCAP and generating alternative feature CSV..."
        );

        setText("pcap-extract-output", data);
        renderBulletBox(
          "pcap-preview",
          "Alternative PCAP conversion",
          [
            `Generated rows: ${data.rows}`,
            `CSV file: ${data.csv_file}`,
            `Mode: ${data.mode}`
          ],
          data.warning || data.message || ""
        );
      } catch (e) {
        setText("pcap-extract-output", { ok: false, error: e.message });
        renderBulletBox("pcap-preview", "", [], "");
      }
    });
  }

  if (btnPredictPcap) {
    btnPredictPcap.addEventListener("click", async () => {
      try {
        const input = document.getElementById("pcap-file-predict");
        const data = await formRequest(
          `${API_BASE}/predict-pcap`,
          input,
          "Uploading PCAP and running alternative inference..."
        );

        setText("pcap-predict-output", data);
        buildPredictionExplanation("pcap-explanation", data);
        renderSummary("pcap-summary", data.summary);
        renderTable("pcap-results", data.results || []);
      } catch (e) {
        setText("pcap-predict-output", { ok: false, error: e.message });
        renderBulletBox("pcap-explanation", "", [], "");
        renderSummary("pcap-summary", null);
        renderTable("pcap-results", []);
      }
    });
  }

  setFeedback("Frontend loaded. Ready.", "success");
});