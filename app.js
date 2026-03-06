$(document).ready(function() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function() {
      navigator.serviceWorker.register("/service-worker.js").catch(function(err) {
        console.error("Gagal daftar service worker:", err);
      });
    });
  }

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby4w2GYtoSmL1-aWZ4QU3cfy4yps_g707AARWWYQyKquMtpR9UgkhrCrWAsjbw2y6mH/exec";
  const SHEET_ID = "1qg1D0lhokOzR3sfecmQK83tdsxJq6HAPwYtP8K6DpH4";
  const SHEET_NAME = "log_imbas";

  const statusLine = document.getElementById("statusLine");
  const recordCount = document.getElementById("recordCount");
  const widgetTotal = document.getElementById("widgetTotal");
  const widgetSimpan = document.getElementById("widgetSimpan");
  const widgetAmbil = document.getElementById("widgetAmbil");
  const widgetPercent = document.getElementById("widgetPercent");
  const widgetPercentBar = document.getElementById("widgetPercentBar");
  const refreshInfo = document.getElementById("refreshInfo");
  const debugLine = document.getElementById("debugLine");
  const todayPill = document.getElementById("todayPill");
  const chartEmptyState = document.getElementById("chartEmptyState");
  let kelasSimpanChart = null;
  let hasLoadedDataOnce = false;

  var table = $("#jadualStatistik").DataTable({
    dom: "Bfrtip",
    autoWidth: false,
    columnDefs: [
      { targets: 0, width: "38%" }
    ],
    buttons: [
      { extend: "pdf", text: "📄 Muat Turun (PDF)", className: "btn btn-sm" },
      { extend: "print", text: "🖨️ Cetak", className: "btn btn-sm" }
    ],
    language: {
      search: "Carian pantas:",
      lengthMenu: "Papar _MENU_ rekod",
      info: "Memaparkan _START_ hingga _END_ daripada _TOTAL_ rekod",
      infoEmpty: "Tiada rekod",
      emptyTable: "Tiada data untuk dipaparkan"
    }
  });

  function isSimpanRecord(row) {
    const status = String(row[5] || "").toUpperCase().trim();
    const masaAmbil = String(row[4] || "").trim();
    const isSimpanText = status.includes("DISIMPAN") || status.includes("SIMPAN");
    const isAmbilText = status.includes("DIAMBIL") || status.includes("AMBIL");
    const isBelumAmbil = masaAmbil === "" || masaAmbil === "-";
    return isSimpanText || (!isAmbilText && isBelumAmbil);
  }

  function isAmbilRecord(row) {
    const status = String(row[5] || "").toUpperCase().trim();
    const masaAmbil = String(row[4] || "").trim();
    return status.includes("DIAMBIL") || status.includes("AMBIL") || (masaAmbil !== "" && masaAmbil !== "-");
  }

  function setLoadingState(isLoading) {
    if (!statusLine) return;
    if (isLoading) {
      statusLine.textContent = "Sedang tarik data live hari ini...";
    }
  }

  function renderKelasSimpanChart(rows) {
    if (typeof Chart === "undefined") {
      if (chartEmptyState) chartEmptyState.textContent = "Carta tidak tersedia.";
      return;
    }

    const simpanRows = rows.filter(isSimpanRecord);
    const countByKelas = {};

    simpanRows.forEach(function(row) {
      const kelas = String(row[1] || "-").trim() || "-";
      countByKelas[kelas] = (countByKelas[kelas] || 0) + 1;
    });

    const labels = Object.keys(countByKelas).sort(function(a, b) {
      return a.localeCompare(b, "ms");
    });
    const values = labels.map(function(k) { return countByKelas[k]; });

    if (kelasSimpanChart) {
      kelasSimpanChart.destroy();
      kelasSimpanChart = null;
    }

    if (!labels.length) {
      if (chartEmptyState) chartEmptyState.textContent = "Tiada data simpan untuk carta.";
      return;
    }

    if (chartEmptyState) chartEmptyState.textContent = "";
    const ctx = document.getElementById("kelasSimpanChart");
    kelasSimpanChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Bil Murid Simpan Telefon",
          data: values,
          borderWidth: 1,
          borderRadius: 10,
          backgroundColor: "rgba(171, 122, 255, 0.75)",
          borderColor: "rgba(224, 199, 255, 0.95)"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#e7ddff" }
          }
        },
        scales: {
          x: {
            ticks: { color: "#d5c6fb" },
            grid: { color: "rgba(174, 145, 240, 0.15)" }
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: "#d5c6fb" },
            grid: { color: "rgba(174, 145, 240, 0.15)" }
          }
        }
      }
    });
  }

  function updateWidgets(rows) {
    recordCount.textContent = `${rows.length} rekod`;
    widgetTotal.textContent = String(rows.length);

    const simpanCount = rows.filter(isSimpanRecord).length;
    const ambilCount = rows.filter(isAmbilRecord).length;
    const percent = rows.length ? Math.round((ambilCount / rows.length) * 100) : 0;

    widgetSimpan.textContent = String(simpanCount);
    widgetAmbil.textContent = String(ambilCount);
    widgetPercent.textContent = `${percent}%`;
    widgetPercentBar.style.width = `${percent}%`;
  }

  function resetWidgets() {
    recordCount.textContent = "0 rekod";
    widgetTotal.textContent = "0";
    widgetSimpan.textContent = "0";
    widgetAmbil.textContent = "0";
    widgetPercent.textContent = "0%";
    widgetPercentBar.style.width = "0%";
    if (kelasSimpanChart) {
      kelasSimpanChart.destroy();
      kelasSimpanChart = null;
    }
    if (chartEmptyState) chartEmptyState.textContent = "Tiada data simpan untuk carta.";
  }

  function nowText() {
    return new Date().toLocaleTimeString("ms-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function getKualaLumpurParts(dateObj) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(dateObj);

    const map = {};
    parts.forEach(function(p) {
      if (p.type === "year" || p.type === "month" || p.type === "day") {
        map[p.type] = p.value;
      }
    });
    return map;
  }

  function getTodayFilterValue() {
    const p = getKualaLumpurParts(new Date());
    return `${p.year}-${p.month}-${p.day}`;
  }

  function updateTodayPill() {
    const dateStr = getTodayFilterValue();
    if (!todayPill) return;
    const now = new Date();
    const dateText = now.toLocaleDateString("ms-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
    const timeText = now.toLocaleTimeString("ms-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const valueEl = todayPill.querySelector(".today-value");
    if (valueEl) {
      valueEl.textContent = `${dateText} | ${timeText}`;
    }
  }

  function normalizeDateToInputFormat(value) {
    if (!value) return "";
    const text = String(value).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
      const parts = text.split("/");
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
      const parts = text.split("/");
      const day = String(parts[0]).padStart(2, "0");
      const month = String(parts[1]).padStart(2, "0");
      return `${parts[2]}-${month}-${day}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
      return text.slice(0, 10);
    }
    return "";
  }

  function to12HourFormat(value) {
    if (!value) return "-";
    const text = String(value).trim();
    if (/(AM|PM)/i.test(text)) return text.toUpperCase();
    const m = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return text;
    let hour = parseInt(m[1], 10);
    const minute = m[2];
    const suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${String(hour).padStart(2, "0")}:${minute} ${suffix}`;
  }

  function applyFilters(rows, tarikh, kelas) {
    return rows.filter(function(row) {
      const rowKelas = String(row[1] || "").trim();
      const rowTarikh = normalizeDateToInputFormat(row[2]);
      const passKelas = !kelas || rowKelas === kelas;
      const passTarikh = !tarikh || rowTarikh === tarikh;
      return passKelas && passTarikh;
    });
  }

  function populateKelasOptions(rows, selectedKelas) {
    const select = document.getElementById("filterKelas");
    const kelasSet = new Set();

    rows.forEach(function(row) {
      const value = String(row[1] || "").trim();
      if (value) kelasSet.add(value);
    });

    const kelasList = Array.from(kelasSet).sort(function(a, b) {
      return a.localeCompare(b, "ms");
    });

    select.innerHTML = '<option value="">Semua Kelas</option>';
    if (!kelasList.length) {
      const emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = "Tiada kelas ditemui";
      emptyOpt.disabled = true;
      select.appendChild(emptyOpt);
      select.value = "";
      return;
    }

    kelasList.forEach(function(k) {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k;
      select.appendChild(opt);
    });

    if (selectedKelas && kelasSet.has(selectedKelas)) {
      select.value = selectedKelas;
    } else {
      select.value = "";
    }
  }

  window.muatData = async function(options) {
    const opts = options || {};
    const silent = !!opts.silent;

    const tarikh = getTodayFilterValue();
    const kelas = $("#filterKelas").val();

    const params = new URLSearchParams();
    params.append("action", "readData");
    params.append("sheetId", SHEET_ID);
    params.append("sheetName", SHEET_NAME);

    const url = params.toString() ? `${SCRIPT_URL}?${params.toString()}` : SCRIPT_URL;

    setLoadingState(true);

    try {
      const response = await fetch(url, {
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const textBody = await response.text();
        const hint = textBody.includes("<html") ? "URL memulangkan HTML, bukan JSON API." : "Respons bukan JSON.";
        throw new Error(hint);
      }

      const payload = await response.json();
      if (payload && payload.error) {
        throw new Error(payload.error);
      }

      const data = Array.isArray(payload) ? payload : (Array.isArray(payload.data) ? payload.data : []);
      const allRows = data.map(function(item) {
        return [
          Array.isArray(item) ? (item[0] || "-") : (item.nama || item.namaMurid || "-"),
          Array.isArray(item) ? (item[1] || "-") : (item.kelas || "-"),
          Array.isArray(item) ? (item[2] || "-") : (item.tarikh || "-"),
          to12HourFormat(Array.isArray(item) ? (item[3] || "-") : (item.masaSimpan || item.masa_simpan || "-")),
          to12HourFormat(Array.isArray(item) ? (item[4] || "-") : (item.masaAmbil || item.masa_ambil || "-")),
          Array.isArray(item) ? (item[5] || "-") : (item.status || "-")
        ];
      }).filter(function(r) {
        return r.some(function(cell) {
          const v = String(cell || "").trim();
          return v !== "" && v !== "-";
        });
      });

      populateKelasOptions(allRows, kelas);
      const effectiveTarikh = tarikh;
      const filteredRows = applyFilters(allRows, effectiveTarikh, kelas);
      const uniqueKelasCount = new Set(allRows.map(function(r) { return String(r[1] || "").trim(); }).filter(Boolean)).size;

      table.clear().rows.add(filteredRows).draw();
      updateWidgets(filteredRows);
      renderKelasSimpanChart(filteredRows);
      statusLine.textContent = `Data berjaya dimuat: ${filteredRows.length}/${allRows.length} rekod.`;
      refreshInfo.textContent = `Auto-refresh: setiap 10 saat. Kemaskini terakhir: ${nowText()}.`;
      debugLine.textContent = "";
      hasLoadedDataOnce = true;
    } catch (error) {
      statusLine.textContent = `Ralat: ${error.message}`;
      debugLine.textContent = "";
      if (!hasLoadedDataOnce) {
        resetWidgets();
      }
      if (!silent) {
        alert(`Gagal memuat data: ${error.message}`);
      }
      console.error("Ralat muatData:", error);
    } finally {
      setLoadingState(false);
    }
  };

  setInterval(function() {
    window.muatData({ silent: true });
  }, 10000);

  document.getElementById("filterKelas").addEventListener("change", function() {
    window.muatData({ silent: true });
  });

  updateTodayPill();
  setInterval(updateTodayPill, 1000);
  window.muatData({ silent: true });
});
