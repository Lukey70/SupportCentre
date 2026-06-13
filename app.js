const STORAGE_KEY = "supportRequestPortal.requests.v3";
const LEGACY_STORAGE_KEYS = ["supportRequestPortal.requests.v2", "supportRequestPortal.requests.v1"];
const COUNTER_KEY = "supportRequestPortal.counter.v3";
const LEGACY_COUNTER_KEYS = ["supportRequestPortal.counter.v2", "supportRequestPortal.counter.v1"];
const AGENTS_KEY = "supportRequestPortal.agents.v3";
const CURRENT_AGENT_KEY = "supportRequestPortal.currentAgentId.v3";
const MAX_ATTACHMENT_BYTES = 2.5 * 1024 * 1024;
const RESOLVED_AUTO_CLOSE_DAYS = 14;
const OPEN_STATUSES = ["New", "In Progress", "Waiting on Customer"];
const CATEGORIES = ["ICT", "Finance Service", "Human Resources"];
const DEFAULT_AGENT = {
  id: "agent-luke-mcguiness",
  firstName: "Luke",
  lastName: "McGuiness",
  email: "Luke2003@outlook.com.au",
  password: "1234",
};

let requests = normaliseRequests(loadRequests());
let agents = normaliseAgents(loadAgents());
let selectedRequestId = null;
let selectedCustomerRequestId = null;
let customerSearchEmail = "";
let updateType = "reply";
let pendingResolveRequestId = null;
let pendingRequesterReopenId = null;
let currentAgentId = sessionStorage.getItem(CURRENT_AGENT_KEY) || "";

const navButtons = document.querySelectorAll(".nav-btn");
const pageSections = document.querySelectorAll(".page-section");
const supportForm = document.getElementById("support-form");
const fileInput = document.getElementById("request-attachments");
const selectedFiles = document.getElementById("selected-files");
const successBox = document.getElementById("submission-success");
const searchInput = document.getElementById("search-requests");
const statusFilter = document.getElementById("status-filter");
const categoryFilter = document.getElementById("category-filter");
const requestList = document.getElementById("request-list");
const requestDetail = document.getElementById("request-detail");
const detailTemplate = document.getElementById("request-detail-template");
const exportButton = document.getElementById("export-data");
const importInput = document.getElementById("import-data");
const clearButton = document.getElementById("clear-data");
const settingsButton = document.getElementById("settings-button");
const statTotal = document.getElementById("stat-total");
const statOpen = document.getElementById("stat-open");
const statResolved = document.getElementById("stat-resolved");

const agentLoginCard = document.getElementById("agent-login-card");
const agentWorkspace = document.getElementById("agent-workspace");
const agentLoginForm = document.getElementById("agent-login-form");
const agentLoginSelect = document.getElementById("agent-login-select");
const agentLoginPassword = document.getElementById("agent-login-password");
const agentLoginError = document.getElementById("agent-login-error");
const currentAgentName = document.getElementById("current-agent-name");
const agentLogoutButton = document.getElementById("agent-logout");
const agentForm = document.getElementById("agent-form");
const agentList = document.getElementById("agent-list");
const backToAgentInbox = document.getElementById("back-to-agent-inbox");

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

fileInput.addEventListener("change", () => renderFileSelection(fileInput, selectedFiles));
supportForm.addEventListener("submit", handleSupportSubmit);
searchInput.addEventListener("input", renderInbox);
statusFilter.addEventListener("change", renderInbox);
categoryFilter.addEventListener("change", renderInbox);
exportButton.addEventListener("click", exportRequests);
importInput.addEventListener("change", importRequests);
clearButton.addEventListener("click", clearRequests);
settingsButton.addEventListener("click", () => {
  switchSection("settings-section");
  renderSettings();
});
backToAgentInbox.addEventListener("click", () => switchSection("agent-section"));

agentLoginForm.addEventListener("submit", handleAgentLogin);
agentLogoutButton.addEventListener("click", handleAgentLogout);
agentForm.addEventListener("submit", handleAddAgent);
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

ensureDefaultAgentAvailable();
const initialAutoClosedCount = autoCloseResolvedRequests();
if (initialAutoClosedCount > 0) saveRequests();
else saveRequests();
populateAgentLoginSelect();
renderAgentArea();
renderInbox();
renderCustomerPortal();
renderSettings();

function switchSection(targetId) {
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.target === targetId));
  pageSections.forEach((section) => section.classList.toggle("active", section.id === targetId));
  if (targetId === "agent-section") renderAgentArea();
  if (targetId === "settings-section") renderSettings();
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error("Could not save requests", error);
  }
}

function loadAgents() {
  try {
    const stored = localStorage.getItem(AGENTS_KEY);
    return stored ? JSON.parse(stored) : [{ ...DEFAULT_AGENT }];
  } catch (error) {
    console.error("Could not load agents", error);
    return [{ ...DEFAULT_AGENT }];
  }
}

function saveAgents() {
  try {
    localStorage.setItem(AGENTS_KEY, JSON.stringify(agents));
  } catch (error) {
    console.error("Could not save agents", error);
  }
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normaliseAgents(items) {
  const source = Array.isArray(items) ? items : [];
  const cleaned = source
    .filter((agent) => agent && agent.firstName && agent.lastName && agent.email)
    .map((agent) => ({
      id: agent.id || createId(),
      firstName: String(agent.firstName).trim(),
      lastName: String(agent.lastName).trim(),
      email: String(agent.email).trim(),
      password: String(agent.password ?? ""),
    }))
    .filter((agent) => agent.firstName && agent.lastName && agent.email);

  const defaultEmail = DEFAULT_AGENT.email.toLowerCase();
  const existingDefault = cleaned.find((agent) => agent.email.toLowerCase() === defaultEmail);
  if (!existingDefault) {
    cleaned.unshift({ ...DEFAULT_AGENT });
  } else {
    existingDefault.id = existingDefault.id || DEFAULT_AGENT.id;
    existingDefault.password = existingDefault.password || DEFAULT_AGENT.password;
  }

  return cleaned;
}

function ensureDefaultAgentAvailable() {
  agents = normaliseAgents(agents);
  if (!agents.length) agents = [{ ...DEFAULT_AGENT }];
  if (currentAgentId && !agents.some((agent) => agent.id === currentAgentId)) {
    currentAgentId = "";
    sessionStorage.removeItem(CURRENT_AGENT_KEY);
  }
  saveAgents();
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
      attachments: Array.isArray(entry.attachments) ? entry.attachments : [],
    })) : [];

    if (!activity.length) {
      activity.push({
        id: createId(),
        type: "system",
        author: "System",
        text: "Request created.",
        createdAt,
        audience: "customer",
        attachments: [],
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
      category: CATEGORIES.includes(request.category) ? request.category : "ICT",
      subject: request.subject || "Untitled request",
      details: request.details || "",
      attachments: Array.isArray(request.attachments) ? request.attachments : [],
      assignedAgentId: request.assignedAgentId || null,
      activity,
    };
  });
}

function inferAudience(type) {
  if (type === "note" || type === "assignment") return "internal";
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

function getCurrentAgent() {
  return agents.find((agent) => agent.id === currentAgentId) || null;
}

function getAgentById(agentId) {
  return agents.find((agent) => agent.id === agentId) || null;
}

function displayAgentName(agent) {
  if (!agent) return "Agent";
  const initial = agent.lastName ? `${agent.lastName.trim().charAt(0).toUpperCase()}` : "";
  return initial ? `${agent.firstName} ${initial}` : agent.firstName;
}

function fullAgentName(agent) {
  if (!agent) return "Unassigned";
  return `${agent.firstName} ${agent.lastName}`.trim();
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
      attachments: [],
    });
    closedCount += 1;
  });

  return closedCount;
}

function renderFileSelection(input, list) {
  list.innerHTML = "";
  const files = [...input.files];
  if (!files.length) return;
  files.forEach((file) => {
    const item = document.createElement("li");
    item.innerHTML = `<span>${escapeHtml(file.name)}</span><span>${formatFileSize(file.size)}</span>`;
    list.appendChild(item);
  });
}

function validateAttachmentSize(files) {
  const totalAttachmentSize = files.reduce((total, file) => total + file.size, 0);
  if (totalAttachmentSize > MAX_ATTACHMENT_BYTES) {
    alert(`Attachments are too large for this browser-only demo. Please keep the total under ${formatFileSize(MAX_ATTACHMENT_BYTES)}.`);
    return false;
  }
  return true;
}

async function handleSupportSubmit(event) {
  event.preventDefault();

  const formData = new FormData(supportForm);
  const files = [...fileInput.files];
  if (!validateAttachmentSize(files)) return;

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
    assignedAgentId: null,
    activity: [
      {
        id: createId(),
        type: "system",
        author: "System",
        text: "Request created.",
        createdAt: now,
        audience: "customer",
        attachments: [],
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

function renderAgentArea() {
  const agent = getCurrentAgent();
  populateAgentLoginSelect();

  if (!agent) {
    agentLoginCard.classList.remove("hidden");
    agentWorkspace.classList.add("hidden");
    return;
  }

  agentLoginCard.classList.add("hidden");
  agentWorkspace.classList.remove("hidden");
  currentAgentName.textContent = `${fullAgentName(agent)} (${agent.email})`;
  renderInbox();
}

function populateAgentLoginSelect() {
  if (!agentLoginSelect) return;

  agents = normaliseAgents(agents);
  const currentValue = agentLoginSelect.value;
  agentLoginSelect.replaceChildren();

  agents.forEach((agent) => {
    const option = document.createElement("option");
    option.value = agent.id;
    option.textContent = `${fullAgentName(agent)} · ${agent.email}`;
    agentLoginSelect.appendChild(option);
  });

  if (agents.some((agent) => agent.id === currentValue)) {
    agentLoginSelect.value = currentValue;
  } else if (agents.length > 0) {
    agentLoginSelect.value = agents[0].id;
  }
}

function handleAgentLogin(event) {
  event.preventDefault();
  const agent = getAgentById(agentLoginSelect.value);
  const password = agentLoginPassword.value;

  if (!agent || agent.password !== password) {
    agentLoginError.textContent = "The selected agent or password is incorrect.";
    agentLoginError.classList.remove("hidden");
    return;
  }

  currentAgentId = agent.id;
  sessionStorage.setItem(CURRENT_AGENT_KEY, currentAgentId);
  agentLoginPassword.value = "";
  agentLoginError.classList.add("hidden");
  renderAgentArea();
}

function handleAgentLogout() {
  currentAgentId = "";
  sessionStorage.removeItem(CURRENT_AGENT_KEY);
  selectedRequestId = null;
  renderAgentArea();
  renderEmptyDetail();
}

function renderInbox() {
  const closedCount = autoCloseResolvedRequests();
  if (closedCount > 0) saveRequests();

  if (!getCurrentAgent()) {
    requestList.innerHTML = "";
    renderCustomerPortal(false);
    return;
  }

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
  const selectedCategory = categoryFilter.value;
  const agent = getCurrentAgent();

  return requests.filter((request) => {
    let statusMatches = false;
    if (selectedStatus === "All") statusMatches = true;
    else if (selectedStatus === "Open") statusMatches = isOpenStatus(request.status);
    else if (selectedStatus === "AssignedToMe") statusMatches = Boolean(agent && request.assignedAgentId === agent.id);
    else statusMatches = request.status === selectedStatus;

    const categoryMatches = selectedCategory === "All" || request.category === selectedCategory;
    const assignedAgent = getAgentById(request.assignedAgentId);
    const searchable = [
      request.requestNumber,
      request.requesterName,
      request.requesterEmail,
      request.category,
      request.subject,
      request.details,
      request.status,
      assignedAgent ? fullAgentName(assignedAgent) : "Unassigned",
    ].join(" ").toLowerCase();
    return statusMatches && categoryMatches && searchable.includes(term);
  });
}

function createRequestCard(request, mode) {
  const button = document.createElement("button");
  button.type = "button";
  const activeId = mode === "customer" ? selectedCustomerRequestId : selectedRequestId;
  button.className = `request-card ${request.id === activeId ? "active" : ""}`;
  button.setAttribute("role", "listitem");
  const assignedAgent = getAgentById(request.assignedAgentId);
  const agentLine = mode === "agent" ? `<p>Assigned: ${escapeHtml(assignedAgent ? displayAgentName(assignedAgent) : "Unassigned")}</p>` : "";
  button.innerHTML = `
    <div class="request-card-top">
      <span class="request-id">${escapeHtml(request.requestNumber)}</span>
      <span class="status-pill ${statusClass(request.status)}">${escapeHtml(request.status)}</span>
    </div>
    <h3>${escapeHtml(request.subject)}</h3>
    <p>${escapeHtml(mode === "customer" ? request.category : `${request.requesterName} · ${request.category}`)}</p>
    ${agentLine}
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
  const agent = getCurrentAgent();
  if (!request || !agent) {
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
  content.querySelector(".details-text").textContent = request.details;

  const categorySelect = content.querySelector("#agent-category-select");
  categorySelect.innerHTML = CATEGORIES.map((category) => `<option${category === request.category ? " selected" : ""}>${escapeHtml(category)}</option>`).join("");
  categorySelect.addEventListener("change", () => changeRequestCategory(request.id, categorySelect.value));

  const assigneeSelect = content.querySelector("#agent-assignee-select");
  populateAssigneeSelect(assigneeSelect, request.assignedAgentId);
  assigneeSelect.addEventListener("change", () => assignRequest(request.id, assigneeSelect.value || null, false));

  const attachmentsList = content.querySelector(".attachments-list");
  renderAttachments(request.attachments, attachmentsList, "No attachments were included with this request.");

  const statusActions = content.querySelector(".status-actions");
  renderAgentStatusActions(request, statusActions);

  const timeline = content.querySelector(".timeline");
  renderTimeline(request.activity, timeline, "agent");

  const addUpdateButton = content.querySelector("#add-update");
  const updateText = content.querySelector("#agent-update-text");
  const updateFiles = content.querySelector("#agent-update-attachments");
  const updateFileList = content.querySelector("#agent-update-file-list");
  const updatePanel = content.querySelector(".update-panel");

  updateFiles.addEventListener("change", () => renderFileSelection(updateFiles, updateFileList));

  content.querySelectorAll("[data-update-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.updateType === updateType);
    button.addEventListener("click", () => {
      updateType = button.dataset.updateType;
      renderRequestDetail(request.id);
    });
  });

  if (request.status === "Closed") {
    updateText.disabled = true;
    updateFiles.disabled = true;
    addUpdateButton.disabled = true;
    categorySelect.disabled = true;
    assigneeSelect.disabled = true;
    updatePanel.querySelector(".hint").textContent = "This case is closed and cannot be re-opened. Ask the customer to raise a new support request if more help is needed.";
  } else {
    addUpdateButton.addEventListener("click", () => addAgentUpdate(request.id));
  }

  requestDetail.appendChild(content);
}

function populateAssigneeSelect(select, selectedAgentId) {
  select.innerHTML = `<option value="">Unassigned</option>` + agents.map((agent) => `<option value="${escapeHtml(agent.id)}"${agent.id === selectedAgentId ? " selected" : ""}>${escapeHtml(fullAgentName(agent))}</option>`).join("");
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

  const startButton = makeActionButton("Start Work", "secondary-btn", () => updateRequestStatus(request.id, "In Progress", { assignToCurrent: true }));
  const waitingButton = makeActionButton("Waiting on Customer", "secondary-btn", () => updateRequestStatus(request.id, "Waiting on Customer"));
  const resolveButton = makeActionButton("Resolve", "primary-btn", () => openResolveModal(request.id));

  startButton.disabled = request.status === "In Progress" && request.assignedAgentId === currentAgentId;
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

function renderAttachments(attachments, container, emptyMessage = "No attachments.") {
  container.innerHTML = "";

  if (!attachments || !attachments.length) {
    container.innerHTML = `<p class="hint">${escapeHtml(emptyMessage)}</p>`;
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

function renderInlineAttachments(attachments) {
  if (!attachments || !attachments.length) return "";
  const items = attachments.map((attachment) => `
    <div class="attachment-item timeline-attachment">
      <span>${escapeHtml(attachment.name)} <small>(${formatFileSize(attachment.size)})</small></span>
      <a href="${attachment.dataUrl}" download="${escapeHtml(attachment.name)}">Download</a>
    </div>
  `).join("");
  return `<div class="timeline-attachments"><strong>Attachments</strong>${items}</div>`;
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
    const audienceLabel = mode === "agent" && entry.audience === "customer" ? " · visible to customer" : "";
    item.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      <span class="timeline-meta">${escapeHtml(entry.author)} · ${formatDateTime(entry.createdAt)}${audienceLabel}</span>
      <p>${escapeHtml(entry.text)}</p>
      ${renderInlineAttachments(entry.attachments)}
    `;
    container.appendChild(item);
  });
}

function activityTitle(entry, mode) {
  if (entry.type === "note") return "Internal note";
  if (entry.type === "reply") return mode === "customer" ? "Message from support" : "Reply to Customer";
  if (entry.type === "customer-reply") return "Customer reply";
  if (entry.type === "resolution") return "Resolution notes";
  if (entry.type === "reopen") return "Re-open request";
  if (entry.type === "assignment") return "Assignment update";
  if (entry.type === "category") return "Category update";
  return "System update";
}

function updateRequestStatus(requestId, status, options = {}) {
  const request = requests.find((item) => item.id === requestId);
  const agent = getCurrentAgent();
  if (!request || request.status === "Closed") return;

  const now = new Date().toISOString();
  request.status = status;
  request.updatedAt = now;

  if (options.assignToCurrent && agent) {
    request.assignedAgentId = agent.id;
  }

  if (isOpenStatus(status)) {
    request.resolvedAt = null;
  }

  if (status === "Resolved") {
    request.resolvedAt = now;
  }

  if (status === "Closed") {
    request.closedAt = now;
    request.activity.push({
      id: createId(),
      type: "system",
      author: agent ? displayAgentName(agent) : "Agent",
      text: "Case closed. This case cannot be re-opened; please raise a new support request if more help is needed.",
      createdAt: now,
      audience: "customer",
      attachments: [],
    });
  } else {
    const assignmentText = options.assignToCurrent && agent ? ` Assigned to ${displayAgentName(agent)}.` : "";
    request.activity.push({
      id: createId(),
      type: "system",
      author: agent ? displayAgentName(agent) : "Agent",
      text: `Status changed to ${status}.${assignmentText}`,
      createdAt: now,
      audience: "customer",
      attachments: [],
    });
  }

  saveAndRender(request.id);
}

function assignRequest(requestId, agentId, silentIfSame = true) {
  const request = requests.find((item) => item.id === requestId);
  const currentAgent = getCurrentAgent();
  if (!request || request.status === "Closed") return;
  if (silentIfSame && request.assignedAgentId === agentId) return;

  const oldAgent = getAgentById(request.assignedAgentId);
  const newAgent = getAgentById(agentId);
  request.assignedAgentId = agentId || null;
  request.updatedAt = new Date().toISOString();
  request.activity.push({
    id: createId(),
    type: "assignment",
    author: currentAgent ? displayAgentName(currentAgent) : "Agent",
    text: `Assignment changed from ${oldAgent ? displayAgentName(oldAgent) : "Unassigned"} to ${newAgent ? displayAgentName(newAgent) : "Unassigned"}.`,
    createdAt: request.updatedAt,
    audience: "internal",
    attachments: [],
  });
  saveAndRender(request.id);
}

function changeRequestCategory(requestId, newCategory) {
  const request = requests.find((item) => item.id === requestId);
  const currentAgent = getCurrentAgent();
  if (!request || request.status === "Closed" || !CATEGORIES.includes(newCategory)) return;
  if (request.category === newCategory) return;

  const oldCategory = request.category;
  request.category = newCategory;
  request.updatedAt = new Date().toISOString();
  request.activity.push({
    id: createId(),
    type: "category",
    author: currentAgent ? displayAgentName(currentAgent) : "Agent",
    text: `Category changed from ${oldCategory} to ${newCategory}.`,
    createdAt: request.updatedAt,
    audience: "internal",
    attachments: [],
  });
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
  const agent = getCurrentAgent();
  if (!request || request.status === "Closed") return;

  const now = new Date().toISOString();
  request.status = "Resolved";
  request.updatedAt = now;
  request.resolvedAt = now;
  request.closedAt = null;
  request.activity.push({
    id: createId(),
    type: "resolution",
    author: agent ? displayAgentName(agent) : "Agent",
    text: `Your case has been resolved. Resolution notes: ${notes}`,
    createdAt: now,
    audience: "customer",
    attachments: [],
  });

  closeModal("resolution-modal");
  saveAndRender(request.id);
}

async function addAgentUpdate(requestId) {
  const textarea = requestDetail.querySelector("#agent-update-text");
  const fileInputEl = requestDetail.querySelector("#agent-update-attachments");
  const text = textarea.value.trim();
  const files = [...fileInputEl.files];

  if (!text && !files.length) {
    alert("Please type an update or attach a file first.");
    return;
  }

  if (!validateAttachmentSize(files)) return;

  const request = requests.find((item) => item.id === requestId);
  const agent = getCurrentAgent();
  if (!request || request.status === "Closed") return;

  const now = new Date().toISOString();
  request.updatedAt = now;
  if (!request.assignedAgentId && agent) request.assignedAgentId = agent.id;

  request.activity.push({
    id: createId(),
    type: updateType,
    author: agent ? displayAgentName(agent) : "Agent",
    text: text || (files.length ? "Attached file(s)." : ""),
    createdAt: now,
    audience: updateType === "note" ? "internal" : "customer",
    attachments: await readAttachments(files),
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
      attachments: [],
    });
  }

  saveAndRender(request.id);
}

function reopenCaseAsAgent(requestId) {
  const request = requests.find((item) => item.id === requestId);
  const agent = getCurrentAgent();
  if (!request || request.status !== "Resolved") return;

  const now = new Date().toISOString();
  request.status = "In Progress";
  request.updatedAt = now;
  request.resolvedAt = null;
  request.activity.push({
    id: createId(),
    type: "reopen",
    author: agent ? displayAgentName(agent) : "Agent",
    text: "Case re-opened by agent.",
    createdAt: now,
    audience: "customer",
    attachments: [],
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
    customerRequestList.innerHTML = `<div class="no-results">No requests found for this email and status filter.</div>`;
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
  const replyFiles = content.querySelector("#customer-reply-attachments");
  const replyFileList = content.querySelector("#customer-reply-file-list");
  const replyButton = content.querySelector("#customer-add-reply");
  const reopenButton = content.querySelector("#customer-reopen-case");
  const replyHint = content.querySelector(".customer-reply-hint");

  replyFiles.addEventListener("change", () => renderFileSelection(replyFiles, replyFileList));
  setCustomerCaseAlert(request, alertBox);
  renderTimeline(request.activity, content.querySelector(".customer-timeline"), "customer");

  if (request.status === "Closed") {
    replyText.disabled = true;
    replyFiles.disabled = true;
    replyButton.disabled = true;
    replyHint.textContent = "This case is closed and cannot be re-opened. Please raise a new support request if you need more help.";
  } else if (request.status === "Resolved") {
    replyText.disabled = true;
    replyFiles.disabled = true;
    replyButton.disabled = true;
    reopenButton.classList.remove("hidden");
    replyHint.textContent = "This case is resolved. You can re-open it within the portal if more work is needed.";
    reopenButton.addEventListener("click", () => openRequesterReopenModal(request.id));
  } else {
    replyHint.textContent = "Your reply and attachments will be visible to agents in the case activity.";
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

async function addCustomerReply(requestId) {
  const textarea = customerRequestDetail.querySelector("#customer-reply-text");
  const fileInputEl = customerRequestDetail.querySelector("#customer-reply-attachments");
  const text = textarea.value.trim();
  const files = [...fileInputEl.files];

  if (!text && !files.length) {
    alert("Please type a reply or attach a file first.");
    return;
  }

  if (!validateAttachmentSize(files)) return;

  const request = requests.find((item) => item.id === requestId);
  if (!request || request.status === "Closed" || request.status === "Resolved") return;

  const now = new Date().toISOString();
  request.updatedAt = now;
  request.activity.push({
    id: createId(),
    type: "customer-reply",
    author: request.requesterName,
    text: text || (files.length ? "Attached file(s)." : ""),
    createdAt: now,
    audience: "customer",
    attachments: await readAttachments(files),
  });

  if (request.status === "Waiting on Customer") {
    request.status = "In Progress";
    request.activity.push({
      id: createId(),
      type: "system",
      author: "System",
      text: "Status changed to In Progress after customer reply.",
      createdAt: now,
      audience: "customer",
      attachments: [],
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
    text: `Customer re-opened the case. Reason: ${reason}`,
    createdAt: now,
    audience: "customer",
    attachments: [],
  });

  closeModal("reopen-modal");
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
  } else if (getCurrentAgent()) {
    renderRequestDetail(requestId);
  }
}

function handleAddAgent(event) {
  event.preventDefault();
  const firstName = document.getElementById("agent-first-name").value.trim();
  const lastName = document.getElementById("agent-last-name").value.trim();
  const email = document.getElementById("agent-email").value.trim();
  const password = document.getElementById("agent-password").value;

  if (!firstName || !lastName || !email || !password) return;
  if (agents.some((agent) => agent.email.toLowerCase() === email.toLowerCase())) {
    alert("An agent with this email already exists.");
    return;
  }

  agents.push({ id: createId(), firstName, lastName, email, password });
  saveAgents();
  agentForm.reset();
  populateAgentLoginSelect();
  renderSettings();
  renderInbox();
}

function renderSettings() {
  if (!agentList) return;
  agentList.innerHTML = "";
  agents.forEach((agent) => {
    const item = document.createElement("div");
    item.className = "agent-list-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(fullAgentName(agent))}</strong>
        <p>${escapeHtml(agent.email)}</p>
      </div>
      <span class="agent-badge">${escapeHtml(displayAgentName(agent))}</span>
    `;
    agentList.appendChild(item);
  });
}

function exportRequests() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 3,
    requests,
    agents,
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
      if (Array.isArray(parsed.agents)) {
        agents = normaliseAgents(parsed.agents);
        saveAgents();
      }
      autoCloseResolvedRequests();
      selectedRequestId = null;
      selectedCustomerRequestId = null;
      saveRequests();
      updateCounterFromRequests();
      populateAgentLoginSelect();
      renderAgentArea();
      renderInbox();
      renderCustomerPortal();
      renderSettings();
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
  const confirmed = confirm("Clear all saved requests from this browser? Agent settings will be kept.");
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
