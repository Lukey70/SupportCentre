const STORAGE_KEY = "supportRequestPortal.requests.v1";
const COUNTER_KEY = "supportRequestPortal.counter.v1";
const MAX_ATTACHMENT_BYTES = 2.5 * 1024 * 1024;

let requests = loadRequests();
let selectedRequestId = null;
let updateType = "reply";

const navButtons = document.querySelectorAll(".nav-btn");
const pageSections = document.querySelectorAll(".page-section");
const supportForm = document.getElementById("support-form");
const fileInput = document.getElementById("request-attachments");
const selectedFiles = document.getElementById("selected-files");
const successBox = document.getElementById("submission-success");
const searchInput = document.getElementById("search-requests");
const statusFilter = document.getElementById("status-filter");
const requestList = document.getElementById("request-list");
const requestDetail = document.getElementById("request-detail");
const detailTemplate = document.getElementById("request-detail-template");
const exportButton = document.getElementById("export-data");
const importInput = document.getElementById("import-data");
const clearButton = document.getElementById("clear-data");
const statTotal = document.getElementById("stat-total");
const statOpen = document.getElementById("stat-open");
const statResolved = document.getElementById("stat-resolved");

navButtons.forEach((button) => {
  button.addEventListener("click", () => switchSection(button.dataset.target));
});

fileInput.addEventListener("change", renderSelectedFiles);
supportForm.addEventListener("submit", handleSupportSubmit);
searchInput.addEventListener("input", renderInbox);
statusFilter.addEventListener("change", renderInbox);
exportButton.addEventListener("click", exportRequests);
importInput.addEventListener("change", importRequests);
clearButton.addEventListener("click", clearRequests);

renderInbox();

function switchSection(targetId) {
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.target === targetId));
  pageSections.forEach((section) => section.classList.toggle("active", section.id === targetId));
}

function loadRequests() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Could not load requests", error);
    return [];
  }
}

function saveRequests() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

function getNextRequestNumber() {
  const current = Number(localStorage.getItem(COUNTER_KEY) || "0") + 1;
  localStorage.setItem(COUNTER_KEY, String(current));
  return `REQ-${String(current).padStart(5, "0")}`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderSelectedFiles() {
  selectedFiles.innerHTML = "";
  const files = [...fileInput.files];

  if (!files.length) return;

  files.forEach((file) => {
    const item = document.createElement("li");
    item.innerHTML = `<span>${escapeHtml(file.name)}</span><span>${formatFileSize(file.size)}</span>`;
    selectedFiles.appendChild(item);
  });
}

async function handleSupportSubmit(event) {
  event.preventDefault();

  const formData = new FormData(supportForm);
  const files = [...fileInput.files];
  const totalAttachmentSize = files.reduce((total, file) => total + file.size, 0);

  if (totalAttachmentSize > MAX_ATTACHMENT_BYTES) {
    alert(`Attachments are too large for this browser-only demo. Please keep the total under ${formatFileSize(MAX_ATTACHMENT_BYTES)}.`);
    return;
  }

  const now = new Date().toISOString();
  const newRequest = {
    id: crypto.randomUUID(),
    requestNumber: getNextRequestNumber(),
    status: "New",
    createdAt: now,
    updatedAt: now,
    requesterName: String(formData.get("requesterName")).trim(),
    requesterEmail: String(formData.get("requesterEmail")).trim(),
    category: String(formData.get("category")).trim(),
    subject: String(formData.get("subject")).trim(),
    details: String(formData.get("details")).trim(),
    attachments: await readAttachments(files),
    activity: [
      {
        id: crypto.randomUUID(),
        type: "system",
        author: "System",
        text: "Request created.",
        createdAt: now,
      },
    ],
  };

  requests.unshift(newRequest);
  selectedRequestId = newRequest.id;
  saveRequests();
  supportForm.reset();
  selectedFiles.innerHTML = "";

  successBox.classList.remove("hidden");
  successBox.innerHTML = `
    <strong>Request submitted: ${newRequest.requestNumber}</strong>
    <p>${escapeHtml(newRequest.subject)} has been added to the agent inbox.</p>
  `;

  renderInbox();
}

function readAttachments(files) {
  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      dataUrl: reader.result,
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  })));
}

function renderInbox() {
  const filtered = getFilteredRequests();
  requestList.innerHTML = "";

  const total = requests.length;
  const open = requests.filter((request) => !["Resolved", "Closed"].includes(request.status)).length;
  const resolved = requests.filter((request) => request.status === "Resolved").length;

  statTotal.textContent = total;
  statOpen.textContent = open;
  statResolved.textContent = resolved;

  if (!filtered.length) {
    requestList.innerHTML = `<div class="no-results">No requests found.</div>`;
  } else {
    filtered.forEach((request) => requestList.appendChild(createRequestCard(request)));
  }

  if (selectedRequestId && requests.some((request) => request.id === selectedRequestId)) {
    renderRequestDetail(selectedRequestId);
  } else if (requests.length) {
    selectedRequestId = null;
    renderEmptyDetail();
  } else {
    selectedRequestId = null;
    renderEmptyDetail();
  }
}

function getFilteredRequests() {
  const term = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;

  return requests.filter((request) => {
    const statusMatches = selectedStatus === "All" || request.status === selectedStatus;
    const searchable = [
      request.requestNumber,
      request.requesterName,
      request.requesterEmail,
      request.category,
      request.subject,
      request.details,
      request.status,
    ].join(" ").toLowerCase();
    return statusMatches && searchable.includes(term);
  });
}

function createRequestCard(request) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `request-card ${request.id === selectedRequestId ? "active" : ""}`;
  button.setAttribute("role", "listitem");
  button.innerHTML = `
    <div class="request-card-top">
      <span class="request-id">${escapeHtml(request.requestNumber)}</span>
      <span class="status-pill ${statusClass(request.status)}">${escapeHtml(request.status)}</span>
    </div>
    <h3>${escapeHtml(request.subject)}</h3>
    <p>${escapeHtml(request.requesterName)} · ${escapeHtml(request.category)}</p>
    <p>Updated ${formatDateTime(request.updatedAt)}</p>
  `;
  button.addEventListener("click", () => {
    selectedRequestId = request.id;
    renderInbox();
    renderRequestDetail(request.id);
  });
  return button;
}

function renderEmptyDetail() {
  requestDetail.className = "card detail-panel empty-state";
  requestDetail.innerHTML = `
    <div class="empty-illustration">✉️</div>
    <h3>Select a request</h3>
    <p>Open a request from the inbox to start working on it.</p>
  `;
}

function renderRequestDetail(requestId) {
  const request = requests.find((item) => item.id === requestId);
  if (!request) {
    renderEmptyDetail();
    return;
  }

  requestDetail.className = "card detail-panel";
  requestDetail.innerHTML = "";
  const content = detailTemplate.content.cloneNode(true);

  content.querySelector(".request-number").textContent = request.requestNumber;
  content.querySelector(".detail-subject").textContent = request.subject;
  content.querySelector(".request-meta").textContent = `Created ${formatDateTime(request.createdAt)} · Updated ${formatDateTime(request.updatedAt)}`;

  const statusPill = content.querySelector(".status-pill");
  statusPill.textContent = request.status;
  statusPill.classList.add(statusClass(request.status));

  content.querySelector(".requester-info").innerHTML = `${escapeHtml(request.requesterName)}<br><a href="mailto:${encodeURIComponent(request.requesterEmail)}">${escapeHtml(request.requesterEmail)}</a>`;
  content.querySelector(".category-info").textContent = request.category;
  content.querySelector(".details-text").textContent = request.details;

  const attachmentsList = content.querySelector(".attachments-list");
  renderAttachments(request.attachments, attachmentsList);

  const timeline = content.querySelector(".timeline");
  renderTimeline(request.activity, timeline);

  content.querySelectorAll("[data-status]").forEach((button) => {
    button.disabled = request.status === button.dataset.status;
    button.addEventListener("click", () => updateRequestStatus(request.id, button.dataset.status));
  });

  content.querySelectorAll("[data-update-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.updateType === updateType);
    button.addEventListener("click", () => {
      updateType = button.dataset.updateType;
      renderRequestDetail(request.id);
    });
  });

  content.querySelector("#add-update").addEventListener("click", () => addAgentUpdate(request.id));

  requestDetail.appendChild(content);
}

function renderAttachments(attachments, container) {
  container.innerHTML = "";

  if (!attachments || !attachments.length) {
    container.innerHTML = `<p class="hint">No attachments were included with this request.</p>`;
    return;
  }

  attachments.forEach((attachment) => {
    const item = document.createElement("div");
    item.className = "attachment-item";
    item.innerHTML = `
      <span>${escapeHtml(attachment.name)} <small>(${formatFileSize(attachment.size)})</small></span>
      <a href="${attachment.dataUrl}" download="${escapeHtml(attachment.name)}">Download</a>
    `;
    container.appendChild(item);
  });
}

function renderTimeline(activity, container) {
  container.innerHTML = "";

  [...activity].reverse().forEach((entry) => {
    const item = document.createElement("div");
    item.className = `timeline-item ${entry.type}`;
    const title = entry.type === "note" ? "Internal note" : entry.type === "reply" ? "Reply" : "System update";
    item.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      <span class="timeline-meta">${escapeHtml(entry.author)} · ${formatDateTime(entry.createdAt)}</span>
      <p>${escapeHtml(entry.text)}</p>
    `;
    container.appendChild(item);
  });
}

function updateRequestStatus(requestId, status) {
  const request = requests.find((item) => item.id === requestId);
  if (!request) return;

  const now = new Date().toISOString();
  request.status = status;
  request.updatedAt = now;
  request.activity.push({
    id: crypto.randomUUID(),
    type: "system",
    author: "Agent",
    text: `Status changed to ${status}.`,
    createdAt: now,
  });

  saveRequests();
  renderInbox();
}

function addAgentUpdate(requestId) {
  const textarea = requestDetail.querySelector("#agent-update-text");
  const text = textarea.value.trim();

  if (!text) {
    alert("Please type an update first.");
    return;
  }

  const request = requests.find((item) => item.id === requestId);
  if (!request) return;

  const now = new Date().toISOString();
  request.updatedAt = now;
  request.activity.push({
    id: crypto.randomUUID(),
    type: updateType,
    author: "Agent",
    text,
    createdAt: now,
  });

  if (request.status === "New") {
    request.status = "In Progress";
    request.activity.push({
      id: crypto.randomUUID(),
      type: "system",
      author: "System",
      text: "Status changed to In Progress after agent update.",
      createdAt: now,
    });
  }

  saveRequests();
  renderInbox();
}

function exportRequests() {
  const payload = {
    exportedAt: new Date().toISOString(),
    requests,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `support-requests-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importRequests(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const importedRequests = Array.isArray(parsed) ? parsed : parsed.requests;

      if (!Array.isArray(importedRequests)) {
        throw new Error("Invalid import format");
      }

      requests = importedRequests;
      selectedRequestId = null;
      saveRequests();
      updateCounterFromRequests();
      renderInbox();
      alert("Requests imported successfully.");
    } catch (error) {
      alert("Could not import this file. Please choose a valid support request export.");
      console.error(error);
    } finally {
      importInput.value = "";
    }
  };
  reader.readAsText(file);
}

function clearRequests() {
  const confirmed = confirm("Clear all saved requests from this browser?");
  if (!confirmed) return;

  requests = [];
  selectedRequestId = null;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(COUNTER_KEY);
  renderInbox();
}

function updateCounterFromRequests() {
  const highest = requests.reduce((max, request) => {
    const number = Number(String(request.requestNumber || "").replace(/\D/g, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
  localStorage.setItem(COUNTER_KEY, String(highest));
}

function statusClass(status) {
  return `status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
