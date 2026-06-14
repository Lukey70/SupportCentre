const CONFIG = window.SUPPORT_PORTAL_CONFIG || {};
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_KEY = CONFIG.SUPABASE_PUBLISHABLE_KEY || CONFIG.SUPABASE_ANON_KEY;
const BUCKET = "case-attachments";
const CATEGORIES = ["ICT", "Finance Service", "Human Resources"];

let supabaseClient = null;
let selectedCustomerCase = null;
let selectedCustomerMessages = [];
let selectedCustomerAttachments = [];
let pendingRequesterReopenCase = null;

const $ = (id) => document.getElementById(id);

const navButtons = document.querySelectorAll(".nav-btn");
const pageSections = document.querySelectorAll(".page-section");
const supportForm = $("support-form");
const fileInput = $("request-attachments");
const selectedFiles = $("selected-files");
const successBox = $("submission-success");
const customerSearchForm = $("customer-search-form");
const customerCaseNumberSearch = $("customer-case-number-search");
const customerEmailSearch = $("customer-email-search");
const customerRequestList = $("customer-request-list");
const customerRequestDetail = $("customer-request-detail");
const reopenModal = $("reopen-modal");
const reopenForm = $("reopen-form");
const reopenReason = $("reopen-reason");

init().catch((error) => showFatalError(error));

async function init() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase configuration is missing. Check config.js.");
  if (!window.supabase || typeof window.supabase.createClient !== "function") throw new Error("Supabase client library did not load.");
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  ensureRequestCategoryOptions();
  bindEvents();
  renderCustomerEmpty();
}

function bindEvents() {
  navButtons.forEach((button) => button.addEventListener("click", () => switchSection(button.dataset.target)));
  fileInput?.addEventListener("change", () => renderFileSelection(fileInput, selectedFiles));
  supportForm?.addEventListener("submit", handleSupportSubmit);
  customerSearchForm?.addEventListener("submit", handleCustomerLookup);
  reopenForm?.addEventListener("submit", handleRequesterReopenSubmit);
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.closeModal)));
  reopenModal?.addEventListener("click", (event) => { if (event.target === reopenModal) closeModal("reopen-modal"); });
}

function switchSection(targetId) {
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.target === targetId));
  pageSections.forEach((section) => section.classList.toggle("active", section.id === targetId));
}

async function rpc(name, args = {}) {
  const { data, error } = await supabaseClient.rpc(name, args);
  if (error) throw new Error(error.message || `Supabase RPC failed: ${name}`);
  if (data && data.success === false) throw new Error(data.message || `Request failed: ${name}`);
  return data;
}

async function handleSupportSubmit(event) {
  event.preventDefault();
  const customerFirstName = getTrimmedValue("requester-first-name");
  const customerLastName = getTrimmedValue("requester-last-name");
  const customerEmail = getTrimmedValue("requester-email").toLowerCase();
  const selectedCategory = getSelectedRequestCategory();
  const subject = getTrimmedValue("request-subject");
  const details = getTrimmedValue("request-details");

  const validationMessage = validateSupportRequestForm({ customerFirstName, customerLastName, customerEmail, selectedCategory, subject, details });
  if (validationMessage) {
    showToast(validationMessage);
    focusFirstBlankSupportField({ customerFirstName, customerLastName, customerEmail, selectedCategory, subject, details });
    return;
  }

  setFormBusy(supportForm, true);
  try {
    const files = Array.from(fileInput.files || []);
    const data = await rpc("create_support_request_v2", {
      p_customer_first_name: customerFirstName,
      p_customer_last_name: customerLastName,
      p_customer_email: customerEmail,
      p_category: selectedCategory,
      p_subject: subject,
      p_description: details,
    });

    let attachmentWarning = "";
    if (files.length) {
      try {
        await uploadCustomerAttachments(files, {
          caseNumber: data.case_number,
          customerEmail,
          messageId: null,
          folder: "initial-request",
        });
      } catch (attachmentError) {
        attachmentWarning = `<br><span class="warning-text">The request was created, but one or more attachments did not upload: ${escapeHtml(attachmentError.message)}</span>`;
      }
    }

    supportForm.reset();
    ensureRequestCategoryOptions();
    renderFileSelection(fileInput, selectedFiles);
    successBox.classList.remove("hidden");
    successBox.innerHTML = `<strong>Request submitted.</strong><br>Your case number is <strong>${escapeHtml(data.case_number)}</strong>. Use this case number and your email address to track it.${attachmentWarning}`;
    switchSection("track-section");
    customerCaseNumberSearch.value = data.case_number;
    customerEmailSearch.value = customerEmail;
  } catch (error) {
    showToast(error.message);
  } finally {
    setFormBusy(supportForm, false);
  }
}

async function handleCustomerLookup(event) {
  event.preventDefault();
  const caseNumber = customerCaseNumberSearch.value.trim();
  const email = customerEmailSearch.value.trim();
  if (!caseNumber || !email) return;

  customerRequestList.innerHTML = `<div class="no-results">Searching...</div>`;
  renderCustomerLoading();
  try {
    const data = await rpc("lookup_customer_case", {
      p_case_number: caseNumber,
      p_customer_email: email,
    });
    selectedCustomerCase = data.case;
    selectedCustomerMessages = data.messages || [];
    selectedCustomerAttachments = data.attachments || [];
    renderCustomerCaseSummary();
    renderCustomerDetail();
  } catch (error) {
    selectedCustomerCase = null;
    selectedCustomerMessages = [];
    selectedCustomerAttachments = [];
    customerRequestList.innerHTML = `<div class="no-results">${escapeHtml(error.message)}</div>`;
    renderCustomerEmpty("No matching request found", "Check the case number and email address, then try again.");
  }
}

function renderCustomerLoading() {
  customerRequestDetail.className = "card detail-panel empty-state";
  customerRequestDetail.innerHTML = `<div class="empty-illustration">⌛</div><h3>Searching</h3><p>Looking up your case...</p>`;
}

function renderCustomerEmpty(title = "Track a request", message = "Search using the case number and email address used when the request was raised.") {
  if (!customerRequestDetail) return;
  customerRequestDetail.className = "card detail-panel empty-state";
  customerRequestDetail.innerHTML = `<div class="empty-illustration">🔎</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p>`;
}

function renderCustomerCaseSummary() {
  if (!selectedCustomerCase) return;
  customerRequestList.innerHTML = `
    <button type="button" class="request-item active">
      <span class="case-card-topline"><span class="request-number case-card-number">${escapeHtml(selectedCustomerCase.case_number)}</span><span class="status-pill case-list-status-pill ${statusClass(selectedCustomerCase.status)}">${escapeHtml(displayStatus(selectedCustomerCase.status))}</span></span>
      <strong>${escapeHtml(selectedCustomerCase.subject || "Untitled request")}</strong>
      <span>Category: ${escapeHtml(selectedCustomerCase.category || "Uncategorised")}</span>
    </button>
  `;
}

function renderCustomerDetail() {
  const c = selectedCustomerCase;
  if (!c) return renderCustomerEmpty();
  const isClosed = c.status === "Closed";
  const isResolved = c.status === "Resolved";
  const canCustomerReply = !isClosed && !isResolved;
  const attachmentsByMessage = groupAttachmentsByMessage(selectedCustomerAttachments);
  const initialAttachments = selectedCustomerAttachments.filter((a) => !a.message_id);
  const visibleMessages = selectedCustomerMessages.filter((m) => m.visible_to_customer !== false);

  customerRequestDetail.className = "card detail-panel";
  customerRequestDetail.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">${escapeHtml(c.case_number)}</p>
        <h3>${escapeHtml(c.subject || "Untitled request")}</h3>
        <p class="request-meta">Submitted ${formatDate(c.created_at)} · ${escapeHtml(c.customer_email)}</p>
      </div>
      <span class="status-pill ${statusClass(c.status)}">${escapeHtml(displayStatus(c.status))}</span>
    </div>
    ${isClosed ? `<div class="customer-case-alert warning-box">This case is closed and cannot be re-opened. Please raise a new support request if you need more help.</div>` : ""}
    ${isResolved ? `<div class="customer-case-alert success-box inline-box">This case is resolved. You can re-open it from this portal if it still needs work.</div>` : ""}
    <div class="detail-grid">
      <section><h4>Category</h4><p>${escapeHtml(c.category)}</p></section>
      <section><h4>Submitted by</h4><p>${escapeHtml(c.customer_name || "")}<br>${escapeHtml(c.customer_email)}</p></section>
    </div>
    <section class="request-message"><h4>Your request</h4><p>${nl2br(escapeHtml(c.description || ""))}</p></section>
    ${initialAttachments.length ? `<section class="attachments-section"><h4>Your attachments</h4>${renderAttachmentList(initialAttachments)}</section>` : ""}
    <section class="timeline-section customer-messages-section">
      <h4>Messages sent to you</h4>
      <div class="timeline">${renderTimeline(visibleMessages, attachmentsByMessage, true)}</div>
    </section>
    <section class="update-panel customer-reply-panel">
      <h4>Reply to this case</h4>
      <textarea id="customer-reply-text" rows="5" placeholder="Type your reply here or attach files..." ${canCustomerReply ? "" : "disabled"}></textarea>
      <div class="form-row compact attachment-input-row">
        <label for="customer-reply-attachments">Attach files</label>
        <input id="customer-reply-attachments" type="file" multiple ${canCustomerReply ? "" : "disabled"} />
        <ul id="customer-reply-file-list" class="file-list" aria-live="polite"></ul>
      </div>
      <div class="reply-actions">
        <button id="customer-add-reply" type="button" class="primary-btn" ${canCustomerReply ? "" : "disabled"}>Send Reply</button>
        <button id="customer-reopen-case" type="button" class="secondary-btn ${isResolved ? "" : "hidden"}">Re-open case</button>
      </div>
      <p class="hint">${isClosed ? "Closed cases cannot be replied to." : isResolved ? "Re-open the case if more work is needed." : "Your reply and attachments will be saved to the case."}</p>
    </section>
  `;

  const customerReplyAttachments = $("customer-reply-attachments");
  const customerReplyFileList = $("customer-reply-file-list");
  customerReplyAttachments?.addEventListener("change", () => renderFileSelection(customerReplyAttachments, customerReplyFileList));
  $("customer-add-reply")?.addEventListener("click", handleCustomerReplySubmit);
  $("customer-reopen-case")?.addEventListener("click", () => openRequesterReopenModal(c));
  bindDownloadButtons(customerRequestDetail);
}

async function handleCustomerReplySubmit() {
  if (!selectedCustomerCase) return;
  const textarea = $("customer-reply-text");
  const attachmentInput = $("customer-reply-attachments");
  const body = textarea.value.trim();
  const files = Array.from(attachmentInput.files || []);
  if (!body && !files.length) {
    showToast("Add a reply or attach a file before sending.");
    return;
  }
  try {
    const data = await rpc("customer_add_reply", {
      p_case_number: selectedCustomerCase.case_number,
      p_customer_email: selectedCustomerCase.customer_email,
      p_body: body || "Attached files.",
    });
    if (files.length) {
      await uploadCustomerAttachments(files, {
        caseNumber: selectedCustomerCase.case_number,
        customerEmail: selectedCustomerCase.customer_email,
        messageId: data.message_id,
        folder: data.message_id,
      });
    }
    await reloadCustomerCase();
    showToast("Reply sent to the case.");
  } catch (error) {
    showToast(error.message);
  }
}

function openRequesterReopenModal(caseData) {
  pendingRequesterReopenCase = caseData;
  reopenReason.value = "";
  openModal("reopen-modal");
}

async function handleRequesterReopenSubmit(event) {
  event.preventDefault();
  if (!pendingRequesterReopenCase) return;
  try {
    await rpc("customer_reopen_case", {
      p_case_number: pendingRequesterReopenCase.case_number,
      p_customer_email: pendingRequesterReopenCase.customer_email,
      p_reason: reopenReason.value.trim(),
    });
    closeModal("reopen-modal");
    await reloadCustomerCase();
    showToast("Case re-opened.");
  } catch (error) { showToast(error.message); }
}

async function reloadCustomerCase() {
  if (!selectedCustomerCase) return;
  const data = await rpc("lookup_customer_case", {
    p_case_number: selectedCustomerCase.case_number,
    p_customer_email: selectedCustomerCase.customer_email,
  });
  selectedCustomerCase = data.case;
  selectedCustomerMessages = data.messages || [];
  selectedCustomerAttachments = data.attachments || [];
  renderCustomerCaseSummary();
  renderCustomerDetail();
}

async function uploadCustomerAttachments(files, { caseNumber, customerEmail, messageId, folder }) {
  for (const file of files) {
    const filePath = buildFilePath(caseNumber, folder, file.name);
    await uploadFile(filePath, file);
    await rpc("customer_register_attachment", {
      p_case_number: caseNumber,
      p_customer_email: customerEmail,
      p_message_id: messageId,
      p_file_name: file.name,
      p_file_path: filePath,
      p_file_size: file.size,
      p_mime_type: file.type || "application/octet-stream",
    });
  }
}

async function uploadFile(filePath, file) {
  const { error } = await supabaseClient.storage.from(BUCKET).upload(filePath, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message || "Attachment upload failed.");
}

async function downloadAttachment(filePath, fileName) {
  try {
    const { data, error } = await supabaseClient.storage.from(BUCKET).download(filePath);
    if (error) throw error;
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "attachment";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) { showToast(error.message || "Could not download attachment."); }
}

function bindDownloadButtons(container) {
  container.querySelectorAll("[data-download-path]").forEach((button) => {
    button.addEventListener("click", () => downloadAttachment(button.dataset.downloadPath, button.dataset.fileName));
  });
}

function renderTimeline(messages, attachmentsByMessage, customerView) {
  if (!messages.length) return `<div class="no-results">No activity yet.</div>`;
  const sortedMessages = [...messages].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return sortedMessages.map((message) => {
    const attachments = attachmentsByMessage.get(message.id) || [];
    return `
      <article class="timeline-item ${message.visible_to_customer === false ? "internal" : ""}">
        <div class="timeline-topline">
          <strong>${escapeHtml(message.author_display || "System")}</strong>
          <span>${escapeHtml(labelForMessage(message))} · ${formatDate(message.created_at)}</span>
        </div>
        ${message.email_subject ? `<p class="email-subject"><strong>Subject:</strong> ${escapeHtml(message.email_subject)}</p>` : ""}
        ${message.to_emails && message.to_emails.length ? `<p class="email-meta"><strong>To:</strong> ${escapeHtml(message.to_emails.join(", "))}</p>` : ""}
        ${message.cc_emails && message.cc_emails.length ? `<p class="email-meta"><strong>CC:</strong> ${escapeHtml(message.cc_emails.join(", "))}</p>` : ""}
        <p>${nl2br(escapeHtml(message.body || ""))}</p>
        ${attachments.length ? renderAttachmentList(attachments) : ""}
        ${!customerView && message.visible_to_customer === false ? `<span class="internal-badge">Internal only</span>` : ""}
      </article>
    `;
  }).join("");
}

function renderAttachmentList(attachments) {
  if (!attachments || !attachments.length) return "";
  return `<ul class="attachment-list">${attachments.map((attachment) => `
    <li>
      <span>📎 ${escapeHtml(attachment.file_name)} ${attachment.file_size ? `<small>(${formatBytes(Number(attachment.file_size))})</small>` : ""}</span>
      <button type="button" class="link-btn" data-download-path="${escapeHtml(attachment.file_path)}" data-file-name="${escapeHtml(attachment.file_name)}">Download</button>
    </li>
  `).join("")}</ul>`;
}

function groupAttachmentsByMessage(attachments) {
  const map = new Map();
  (attachments || []).forEach((attachment) => {
    const key = attachment.message_id || "__initial";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(attachment);
  });
  return map;
}

function buildFilePath(caseNumber, folder, filename) {
  const safeCase = String(caseNumber || "case").replace(/[^a-z0-9_-]/gi, "-");
  const safeFolder = String(folder || "files").replace(/[^a-z0-9_-]/gi, "-");
  const safeName = String(filename || "attachment").replace(/[^a-z0-9._-]/gi, "-");
  const unique = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return `${safeCase}/${safeFolder}/${unique}-${safeName}`;
}

function getTrimmedValue(id) { return String($(id)?.value || "").trim(); }

function validateSupportRequestForm({ customerFirstName, customerLastName, customerEmail, selectedCategory, subject, details }) {
  if (!customerFirstName) return "Please enter your first name before submitting.";
  if (!customerLastName) return "Please enter your last name before submitting.";
  if (!customerEmail) return "Please enter your email address before submitting.";
  if (!selectedCategory) return "Please select ICT, Finance Service, or Human Resources before submitting.";
  if (!subject) return "Please enter a subject before submitting.";
  if (!details) return "Please enter the request details before submitting.";
  return "";
}

function focusFirstBlankSupportField({ customerFirstName, customerLastName, customerEmail, selectedCategory, subject, details }) {
  if (!customerFirstName) return $("requester-first-name")?.focus();
  if (!customerLastName) return $("requester-last-name")?.focus();
  if (!customerEmail) return $("requester-email")?.focus();
  if (!selectedCategory) return $("request-category")?.focus();
  if (!subject) return $("request-subject")?.focus();
  if (!details) return $("request-details")?.focus();
}

function getSelectedRequestCategory() {
  const select = $("request-category");
  const rawValue = select ? select.value : "";
  const selectedOptionText = select && select.selectedOptions && select.selectedOptions[0] ? select.selectedOptions[0].textContent : "";
  const fromValue = normaliseCategoryForBackend(rawValue);
  const fromText = normaliseCategoryForBackend(selectedOptionText);
  if (CATEGORIES.includes(fromValue)) return fromValue;
  if (CATEGORIES.includes(fromText)) return fromText;
  return "";
}

function ensureRequestCategoryOptions() {
  const select = $("request-category");
  if (!select) return;
  const current = normaliseCategoryForBackend(select.value);
  select.innerHTML = '<option value="" disabled>Select a category</option>' + CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("");
  select.value = CATEGORIES.includes(current) ? current : "";
}

function normaliseCategoryForBackend(value) {
  const clean = String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  if (clean === "ict") return "ICT";
  if (["finance", "financial service", "financial services", "finance service", "finance services"].includes(clean)) return "Finance Service";
  if (["human resources", "hr"].includes(clean)) return "Human Resources";
  return String(value || "").trim();
}

function labelForMessage(message) {
  const labels = {
    agent_reply: "Reply to Customer",
    customer_reply: "Customer reply",
    internal_note: "Internal note",
    resolution: "Resolution notes",
    reopen_request: "Re-open request",
    system: "System update",
    message: "Message",
  };
  return labels[message.message_type] || "Message";
}

function displayStatus(status) { return status === "Waiting on Customer" ? "Awaiting Info" : String(status || ""); }
function statusClass(status) { return `status-${String(status || "").toLowerCase().replace(/\s+/g, "-")}`; }

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function escapeHtml(value) { return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }
function nl2br(value) { return String(value).replace(/\n/g, "<br>"); }

function renderFileSelection(input, list) {
  if (!list) return;
  const files = Array.from(input?.files || []);
  list.innerHTML = files.length ? files.map((file) => `<li>${escapeHtml(file.name)} <span>${formatBytes(file.size)}</span></li>`).join("") : "";
}

function openModal(id) {
  const modal = $(id);
  if (!modal) { showToast("Popup could not be opened. Refresh the page and try again."); return; }
  modal.classList.remove("hidden");
  const firstField = modal.querySelector("input, textarea, select, button");
  if (firstField) setTimeout(() => firstField.focus(), 0);
}

function closeModal(id) {
  $(id)?.classList.add("hidden");
  if (id === "reopen-modal") pendingRequesterReopenCase = null;
}

function showToast(message) {
  let toast = $("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "app-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 4200);
}

function showFatalError(error) {
  document.body.innerHTML = `<main class="fatal-error card"><h1>Customer Portal could not start</h1><p>${escapeHtml(error.message)}</p><p>Check config.js, your Supabase project URL/key, and internet access.</p></main>`;
}

function setFormBusy(form, busy) {
  form?.querySelectorAll("button, input, textarea, select").forEach((element) => { element.disabled = busy; });
}
