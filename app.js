const STORAGE_KEY = "supportRequestPortal.requests.v2";
const LEGACY_STORAGE_KEYS = ["supportRequestPortal.requests.v1"];
const COUNTER_KEY = "supportRequestPortal.counter.v2";
const LEGACY_COUNTER_KEYS = ["supportRequestPortal.counter.v1"];
const MAX_ATTACHMENT_BYTES = 2.5 * 1024 * 1024;
const RESOLVED_AUTO_CLOSE_DAYS = 14;
const OPEN_STATUSES = ["New", "In Progress", "Waiting on Customer"];

let requests = normaliseRequests(loadRequests());
let selectedRequestId = null;
let selectedCustomerRequestId = null;
let customerSearchEmail = "";
let updateType = "reply";
let pendingResolveRequestId = null;
let pendingRequesterReopenId = null;

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

const customerSearchForm = document.getElementById("customer-search-form");
const customerEmailSearch = document.getElementById("customer-email-search");
const customerStatusFilter = document.getElementById("customer-status-filter");
const customerRequestList = document.getElementById("customer-request-list");
const customerRequestDetail = document.getElementById("customer-request-detail");
const customerDetailTemplate = document.getElementById("customer-detail-template");

const resolutionModal = document.getElementById("resolution-modal");
const resolutionForm = document.getElementById("resolution-form");
const resolutionNotes = document.getElementById("resolution-notes");
const reopenModal = document.getElementById("reopen-modal");
const reopenForm = document.getElementById("reopen-form");
const reopenReason = document.getElementById("reopen-reason");

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
customerSearchForm.addEventListener("submit", handleCustomerSearch);
customerStatusFilter.addEventListener("change", renderCustomerPortal);
resolutionForm.addEventListener("submit", handleResolveSubmit);
reopenForm.addEventListener("submit", handleRequesterReopenSubmit);

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => closeModal(button.dataset.closeModal));
});

[resolutionModal, reopenModal].forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal(modal.id);
  });
});

const initialAutoClosedCount = autoCloseResolvedRequests();
if (initialAutoClosedCount > 0) saveRequests();
else saveRequests();
renderInbox();
renderCustomerPortal();

function switchSection(targetId) {
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.target === targetId));
  pageSections.forEach((section) => section.classList.toggle("active", section.id === targetId));
}

function loadRequests() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Could not load requests", error);
    return [];
  }
}

function saveRequests() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normaliseRequests(items) {
  if (!Array.isArray(items)) return [];
  return items.map((request) => {
    const now = new Date().toISOString();
    const createdAt = request.createdAt || now;
    const activity = Array.isArray(request.activity) ? request.activity.map((entry) => ({
      id: entry.id || createId(),
      type: entry.type || "system",
      author: entry.author || "System",
      text: entry.text || "",
      createdAt: entry.createdAt || createdAt,
      audience: entry.audience || inferAudience(entry.type),
    })) : [];

    if (!activity.length) {
      activity.push({
        id: createId(),
        type: "system",
        author: "System",
        text: "Request created.",
        createdAt,
        audience: "customer",
      });
    }

    return {
      id: request.id || createId(),
      requestNumber: request.requestNumber || getNextRequestNumber(),
      status: request.status || "New",
      createdAt,
      updatedAt: request.updatedAt || createdAt,
      resolvedAt: request.resolvedAt || null,
      closedAt: request.closedAt || null,
      requesterName: request.requesterName || "Unknown requester",
      requesterEmail: request.requesterEmail || "",
      category: request.category || "ICT",
      subject: request.subject || "Untitled request",
      details: request.details || "",
      attachments: Array.isArray(request.attachments) ? request.attachments : [],
      activity,
    };
  });
}

function inferAudience(type) {
  if (type === "note") return "internal";
  if (["reply", "resolution", "customer-reply", "reopen"].includes(type)) return "customer";
  return "customer";
}

function getNextRequestNumber() {
  const storedCounter = localStorage.getItem(COUNTER_KEY) || LEGACY_COUNTER_KEYS.map((key) => localStorage.getItem(key)).find(Boolean) || "0";
  const current = Number(storedCounter) + 1;
  localStorage.setItem(COUNTER_KEY, String(current));
  LEGACY_COUNTER_KEYS.forEach((key) => localStorage.removeItem(key));
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

function addDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date;
}

function isOpenStatus(status) {
  return OPEN_STATUSES.includes(status);
}

function autoCloseResolvedRequests() {
  const now = new Date();
  let closedCount = 0;

  requests.forEach((request) => {
    if (request.status !== "Resolved" || !request.resolvedAt) return;
    const closeDate = addDays(request.resolvedAt, RESOLVED_AUTO_CLOSE_DAYS);
    if (closeDate > now) return;

    const nowIso = now.toISOString();
    request.status = "Closed";
    request.closedAt = nowIso;
    request.updatedAt = nowIso;
    request.activity.push({
      id: createId(),
      type: "system",
      author: "System",
      text: "Case automatically closed after being resolved for 14 days. This closed case cannot be re-opened; please raise a new support request if further help is needed.",
      createdAt: nowIso,
      audience: "customer",
    });
    closedCount += 1;
  });

  return closedCount;
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
    id: createId(),
    requestNumber: getNextRequestNumber(),
    status: "New",
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    closedAt: null,
    requesterName: String(formData.get("requesterName")).trim(),
    requesterEmail: String(formData.get("requesterEmail")).trim(),
    category: String(formData.get("category")).trim(),
    subject: String(formData.get("subject")).trim(),
    details: String(formData.get("details")).trim(),
    attachments: await readAttachments(files),
    activity: [
      {
        id: createId(),
        type: "system",
        author: "System",
        text: "Request created.",
        createdAt: now,
        audience: "customer",
      },
    ],
  };

  requests.unshift(newRequest);
  selectedRequestId = newRequest.id;
  selectedCustomerRequestId = newRequest.id;
  customerSearchEmail = newRequest.requesterEmail.toLowerCase();
  customerEmailSearch.value = newRequest.requesterEmail;
  saveRequests();
  supportForm.reset();
  selectedFiles.innerHTML = "";

  successBox.classList.remove("hidden");
  successBox.innerHTML = `
    <strong>Request submitted: ${newRequest.requestNumber}</strong>
    <p>${escapeHtml(newRequest.subject)} has been added to the agent inbox. You can track it from the Track My Requests page.</p>
  `;

  renderInbox();
  renderCustomerPortal();
}

function readAttachments(files) {
  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: createId(),
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
  const closedCount = autoCloseResolvedRequests();
  if (closedCount > 0) saveRequests();

  const filtered = getFilteredRequests();
  requestList.innerHTML = "";

  const total = requests.length;
  const open = requests.filter((request) => isOpenStatus(request.status)).length;
  const resolved = requests.filter((request) => request.status === "Resolved").length;

  statTotal.textContent = total;
  statOpen.textContent = open;
  statResolved.textContent = resolved;

  if (!filtered.length) {
    requestList.innerHTML = `<div class="no-results">No requests found.</div>`;
  } else {
    filtered.forEach((request) => requestList.appendChild(createRequestCard(request, "agent")));
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

  renderCustomerPortal(false);
}

function getFilteredRequests() {
  const term = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;

  return requests.filter((request) => {
    const statusMatches = selectedStatus === "All" || (selectedStatus === "Open" ? isOpenStatus(request.status) : request.status === selectedStatus);
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

function createRequestCard(request, mode) {
  const button = document.createElement("button");
  button.type = "button";
  const activeId = mode === "customer" ? selectedCustomerRequestId : selectedRequestId;
  button.className = `request-card ${request.id === activeId ? "active" : ""}`;
  button.setAttribute("role", "listitem");
  button.innerHTML = `
    <div class="request-card-top">
      <span class="request-id">${escapeHtml(request.requestNumber)}</span>
      <span class="status-pill ${statusClass(request.status)}">${escapeHtml(request.status)}</span>
    </div>
    <h3>${escapeHtml(request.subject)}</h3>
    <p>${escapeHtml(mode === "customer" ? request.category : `${request.requesterName} · ${request.category}`)}</p>
    <p>Updated ${formatDateTime(request.updatedAt)}</p>
  `;
  button.addEventListener("click", () => {
    if (mode === "customer") {
      selectedCustomerRequestId = request.id;
      renderCustomerPortal(false);
    } else {
      selectedRequestId = request.id;
      renderInbox();
      renderRequestDetail(request.id);
    }
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
  content.querySelector(".request-meta").textContent = getRequestMetaText(request);

  const statusPill = content.querySelector(".status-pill");
  statusPill.textContent = request.status;
  statusPill.classList.add(statusClass(request.status));

  content.querySelector(".requester-info").innerHTML = `${escapeHtml(request.requesterName)}<br><a href="mailto:${encodeURIComponent(request.requesterEmail)}">${escapeHtml(request.requesterEmail)}</a>`;
  content.querySelector(".category-info").textContent = request.category;
  content.querySelector(".details-text").textContent = request.details;

  const attachmentsList = content.querySelector(".attachments-list");
  renderAttachments(request.attachments, attachmentsList);

  const statusActions = content.querySelector(".status-actions");
  renderAgentStatusActions(request, statusActions);

  const timeline = content.querySelector(".timeline");
  renderTimeline(request.activity, timeline, "agent");

  const addUpdateButton = content.querySelector("#add-update");
  const updateText = content.querySelector("#agent-update-text");
  const updatePanel = content.querySelector(".update-panel");

  content.querySelectorAll("[data-update-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.updateType === updateType);
    button.addEventListener("click", () => {
      updateType = button.dataset.updateType;
      renderRequestDetail(request.id);
    });
  });

  if (request.status === "Closed") {
    updateText.disabled = true;
    addUpdateButton.disabled = true;
    updatePanel.querySelector(".hint").textContent = "This case is closed and cannot be re-opened. Ask the requester to raise a new support request if more help is needed.";
  } else {
    addUpdateButton.addEventListener("click", () => addAgentUpdate(request.id));
  }

  requestDetail.appendChild(content);
}

function getRequestMetaText(request) {
  const parts = [`Created ${formatDateTime(request.createdAt)}`, `Updated ${formatDateTime(request.updatedAt)}`];
  if (request.resolvedAt) parts.push(`Resolved ${formatDateTime(request.resolvedAt)}`);
  if (request.closedAt) parts.push(`Closed ${formatDateTime(request.closedAt)}`);
  return parts.join(" · ");
}

function renderAgentStatusActions(request, container) {
  container.innerHTML = "";

  if (request.status === "Closed") {
    container.innerHTML = `<p class="closed-note">This case is closed and cannot be re-opened. A new support request is required for further help.</p>`;
    return;
  }

  if (request.status === "Resolved") {
    const reopenButton = makeActionButton("Re-open case", "secondary-btn", () => reopenCaseAsAgent(request.id));
    const closeButton = makeActionButton("Close case", "secondary-btn", () => updateRequestStatus(request.id, "Closed"));
    container.append(reopenButton, closeButton);
    return;
  }

  const startButton = makeActionButton("Start Work", "secondary-btn", () => updateRequestStatus(request.id, "In Progress"));
  const waitingButton = makeActionButton("Waiting on Customer", "secondary-btn", () => updateRequestStatus(request.id, "Waiting on Customer"));
  const resolveButton = makeActionButton("Resolve", "primary-btn", () => openResolveModal(request.id));

  startButton.disabled = request.status === "In Progress";
  waitingButton.disabled = request.status === "Waiting on Customer";
  container.append(startButton, waitingButton, resolveButton);
}

function makeActionButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
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

function renderTimeline(activity, container, mode) {
  container.innerHTML = "";

  const visibleActivity = mode === "customer"
    ? activity.filter((entry) => entry.audience !== "internal")
    : activity;

  if (!visibleActivity.length) {
    container.innerHTML = `<p class="hint">No customer-facing messages have been sent yet.</p>`;
    return;
  }

  [...visibleActivity].reverse().forEach((entry) => {
    const item = document.createElement("div");
    item.className = `timeline-item ${entry.type}`;
    const title = activityTitle(entry, mode);
    const audienceLabel = mode === "agent" && entry.audience === "customer" ? " · visible to requester" : "";
    item.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      <span class="timeline-meta">${escapeHtml(entry.author)} · ${formatDateTime(entry.createdAt)}${audienceLabel}</span>
      <p>${escapeHtml(entry.text)}</p>
    `;
    container.appendChild(item);
  });
}

function activityTitle(entry, mode) {
  if (entry.type === "note") return "Internal note";
  if (entry.type === "reply") return mode === "customer" ? "Message from support" : "Reply to requester";
  if (entry.type === "customer-reply") return "Requester reply";
  if (entry.type === "resolution") return "Resolution notes";
  if (entry.type === "reopen") return "Re-open request";
  return "System update";
}

function updateRequestStatus(requestId, status) {
  const request = requests.find((item) => item.id === requestId);
  if (!request || request.status === "Closed") return;

  const now = new Date().toISOString();
  request.status = status;
  request.updatedAt = now;

  if (status === "Resolved") {
    request.resolvedAt = now;
  }

  if (status === "Closed") {
    request.closedAt = now;
    request.activity.push({
      id: createId(),
      type: "system",
      author: "Agent",
      text: "Case closed. This case cannot be re-opened; please raise a new support request if more help is needed.",
      createdAt: now,
      audience: "customer",
    });
  } else {
    request.activity.push({
      id: createId(),
      type: "system",
      author: "Agent",
      text: `Status changed to ${status}.`,
      createdAt: now,
      audience: "customer",
    });
  }

  saveAndRender(request.id);
}

function openResolveModal(requestId) {
  const request = requests.find((item) => item.id === requestId);
  if (!request || request.status === "Closed") return;
  pendingResolveRequestId = requestId;
  resolutionNotes.value = "";
  resolutionModal.classList.remove("hidden");
  resolutionNotes.focus();
}

function handleResolveSubmit(event) {
  event.preventDefault();
  const notes = resolutionNotes.value.trim();
  if (!notes || !pendingResolveRequestId) return;

  const request = requests.find((item) => item.id === pendingResolveRequestId);
  if (!request || request.status === "Closed") return;

  const now = new Date().toISOString();
  request.status = "Resolved";
  request.updatedAt = now;
  request.resolvedAt = now;
  request.closedAt = null;
  request.activity.push({
    id: createId(),
    type: "resolution",
    author: "Agent",
    text: `Your case has been resolved. Resolution notes: ${notes}`,
    createdAt: now,
    audience: "customer",
  });

  closeModal("resolution-modal");
  saveAndRender(request.id);
}

function addAgentUpdate(requestId) {
  const textarea = requestDetail.querySelector("#agent-update-text");
  const text = textarea.value.trim();

  if (!text) {
    alert("Please type an update first.");
    return;
  }

  const request = requests.find((item) => item.id === requestId);
  if (!request || request.status === "Closed") return;

  const now = new Date().toISOString();
  request.updatedAt = now;
  request.activity.push({
    id: createId(),
    type: updateType,
    author: "Agent",
    text,
    createdAt: now,
    audience: updateType === "note" ? "internal" : "customer",
  });

  if (request.status === "New") {
    request.status = "In Progress";
    request.activity.push({
      id: createId(),
      type: "system",
      author: "System",
      text: "Status changed to In Progress after agent update.",
      createdAt: now,
      audience: "customer",
    });
  }

  saveAndRender(request.id);
}

function reopenCaseAsAgent(requestId) {
  const request = requests.find((item) => item.id === requestId);
  if (!request || request.status !== "Resolved") return;

  const now = new Date().toISOString();
  request.status = "In Progress";
  request.updatedAt = now;
  request.resolvedAt = null;
  request.activity.push({
    id: createId(),
    type: "reopen",
    author: "Agent",
    text: "Case re-opened by agent.",
    createdAt: now,
    audience: "customer",
  });

  saveAndRender(request.id);
}

function handleCustomerSearch(event) {
  event.preventDefault();
  customerSearchEmail = customerEmailSearch.value.trim().toLowerCase();
  selectedCustomerRequestId = null;
  renderCustomerPortal();
}

function renderCustomerPortal(allowAutoClose = true) {
  if (allowAutoClose) {
    const closedCount = autoCloseResolvedRequests();
    if (closedCount > 0) saveRequests();
  }

  if (!customerSearchEmail) {
    customerRequestList.innerHTML = `<div class="no-results">Enter your email address to find your requests.</div>`;
    renderEmptyCustomerDetail();
    return;
  }

  const filtered = getCustomerFilteredRequests();
  customerRequestList.innerHTML = "";

  if (!filtered.length) {
    customerRequestList.innerHTML = `<div class="no-results">No matching requests found for this email and status filter.</div>`;
    selectedCustomerRequestId = null;
    renderEmptyCustomerDetail("No request selected", "Try another status filter or check the email address used when raising the request.");
    return;
  }

  if (!selectedCustomerRequestId || !filtered.some((request) => request.id === selectedCustomerRequestId)) {
    selectedCustomerRequestId = filtered[0].id;
  }

  filtered.forEach((request) => customerRequestList.appendChild(createRequestCard(request, "customer")));
  renderCustomerRequestDetail(selectedCustomerRequestId);
}

function getCustomerFilteredRequests() {
  const selectedStatus = customerStatusFilter.value;
  return requests.filter((request) => {
    const emailMatches = request.requesterEmail.toLowerCase() === customerSearchEmail;
    const statusMatches = selectedStatus === "All" || (selectedStatus === "Open" ? isOpenStatus(request.status) : request.status === selectedStatus);
    return emailMatches && statusMatches;
  });
}

function renderEmptyCustomerDetail(title = "Track a request", message = "Search using the email address used when the request was raised.") {
  customerRequestDetail.className = "card detail-panel empty-state";
  customerRequestDetail.innerHTML = `
    <div class="empty-illustration">🔎</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(message)}</p>
  `;
}

function renderCustomerRequestDetail(requestId) {
  const request = requests.find((item) => item.id === requestId);
  if (!request) {
    renderEmptyCustomerDetail();
    return;
  }

  customerRequestDetail.className = "card detail-panel";
  customerRequestDetail.innerHTML = "";
  const content = customerDetailTemplate.content.cloneNode(true);

  content.querySelector(".customer-request-number").textContent = request.requestNumber;
  content.querySelector(".customer-detail-subject").textContent = request.subject;
  content.querySelector(".customer-request-meta").textContent = getRequestMetaText(request);

  const statusPill = content.querySelector(".customer-status-pill");
  statusPill.textContent = request.status;
  statusPill.classList.add(statusClass(request.status));

  content.querySelector(".customer-category-info").textContent = request.category;
  content.querySelector(".customer-requester-info").textContent = `${request.requesterName} · ${request.requesterEmail}`;
  content.querySelector(".customer-details-text").textContent = request.details;

  const alertBox = content.querySelector(".customer-case-alert");
  const replyText = content.querySelector("#customer-reply-text");
  const replyButton = content.querySelector("#customer-add-reply");
  const reopenButton = content.querySelector("#customer-reopen-case");
  const replyHint = content.querySelector(".customer-reply-hint");

  setCustomerCaseAlert(request, alertBox);
  renderTimeline(request.activity, content.querySelector(".customer-timeline"), "customer");

  if (request.status === "Closed") {
    replyText.disabled = true;
    replyButton.disabled = true;
    replyHint.textContent = "This case is closed and cannot be re-opened. Please raise a new support request if you need more help.";
  } else if (request.status === "Resolved") {
    replyText.disabled = true;
    replyButton.disabled = true;
    reopenButton.classList.remove("hidden");
    replyHint.textContent = "This case is resolved. You can re-open it within the portal if more work is needed.";
    reopenButton.addEventListener("click", () => openRequesterReopenModal(request.id));
  } else {
    replyHint.textContent = "Your reply will be visible to agents in the case activity.";
    replyButton.addEventListener("click", () => addCustomerReply(request.id));
  }

  customerRequestDetail.appendChild(content);
}

function setCustomerCaseAlert(request, container) {
  container.className = "customer-case-alert";

  if (request.status === "Closed") {
    container.classList.add("danger-alert");
    container.textContent = "This case is closed and cannot be re-opened. Please raise a new support request if further help is needed.";
    return;
  }

  if (request.status === "Resolved") {
    const closesOn = request.resolvedAt ? formatDateTime(addDays(request.resolvedAt, RESOLVED_AUTO_CLOSE_DAYS).toISOString()) : "14 days after resolution";
    container.classList.add("success-alert");
    container.textContent = `This case is resolved. It will automatically close after 14 days if it is not re-opened. Auto-close date: ${closesOn}.`;
    return;
  }

  container.classList.add("info-alert");
  container.textContent = "This case is open. Support can send updates here, and you can reply below.";
}

function addCustomerReply(requestId) {
  const textarea = customerRequestDetail.querySelector("#customer-reply-text");
  const text = textarea.value.trim();

  if (!text) {
    alert("Please type your reply first.");
    return;
  }

  const request = requests.find((item) => item.id === requestId);
  if (!request || request.status === "Closed" || request.status === "Resolved") return;

  const now = new Date().toISOString();
  request.updatedAt = now;
  request.activity.push({
    id: createId(),
    type: "customer-reply",
    author: request.requesterName,
    text,
    createdAt: now,
    audience: "customer",
  });

  if (request.status === "Waiting on Customer") {
    request.status = "In Progress";
    request.activity.push({
      id: createId(),
      type: "system",
      author: "System",
      text: "Status changed to In Progress after requester reply.",
      createdAt: now,
      audience: "customer",
    });
  }

  saveAndRender(request.id, true);
}

function openRequesterReopenModal(requestId) {
  const request = requests.find((item) => item.id === requestId);
  if (!request || request.status !== "Resolved") return;
  pendingRequesterReopenId = requestId;
  reopenReason.value = "";
  reopenModal.classList.remove("hidden");
  reopenReason.focus();
}

function handleRequesterReopenSubmit(event) {
  event.preventDefault();
  const reason = reopenReason.value.trim();
  if (!reason || !pendingRequesterReopenId) return;

  const request = requests.find((item) => item.id === pendingRequesterReopenId);
  if (!request || request.status !== "Resolved") return;

  const now = new Date().toISOString();
  request.status = "In Progress";
  request.updatedAt = now;
  request.resolvedAt = null;
  request.activity.push({
    id: createId(),
    type: "reopen",
    author: request.requesterName,
    text: `Requester re-opened the case. Reason: ${reason}`,
    createdAt: now,
    audience: "customer",
  });

  closeModal("reopen-modal");
  customerStatusFilter.value = "Open";
  saveAndRender(request.id, true);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add("hidden");

  if (modalId === "resolution-modal") {
    pendingResolveRequestId = null;
    resolutionNotes.value = "";
  }

  if (modalId === "reopen-modal") {
    pendingRequesterReopenId = null;
    reopenReason.value = "";
  }
}

function saveAndRender(requestId, preferCustomer = false) {
  saveRequests();
  selectedRequestId = requestId;
  selectedCustomerRequestId = requestId;
  renderInbox();
  renderCustomerPortal(false);

  if (preferCustomer) {
    renderCustomerRequestDetail(requestId);
  } else {
    renderRequestDetail(requestId);
  }
}

function exportRequests() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 2,
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

      requests = normaliseRequests(importedRequests);
      autoCloseResolvedRequests();
      selectedRequestId = null;
      selectedCustomerRequestId = null;
      saveRequests();
      updateCounterFromRequests();
      renderInbox();
      renderCustomerPortal();
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
  selectedCustomerRequestId = null;
  customerSearchEmail = "";
  customerEmailSearch.value = "";
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(COUNTER_KEY);
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  LEGACY_COUNTER_KEYS.forEach((key) => localStorage.removeItem(key));
  renderInbox();
  renderCustomerPortal();
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
