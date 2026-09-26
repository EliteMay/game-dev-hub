const api = window.gameDevHub;

const el = {
  gitDot: document.querySelector("#git-dot"),
  gitValue: document.querySelector("#git-value"),
  godotDot: document.querySelector("#godot-dot"),
  godotValue: document.querySelector("#godot-value"),
  networkDot: document.querySelector("#network-dot"),
  networkValue: document.querySelector("#network-value"),
  projectsRoot: document.querySelector("#projects-root"),
  projectList: document.querySelector("#project-list"),
  emptyState: document.querySelector("#empty-state"),
  projectDetail: document.querySelector("#project-detail"),
  detailSlug: document.querySelector("#detail-slug"),
  detailName: document.querySelector("#detail-name"),
  detailPath: document.querySelector("#detail-path"),
  repoDot: document.querySelector("#repo-dot"),
  repoValue: document.querySelector("#repo-value"),
  repoDescription: document.querySelector("#repo-description"),
  branchDot: document.querySelector("#branch-dot"),
  branchValue: document.querySelector("#branch-value"),
  branchDescription: document.querySelector("#branch-description"),
  foundationDot: document.querySelector("#foundation-dot"),
  foundationValue: document.querySelector("#foundation-value"),
  foundationDescription: document.querySelector("#foundation-description"),
  foundationUpdate: document.querySelector("#foundation-update-button"),
  safetyRecovery: document.querySelector("#safety-recovery"),
  safetyRecoveryTitle: document.querySelector("#safety-recovery-title"),
  safetyRecoverySummary: document.querySelector("#safety-recovery-summary"),
  safetyChangeCount: document.querySelector("#safety-change-count"),
  safetyChangedFiles: document.querySelector("#safety-changed-files"),
  safetySave: document.querySelector("#safety-save-button"),
  safetyContinue: document.querySelector("#safety-continue-button"),
  safetyExport: document.querySelector("#safety-export-button"),
  safetyOpenFolder: document.querySelector("#safety-open-folder-button"),
  safetyRefresh: document.querySelector("#safety-refresh-button"),
  heroStatus: document.querySelector("#hero-status"),
  heroTitle: document.querySelector("#hero-title"),
  heroDescription: document.querySelector("#hero-description"),
  refresh: document.querySelector("#refresh-button"),
  diagnostics: document.querySelector("#diagnostics-button"),
  update: document.querySelector("#update-button"),
  updateRelease: document.querySelector("#update-release-button"),
  updateDot: document.querySelector("#update-dot"),
  updateValue: document.querySelector("#update-value"),
  updateProgress: document.querySelector("#update-progress"),
  godot: document.querySelector("#godot-button"),
  addProject: document.querySelector("#add-project-button"),
  createFoundationProject: document.querySelector("#create-foundation-project-button"),
  importProject: document.querySelector("#import-project-button"),
  start: document.querySelector("#start-button"),
  sync: document.querySelector("#sync-button"),
  editor: document.querySelector("#editor-button"),
  run: document.querySelector("#run-button"),
  folder: document.querySelector("#folder-button"),
  github: document.querySelector("#github-button"),
  remove: document.querySelector("#remove-project-button"),
  taskProgressBadge: document.querySelector("#task-progress-badge"),
  taskToggleCompleted: document.querySelector("#task-toggle-completed-button"),
  taskToggleFuture: document.querySelector("#task-toggle-future-button"),
  taskCurrentPhase: document.querySelector("#task-current-phase"),
  taskSource: document.querySelector("#task-source"),
  developmentTaskList: document.querySelector("#development-task-list"),
  taskEmpty: document.querySelector("#task-empty"),
  activeTaskGuide: document.querySelector("#active-task-guide"),
  activeTaskTitle: document.querySelector("#active-task-title"),
  activeTaskOwner: document.querySelector("#active-task-owner"),
  activeTaskSteps: document.querySelector("#active-task-steps"),
  activeTaskCompletion: document.querySelector("#active-task-completion"),
  taskGuideNote: document.querySelector("#task-guide-note"),
  taskClearSelection: document.querySelector("#task-clear-selection-button"),
  taskRunGame: document.querySelector("#task-run-game-button"),
  taskOpenEditor: document.querySelector("#task-open-editor-button"),
  taskExport: document.querySelector("#task-export-button"),
  taskVerification: document.querySelector("#task-verification"),
  taskVerificationSummary: document.querySelector("#task-verification-summary"),
  taskVerificationSteps: document.querySelector("#task-verification-steps"),
  taskVerificationNote: document.querySelector("#task-verification-note"),
  taskVerificationAddImage: document.querySelector("#task-verification-add-image-button"),
  taskVerificationClear: document.querySelector("#task-verification-clear-button"),
  taskVerificationSavedState: document.querySelector("#task-verification-saved-state"),
  exportChatGptPack: document.querySelector("#export-chatgpt-pack-button"),
  verificationOverview: document.querySelector("#verification-overview"),
  verificationOverviewCounts: document.querySelector("#verification-overview-counts"),
  verificationOverviewList: document.querySelector("#verification-overview-list"),
  verificationOverviewEmpty: document.querySelector("#verification-overview-empty"),
  addReferenceImage: document.querySelector("#add-reference-image-button"),
  referenceImageCount: document.querySelector("#reference-image-count"),
  referenceImageList: document.querySelector("#reference-image-list"),
  referenceImageEmpty: document.querySelector("#reference-image-empty"),
  clearLog: document.querySelector("#clear-log-button"),
  logList: document.querySelector("#log-list"),
  taskStatus: document.querySelector("#task-status"),
  appVersion: document.querySelector("#app-version"),
  foundationCreateDialog: document.querySelector("#foundation-create-dialog"),
  foundationCreateClose: document.querySelector("#foundation-create-close-button"),
  foundationCreateCancel: document.querySelector("#foundation-create-cancel-button"),
  foundationCreateForm: document.querySelector("#foundation-create-form"),
  foundationGameNameInput: document.querySelector("#foundation-game-name-input"),
  foundationRepositoryUrlInput: document.querySelector("#foundation-repository-url-input"),
  foundationCreateError: document.querySelector("#foundation-create-error"),
  addDialog: document.querySelector("#add-dialog"),
  addDialogClose: document.querySelector("#add-dialog-close-button"),
  addDialogCancel: document.querySelector("#add-dialog-cancel-button"),
  addForm: document.querySelector("#add-form"),
  saveChangesDialog: document.querySelector("#save-changes-dialog"),
  saveChangesClose: document.querySelector("#save-changes-close-button"),
  saveChangesCancel: document.querySelector("#save-changes-cancel-button"),
  saveChangesForm: document.querySelector("#save-changes-form"),
  saveChangesSummary: document.querySelector("#save-changes-summary"),
  saveChangesList: document.querySelector("#save-changes-list"),
  saveChangesSyncNote: document.querySelector("#save-changes-sync-note"),
  saveChangesMessageInput: document.querySelector("#save-changes-message-input"),
  nameInput: document.querySelector("#project-name-input"),
  urlInput: document.querySelector("#project-url-input"),
  removeDialog: document.querySelector("#remove-dialog"),
  removeDialogCancel: document.querySelector("#remove-dialog-cancel-button"),
  removeDialogText: document.querySelector("#remove-dialog-text"),
  confirmRemove: document.querySelector("#confirm-remove-button"),
  diagnosticsDialog: document.querySelector("#diagnostics-dialog"),
  diagnosticsClose: document.querySelector("#diagnostics-close-button"),
  diagnosticsApp: document.querySelector("#diagnostics-app"),
  diagnosticsElectron: document.querySelector("#diagnostics-electron"),
  diagnosticsOs: document.querySelector("#diagnostics-os"),
  diagnosticsNetwork: document.querySelector("#diagnostics-network"),
  diagnosticsUpdate: document.querySelector("#diagnostics-update"),
  diagnosticsProjects: document.querySelector("#diagnostics-projects"),
  diagnosticsDataPath: document.querySelector("#diagnostics-data-path"),
  diagnosticsLogsPath: document.querySelector("#diagnostics-logs-path"),
  diagnosticsLastError: document.querySelector("#diagnostics-last-error"),
  diagnosticsExport: document.querySelector("#diagnostics-export-button"),
  diagnosticsOpenLogs: document.querySelector("#diagnostics-open-logs-button"),
  diagnosticsClearLogs: document.querySelector("#diagnostics-clear-logs-button"),
  developmentTab: document.querySelector("#development-tab-button"),
  autoTestTab: document.querySelector("#auto-test-tab-button"),
  developmentTabPanel: document.querySelector("#development-tab-panel"),
  autoTestTabPanel: document.querySelector("#auto-test-tab-panel"),
  autoTestProjectName: document.querySelector("#auto-test-project-name"),
  autoTestExePath: document.querySelector("#auto-test-exe-path"),
  autoTestChooseExe: document.querySelector("#auto-test-choose-exe-button"),
  autoTestTargetVersion: document.querySelector("#auto-test-target-version"),
  autoTestGitCommit: document.querySelector("#auto-test-git-commit"),
  autoTestDate: document.querySelector("#auto-test-date"),
  autoTestWindowTitle: document.querySelector("#auto-test-window-title"),
  autoTestLaunchArgs: document.querySelector("#auto-test-launch-args"),
  autoTestEngine: document.querySelector("#auto-test-engine"),
  autoTestModelBaseUrl: document.querySelector("#auto-test-model-base-url"),
  autoTestModelName: document.querySelector("#auto-test-model-name"),
  autoTestApiKey: document.querySelector("#auto-test-api-key"),
  autoTestTimeout: document.querySelector("#auto-test-timeout"),
  autoTestMaxSteps: document.querySelector("#auto-test-max-steps"),
  autoTestDefinitions: document.querySelector("#auto-test-definitions"),
  autoTestSave: document.querySelector("#auto-test-save-button"),
  autoTestDiagnose: document.querySelector("#auto-test-diagnose-button"),
  autoTestStart: document.querySelector("#auto-test-start-button"),
  autoTestRetest: document.querySelector("#auto-test-retest-button"),
  autoTestStop: document.querySelector("#auto-test-stop-button"),
  autoTestOpenFolder: document.querySelector("#auto-test-open-folder-button"),
  autoTestProgressCount: document.querySelector("#auto-test-progress-count"),
  autoTestProgressElapsed: document.querySelector("#auto-test-progress-elapsed"),
  autoTestProgressTest: document.querySelector("#auto-test-progress-test"),
  autoTestProgressMessage: document.querySelector("#auto-test-progress-message"),
  autoTestProgressAction: document.querySelector("#auto-test-progress-action"),
  autoTestDiagnostics: document.querySelector("#auto-test-diagnostics"),
  autoTestSummaryTitle: document.querySelector("#auto-test-summary-title"),
  autoTestSummaryCounts: document.querySelector("#auto-test-summary-counts"),
  autoTestResultList: document.querySelector("#auto-test-result-list"),
  autoTestHistory: document.querySelector("#auto-test-history")
};

let state = null;
let selectedId = null;
let busy = false;
let referenceImages = [];
let referenceImagesProjectId = "";
let showCompletedTasks = false;
let showFutureTasks = false;
let projectTab = "development";
let autoTestState = null;
let autoTestRunning = false;

const actionButtons = [
  el.refresh,
  el.update,
  el.godot,
  el.addProject,
  el.createFoundationProject,
  el.importProject,
  el.start,
  el.sync,
  el.editor,
  el.run,
  el.folder,
  el.github,
  el.remove,
  el.exportChatGptPack,
  el.addReferenceImage,
  el.safetySave,
  el.safetyContinue,
  el.safetyExport,
  el.safetyOpenFolder,
  el.safetyRefresh,
  el.taskClearSelection,
  el.taskRunGame,
  el.taskOpenEditor,
  el.taskExport,
  el.taskVerificationAddImage,
  el.taskVerificationClear,
  el.autoTestChooseExe,
  el.autoTestSave,
  el.autoTestDiagnose,
  el.autoTestStart,
  el.autoTestRetest,
  el.autoTestOpenFolder
];

function setBusy(value, label = "") {
  busy = value;
  for (const button of actionButtons) {
    if (button) button.disabled = value;
  }

  const project = selectedProject();
  const repository = project?.repository || {};
  const foundation = project?.foundation || {};
  if (el.foundationUpdate) {
    el.foundationUpdate.disabled =
      value ||
      !foundation.installed ||
      !foundation.valid ||
      !repository.valid ||
      repository.dirty ||
      (repository.ahead || 0) > 0 ||
      repository.branch !== project?.defaultBranch ||
      !state?.network?.online;
  }

  el.taskStatus.textContent = value && label ? "処理中: " + label : "待機中";
  el.taskStatus.classList.toggle("active", value);
}

function setDot(node, tone) {
  node.classList.remove("ok", "warning", "error");
  if (tone) node.classList.add(tone);
}

function selectedProject() {
  return state?.projects?.find((project) => project.id === selectedId) ?? null;
}

function addLog(message, tone = "") {
  if (!message) return;

  const row = document.createElement("div");
  row.className = "log-entry" + (tone ? " " + tone : "");

  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const body = document.createElement("span");
  body.className = "log-message";
  body.textContent = message;

  row.append(time, body);
  el.logList.prepend(row);

  while (el.logList.children.length > 80) {
    el.logList.lastElementChild?.remove();
  }
}

function renderUpdate(update = state?.update) {
  if (!update) return;

  el.updateRelease.classList.toggle("hidden", update.status !== "error");
  el.updateProgress.classList.add("hidden");
  setDot(el.updateDot, "");

  if (update.status === "checking") {
    setDot(el.updateDot, "warning");
    el.updateValue.textContent = "更新を確認中";
    el.update.textContent = "確認中…";
    el.update.disabled = true;
  } else if (update.status === "available") {
    setDot(el.updateDot, "warning");
    el.updateValue.textContent = "v" + update.availableVersion + " があります";
    el.update.textContent = "更新をダウンロード";
    el.update.disabled = false;
  } else if (update.status === "downloading") {
    setDot(el.updateDot, "warning");
    el.updateValue.textContent = update.message || "ダウンロード中";
    el.updateProgress.textContent = String(update.percent ?? 0) + "%";
    el.updateProgress.classList.remove("hidden");
    el.update.textContent = "ダウンロード中";
    el.update.disabled = true;
  } else if (update.status === "downloaded") {
    setDot(el.updateDot, "ok");
    el.updateValue.textContent = "v" + update.availableVersion + " 準備完了";
    el.update.textContent = "再起動して更新";
    el.update.disabled = false;
  } else if (update.status === "not-available") {
    setDot(el.updateDot, "ok");
    el.updateValue.textContent = "最新版 v" + update.currentVersion;
    el.update.textContent = "更新を確認";
    el.update.disabled = false;
  } else if (update.status === "error") {
    setDot(el.updateDot, "error");
    el.updateValue.textContent = "更新確認に失敗";
    el.update.textContent = "再試行";
    el.update.disabled = false;
  } else if (update.status === "offline") {
    setDot(el.updateDot, "warning");
    el.updateValue.textContent = "オフライン";
    el.update.textContent = "更新を確認";
    el.update.disabled = false;
  } else if (update.status === "unsupported") {
    el.updateValue.textContent = "開発モード";
    el.update.textContent = "更新を確認";
    el.update.disabled = false;
  } else {
    el.updateValue.textContent = "v" + (update.currentVersion || state?.appVersion || "");
    el.update.textContent = "更新を確認";
    el.update.disabled = false;
  }
}

function renderGlobal() {
  if (!state) return;

  el.appVersion.textContent = "Game Dev Hub v" + state.appVersion;
  el.projectsRoot.textContent = state.settings?.projectsRoot || "未設定";
  renderUpdate(state.update);

  if (state.network?.online) {
    setDot(el.networkDot, "ok");
    el.networkValue.textContent = "オンライン";
  } else {
    setDot(el.networkDot, "warning");
    el.networkValue.textContent = "オフライン / ローカル操作可";
  }

  if (state.git?.available) {
    setDot(el.gitDot, "ok");
    el.gitValue.textContent = state.git.version || "使用可能";
  } else {
    setDot(el.gitDot, "error");
    el.gitValue.textContent = "Gitが見つかりません";
  }

  if (state.godot?.available) {
    setDot(el.godotDot, "ok");
    el.godotValue.textContent = state.godot.version || "使用可能";
  } else {
    setDot(el.godotDot, "warning");
    el.godotValue.textContent = "未設定";
  }
}

function projectStatusTone(project) {
  const repo = project.repository || {};

  if (!repo.exists) return "warning";
  if (!repo.valid) return "error";
  if (repo.dirty) return "warning";
  return "ok";
}

function renderProjectList() {
  el.projectList.replaceChildren();

  for (const project of state?.projects || []) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-row" + (project.id === selectedId ? " selected" : "");

    const top = document.createElement("div");
    top.className = "project-row-top";

    const name = document.createElement("strong");
    name.textContent = project.name;

    const dot = document.createElement("span");
    dot.className = "status-dot " + projectStatusTone(project);

    const slug = document.createElement("small");
    slug.textContent = project.repositorySlug;

    top.append(name, dot);
    button.append(top, slug);

    button.addEventListener("click", () => {
      selectedId = project.id;
      if (state?.settings) state.settings.lastSelectedProjectId = project.id;
      api.setSelectedProject(project.id).catch(() => {});
      referenceImagesProjectId = "";
      showCompletedTasks = false;
      showFutureTasks = false;
      autoTestState = null;
      render();
      refreshAutoTestState().catch(() => {});
    });

    el.projectList.append(button);
  }
}

function allDevelopmentTasks(tasks) {
  return (tasks?.sections || []).flatMap((section) =>
    section.tasks.map((task) => ({ ...task, section: section.title }))
  );
}

function activeDevelopmentTask(project) {
  const tasks = project?.development?.tasks;
  const activeTaskId = project?.development?.activeTaskId || "";
  if (!tasks?.available || !activeTaskId) return null;

  for (const section of tasks.sections) {
    const task = section.tasks.find((candidate) => candidate.id === activeTaskId && !candidate.done);
    if (task) {
      return {
        ...task,
        section: section.title,
        completionCriteria: section.completionCriteria || ""
      };
    }
  }

  return null;
}

function verificationForTask(project, taskId) {
  return project?.development?.verifications?.[taskId] || null;
}

function allUserVerificationRows(project) {
  const tasks = project?.development?.tasks;
  if (!tasks?.available) return [];

  return (tasks.sections || []).flatMap((section) =>
    (section.tasks || [])
      .filter((task) => task.owner === "user" && !task.done)
      .map((task) => ({
        ...task,
        section: section.title,
        completionCriteria: section.completionCriteria || "",
        verification: verificationForTask(project, task.id)
      }))
  );
}

function verificationStepCounts(task, verification) {
  const total = task?.steps?.length || 1;
  const counts = {
    total,
    passed: 0,
    failed: 0,
    blocked: 0,
    pending: total
  };

  if (!verification || verification.stale) return counts;

  counts.pending = 0;
  for (const step of verification.steps || []) {
    if (step.status === "passed") counts.passed += 1;
    else if (step.status === "failed") counts.failed += 1;
    else if (step.status === "blocked") counts.blocked += 1;
    else counts.pending += 1;
  }

  return counts;
}

function renderVerificationOverview(project) {
  const rows = allUserVerificationRows(project);
  el.verificationOverviewCounts.replaceChildren();
  el.verificationOverviewList.replaceChildren();
  el.verificationOverviewEmpty.classList.toggle("hidden", rows.length > 0);

  if (!rows.length) {
    el.exportChatGptPack.textContent = "今の状態をChatGPTへ";
    return;
  }

  const aggregate = {
    passed: 0,
    failed: 0,
    blocked: 0,
    progress: 0,
    stale: 0,
    untested: 0
  };
  let savedResultCount = 0;

  for (const row of rows) {
    const overall = row.verification?.overall || "untested";
    if (overall === "passed") aggregate.passed += 1;
    else if (overall === "failed") aggregate.failed += 1;
    else if (overall === "blocked") aggregate.blocked += 1;
    else if (overall === "in-progress") aggregate.progress += 1;
    else if (overall === "stale") aggregate.stale += 1;
    else aggregate.untested += 1;

    if (row.verification && overall !== "untested") savedResultCount += 1;
  }

  for (const [label, value, tone] of [
    ["できた", aggregate.passed, "ok"],
    ["問題あり", aggregate.failed, "error"],
    ["確認できない", aggregate.blocked, "warning"],
    ["確認途中", aggregate.progress, "warning"],
    ["再確認", aggregate.stale, "warning"],
    ["未確認", aggregate.untested, ""]
  ]) {
    if (!value) continue;
    const chip = document.createElement("span");
    chip.className = "verification-overview-chip";
    chip.dataset.tone = tone;
    chip.textContent = label + " " + value;
    el.verificationOverviewCounts.append(chip);
  }

  for (const row of rows) {
    const card = document.createElement("article");
    card.className = "verification-overview-item";

    const top = document.createElement("div");
    top.className = "verification-overview-item-top";

    const copy = document.createElement("div");
    copy.className = "verification-overview-item-copy";

    const phase = document.createElement("span");
    phase.textContent = row.section;

    const title = document.createElement("strong");
    title.textContent = row.text;

    copy.append(phase, title);

    const summary = verificationSummary(row.verification?.overall || "untested");
    const badge = document.createElement("span");
    badge.className = "verification-overview-status";
    badge.dataset.tone = summary.tone;
    badge.textContent = summary.label;

    top.append(copy, badge);
    card.append(top);

    const counts = verificationStepCounts(row, row.verification);
    const detail = document.createElement("p");

    if (!row.verification) {
      detail.textContent = "まだ結果を選んでいません。";
    } else if (row.verification.stale) {
      detail.textContent = "Roadmapの手順が変わったため、再確認が必要です。";
    } else {
      const parts = [];
      if (counts.passed) parts.push("できた " + counts.passed + "/" + counts.total);
      if (counts.failed) parts.push("できなかった " + counts.failed);
      if (counts.blocked) parts.push("確認できない " + counts.blocked);
      if (counts.pending) parts.push("未選択 " + counts.pending);
      detail.textContent = parts.join(" / ") || "確認結果なし";
    }

    card.append(detail);

    if (row.verification?.note && !row.verification.stale) {
      const note = document.createElement("p");
      note.className = "verification-overview-note";
      note.textContent = "メモ: " + row.verification.note;
      card.append(note);
    }

    el.verificationOverviewList.append(card);
  }

  el.exportChatGptPack.textContent = savedResultCount > 0
    ? savedResultCount + "件の確認結果をまとめてChatGPTへ"
    : "確認結果をまとめてChatGPTへ";
}

function verificationSummary(overall) {
  if (overall === "completed") return { label: "Roadmap完了済み", tone: "ok" };
  if (overall === "passed") return { label: "すべてできた", tone: "ok" };
  if (overall === "failed") return { label: "できなかった項目あり", tone: "error" };
  if (overall === "blocked") return { label: "確認できない項目あり", tone: "warning" };
  if (overall === "in-progress") return { label: "確認途中", tone: "warning" };
  if (overall === "stale") return { label: "手順変更・再確認", tone: "warning" };
  return { label: "未確認", tone: "" };
}

function verificationMetaLabel(verification) {
  if (!verification) return "";
  if (verification.overall === "completed") return "完了済み";
  if (verification.overall === "passed") return "確認OK";
  if (verification.overall === "failed") return "問題あり";
  if (verification.overall === "blocked") return "確認できない";
  if (verification.overall === "in-progress") return "確認途中";
  if (verification.overall === "stale") return "再確認が必要";
  return "";
}

async function saveVerificationChoice(project, task, stepIndex, status) {
  const current = verificationForTask(project, task.id);
  const steps = (task.steps?.length ? task.steps : [task.text]).map((_text, index) => ({
    status:
      index === stepIndex
        ? status
        : (current?.stale ? "pending" : current?.steps?.[index]?.status || "pending")
  }));

  el.taskVerificationSavedState.textContent = "保存中…";

  const result = await api.saveTaskVerification({
    projectId: project.id,
    taskId: task.id,
    steps,
    note: el.taskVerificationNote.value
  });

  if (!result?.ok) {
    el.taskVerificationSavedState.textContent = "保存失敗";
    addLog(result?.message || "確認結果を保存できませんでした。", "error");
    return;
  }

  project.development.verifications ||= {};
  project.development.verifications[task.id] = result.verification;
  renderActiveTaskGuide(project);
  renderVerificationOverview(project);
}

async function saveVerificationNote(project, task) {
  const current = verificationForTask(project, task.id);
  const steps = (task.steps?.length ? task.steps : [task.text]).map((_text, index) => ({
    status: current?.stale ? "pending" : current?.steps?.[index]?.status || "pending"
  }));

  el.taskVerificationSavedState.textContent = "保存中…";

  const result = await api.saveTaskVerification({
    projectId: project.id,
    taskId: task.id,
    steps,
    note: el.taskVerificationNote.value
  });

  if (!result?.ok) {
    el.taskVerificationSavedState.textContent = "保存失敗";
    addLog(result?.message || "確認メモを保存できませんでした。", "error");
    return;
  }

  project.development.verifications ||= {};
  project.development.verifications[task.id] = result.verification;
  renderActiveTaskGuide(project);
  renderVerificationOverview(project);
}

function renderTaskVerification(project, task) {
  const visible = task?.owner === "user";
  el.taskVerification.classList.toggle("hidden", !visible);
  el.taskRunGame.classList.toggle("hidden", !visible);

  if (!visible) {
    el.taskVerificationSteps.replaceChildren();
    el.taskVerificationNote.value = "";
    el.taskVerificationSummary.textContent = "未確認";
    el.taskVerificationSummary.dataset.tone = "";
    return;
  }

  const verification = verificationForTask(project, task.id);
  const summary = verificationSummary(verification?.overall || "untested");
  el.taskVerificationSummary.textContent = summary.label;
  el.taskVerificationSummary.dataset.tone = summary.tone;
  el.taskVerificationSavedState.textContent = verification?.updatedAt
    ? "保存済み " + new Date(verification.updatedAt).toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit"
      })
    : "まだ結果は保存されていません";

  el.taskVerificationSteps.replaceChildren();
  const steps = task.steps?.length ? task.steps : [task.text];

  for (let index = 0; index < steps.length; index += 1) {
    const row = document.createElement("div");
    row.className = "verification-step";

    const copy = document.createElement("div");
    copy.className = "verification-step-copy";

    const number = document.createElement("span");
    number.textContent = String(index + 1);

    const text = document.createElement("strong");
    text.textContent = steps[index];

    copy.append(number, text);

    const choices = document.createElement("div");
    choices.className = "verification-choices";

    const currentStatus = verification?.stale
      ? "pending"
      : verification?.steps?.[index]?.status || "pending";

    for (const option of [
      ["passed", "できた"],
      ["failed", "できなかった"],
      ["blocked", "今は確認できない"]
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "verification-choice";
      button.dataset.status = option[0];
      button.textContent = option[1];
      button.setAttribute("aria-pressed", currentStatus === option[0] ? "true" : "false");
      button.addEventListener("click", () => {
        saveVerificationChoice(project, task, index, option[0]).catch((error) => {
          addLog(String(error?.message || error), "error");
        });
      });
      choices.append(button);
    }

    row.append(copy, choices);
    el.taskVerificationSteps.append(row);
  }

  el.taskVerificationNote.value = verification?.stale ? "" : verification?.note || "";
  el.taskVerificationClear.disabled = !verification;

  if (verification?.stale) {
    el.taskVerificationSavedState.textContent =
      "Roadmapの手順が変わったため、以前の結果は使わず再確認してください。";
  }
}

function renderActiveTaskGuide(project) {
  const activeTask = activeDevelopmentTask(project);

  if (!activeTask) {
    el.activeTaskGuide.classList.add("hidden");
    el.activeTaskTitle.textContent = "タスク未選択";
    el.activeTaskOwner.classList.add("hidden");
    el.activeTaskOwner.textContent = "";
    el.activeTaskSteps.replaceChildren();
    el.activeTaskCompletion.textContent = "";
    el.taskVerification.classList.add("hidden");
    el.taskRunGame.classList.add("hidden");
    return;
  }

  el.activeTaskGuide.classList.remove("hidden");
  el.activeTaskTitle.textContent = activeTask.section + " / " + activeTask.text;

  const ownerLabel =
    activeTask.owner === "chatgpt" ? "担当: ChatGPT" :
    activeTask.owner === "user" ? "担当: あなた" :
    activeTask.owner === "hub" ? "担当: Game Dev Hub" :
    "";
  el.activeTaskOwner.textContent = ownerLabel;
  el.activeTaskOwner.classList.toggle("hidden", !ownerLabel);

  el.activeTaskSteps.replaceChildren();

  const repo = project?.repository || {};
  const steps = activeTask.steps?.length
    ? activeTask.steps
    : repo.dirty
      ? [
          "このPCのRoadmapには詳しい手順がまだ入っていません。PC側に変更があるため、HubがGitHubの最新版を取り込めていない可能性があります。",
          "上の「GitHubへの保存待ち」を確認してください。分からなければ「ChatGPTに確認データを作る」を使ってください。",
          "今すぐゲーム作業を続けるだけなら「このままGodotで続ける」で開発できます。"
        ]
      : [
          "このタスクの詳しい手順がRoadmapにまだ書かれていません。",
          "「ChatGPT共有パックを作る」を押して、具体的な作業手順を確認してください。",
          "作業後は「状態を更新」でRoadmapの状態を確認してください。"
        ];

  for (const step of steps) {
    const item = document.createElement("li");
    item.textContent = step;
    el.activeTaskSteps.append(item);
  }

  el.activeTaskCompletion.textContent =
    activeTask.completionCriteria ||
    "このタスクの実装・確認が終わり、Game Repository側のRoadmapで完了として記録されたら完了です。";

  renderTaskVerification(project, activeTask);

  const verification = verificationForTask(project, activeTask.id);
  if (activeTask.owner === "user") {
    el.taskGuideNote.textContent =
      "確認結果はHubに自動保存されます。複数タスクを確認したあと、右の「ChatGPT連携」から全部まとめて1回で送れます。";
    el.taskExport.classList.add("hidden");
  } else if (activeTask.owner === "chatgpt") {
    el.taskExport.classList.remove("hidden");
    el.taskGuideNote.textContent =
      "このタスクはChatGPT担当です。共有パックを送れば、Repositoryで実行できる作業はChatGPT側で進めます。";
    el.taskExport.textContent = "ChatGPTにこのタスクを渡す";
  } else {
    el.taskExport.classList.remove("hidden");
    el.taskGuideNote.textContent =
      "ここで選んだだけでは作業開始・完了にはなりません。実際の作業後、Game RepositoryのRoadmapが更新されるとHubにも反映されます。";
    el.taskExport.textContent = "ChatGPT共有パックを作る";
  }
}

function renderDevelopmentTasks(project) {
  const tasks = project?.development?.tasks;
  const activeTaskId = project?.development?.activeTaskId || "";

  el.developmentTaskList.replaceChildren();

  if (!tasks?.available) {
    el.taskProgressBadge.textContent = "Roadmapなし";
    el.taskToggleCompleted.classList.add("hidden");
    el.taskCurrentPhase.textContent = "やることFileが見つかりません";
    el.taskSource.textContent = "Repository内のRoadmap/TODOを読みます。";
    el.taskEmpty.classList.remove("hidden");
    renderActiveTaskGuide(project);
    return;
  }

  el.taskEmpty.classList.add("hidden");
  const currentSection = tasks.sections.find((section) => section.title === tasks.currentSection);
  const currentTotal = currentSection?.tasks?.length || 0;
  const currentDone = currentSection?.tasks?.filter((task) => task.done).length || 0;

  el.taskProgressBadge.textContent = currentTotal
    ? currentDone + " / " + currentTotal + " 完了"
    : tasks.done + " / " + tasks.total + " 完了";
  el.taskCurrentPhase.textContent = tasks.currentSection || "Roadmap";
  el.taskSource.textContent =
    tasks.sourceFile + " • Roadmap全体 " + tasks.done + " / " + tasks.total + " 完了";

  el.taskToggleCompleted.classList.toggle("hidden", tasks.done === 0);
  el.taskToggleCompleted.textContent = showCompletedTasks
    ? "完了済みを隠す"
    : "完了済みを表示 (" + tasks.done + ")";

  const currentSectionIndex = tasks.sections.findIndex(
    (section) => section.title === tasks.currentSection
  );
  const futureOpenCount = currentSectionIndex >= 0
    ? tasks.sections
        .slice(currentSectionIndex + 1)
        .flatMap((section) => section.tasks)
        .filter((task) => !task.done)
        .length
    : 0;

  el.taskToggleFuture.classList.toggle("hidden", futureOpenCount === 0);
  el.taskToggleFuture.textContent = showFutureTasks
    ? "今後のタスクを隠す"
    : "今後のタスクを表示 (" + futureOpenCount + ")";

  for (let sectionIndex = 0; sectionIndex < tasks.sections.length; sectionIndex += 1) {
    const section = tasks.sections[sectionIndex];
    const containsActiveTask = section.tasks.some((task) => task.id === activeTaskId);
    const isCurrentSection = section.title === tasks.currentSection;
    const isFutureSection = currentSectionIndex >= 0 && sectionIndex > currentSectionIndex;
    const isPastSection = currentSectionIndex >= 0 && sectionIndex < currentSectionIndex;

    if (isFutureSection && !showFutureTasks && !containsActiveTask) continue;
    if (isPastSection && !showCompletedTasks && !containsActiveTask) continue;

    const visibleTasks = section.tasks.filter((task) => showCompletedTasks || !task.done);
    if (!visibleTasks.length && !containsActiveTask) continue;

    const group = document.createElement("section");
    group.className = "task-group";

    const heading = document.createElement("h4");
    heading.textContent = section.title;
    group.append(heading);

    for (const task of visibleTasks) {
      const item = document.createElement("button");
      item.type = "button";
      item.className =
        "task-item" +
        (task.done ? " done" : "") +
        (task.id === activeTaskId ? " active" : "") +
        (!activeTaskId && !task.done && tasks.nextTask?.id === task.id ? " next" : "");
      item.disabled = task.done;

      const mark = document.createElement("span");
      mark.className = "task-mark";
      mark.textContent = task.done ? "✓" : task.id === activeTaskId ? "▶" : "○";

      const copy = document.createElement("span");
      copy.className = "task-copy";

      const text = document.createElement("strong");
      text.textContent = task.text;

      const meta = document.createElement("small");
      const ownerText =
        task.owner === "chatgpt" ? "ChatGPT担当" :
        task.owner === "user" ? "あなた担当" :
        task.owner === "hub" ? "Hub担当" :
        "";
      const verificationText = task.owner === "user"
        ? verificationMetaLabel(verificationForTask(project, task.id))
        : "";
      const baseMeta = task.done
        ? "完了"
        : task.id === activeTaskId
          ? "今やるタスク / 上に手順を表示"
          : (!activeTaskId && tasks.nextTask?.id === task.id
              ? "次の候補 / クリックで手順を見る"
              : "クリックで手順を見る");
      meta.textContent = [ownerText, verificationText, baseMeta].filter(Boolean).join(" / ");

      copy.append(text, meta);
      item.append(mark, copy);

      if (!task.done) {
        item.addEventListener("click", async () => {
          const result = await api.setActiveTask({ projectId: project.id, taskId: task.id });
          if (!result?.ok) {
            addLog(result?.message || "今やるタスクを保存できませんでした。", "error");
            return;
          }

          project.development.activeTaskId = task.id;
          renderDevelopmentTasks(project);
          addLog("今やるタスクを選びました: " + task.text, "success");
        });
      }

      group.append(item);
    }

    el.developmentTaskList.append(group);
  }

  renderActiveTaskGuide(project);
}

function changedFileStatusLabel(status) {
  const value = String(status || "");
  if (value.includes("?")) return "新しく作成";
  if (value.includes("D")) return "削除";
  if (value.includes("R")) return "名前変更";
  if (value.includes("A")) return "新しく追加";
  if (value.includes("M")) return "内容が変更";
  if (value.includes("U")) return "競合あり";
  return "変更あり";
}

function changedFileExplanation(filePath) {
  const value = String(filePath || "");

  if (value === "project.godot") {
    return "Godotのプロジェクト設定です。Godotの設定変更などで書き換わるため、中身を確認せず消さないでください。";
  }

  if (/\.gd\.uid$/i.test(value) || /\.uid$/i.test(value)) {
    return "Godotがファイルを識別するために作るID用ファイルです。Godotが自動で作ることがあります。";
  }

  return "このPC上でGitHub版と違う状態になっているファイルです。";
}

function renderSafetyRecovery(project) {
  const repo = project?.repository || {};
  const visible = Boolean(repo.valid && (repo.dirty || (repo.ahead || 0) > 0));
  el.safetyRecovery.classList.toggle("hidden", !visible);
  el.safetyChangedFiles.replaceChildren();

  if (!visible) return;

  if (!repo.dirty && (repo.ahead || 0) > 0) {
    el.safetyRecoveryTitle.textContent =
      "PCには保存済みですが、GitHubへまだ送れていない履歴が" + repo.ahead + "件あります";
    el.safetyRecoverySummary.textContent =
      "変更はPCに保存されています。下の「GitHubへ送る」で送信だけ再試行できます。";
    el.safetyChangeCount.textContent = repo.ahead + "件";
    el.safetySave.textContent = "GitHubへ送る";

    const item = document.createElement("div");
    item.className = "changed-file-card";
    const title = document.createElement("strong");
    title.textContent = "PC側への保存は完了";
    const copy = document.createElement("p");
    copy.textContent = "GitHubへの送信だけが残っています。変更は消えていません。";
    item.append(title, copy);
    el.safetyChangedFiles.append(item);
    return;
  }

  el.safetyRecoveryTitle.textContent =
    "GitHubにまだ反映されていない変更が" + repo.changedCount + "件あります";
  el.safetyRecoverySummary.textContent =
    "エラーではありません。PC側の変更を守るため「最新版にする」だけ一時停止しています。Godotでの作業はそのまま続けられます。";
  el.safetyChangeCount.textContent = repo.changedCount + "件";
  el.safetySave.textContent = repo.changedCount + "件をGitHubに保存";

  const files = Array.isArray(repo.changedFiles) ? repo.changedFiles : [];
  if (!files.length) {
    const item = document.createElement("div");
    item.className = "changed-file-card";
    item.textContent = "変更されたファイル名を取得できませんでした。";
    el.safetyChangedFiles.append(item);
    return;
  }

  for (const file of files) {
    const item = document.createElement("div");
    item.className = "changed-file-card";

    const header = document.createElement("div");
    header.className = "changed-file-header";

    const status = document.createElement("span");
    status.className = "changed-file-status";
    status.textContent = changedFileStatusLabel(file.status);

    const name = document.createElement("strong");
    name.textContent = file.path || "不明";

    const description = document.createElement("p");
    description.textContent = changedFileExplanation(file.path);

    header.append(status, name);
    item.append(header, description);
    el.safetyChangedFiles.append(item);
  }

  if (repo.changedCount > files.length) {
    const item = document.createElement("div");
    item.className = "changed-file-more";
    item.textContent = "ほか " + (repo.changedCount - files.length) + "件の変更があります。";
    el.safetyChangedFiles.append(item);
  }
}

function defaultRepositorySaveMessage(project) {
  const files = project?.repository?.changedFiles || [];
  const allGodotMeta = files.length > 0 && files.every((file) =>
    file.path === "project.godot" || /\.uid$/i.test(file.path || "")
  );

  return allGodotMeta
    ? "Godotの設定と自動生成ファイルを保存"
    : "ゲーム開発の変更を保存";
}

function openSaveChangesDialog(project) {
  const repo = project?.repository || {};
  const files = Array.isArray(repo.changedFiles) ? repo.changedFiles : [];

  el.saveChangesSummary.textContent =
    "今ある" + repo.changedCount + "件の変更を消さずにGitHubへ保存します。";
  el.saveChangesMessageInput.value = defaultRepositorySaveMessage(project);
  el.saveChangesList.replaceChildren();

  for (const file of files) {
    const row = document.createElement("div");
    row.className = "save-change-row";

    const top = document.createElement("div");
    top.className = "save-change-row-top";

    const status = document.createElement("span");
    status.className = "changed-file-status";
    status.textContent = changedFileStatusLabel(file.status);

    const name = document.createElement("strong");
    name.textContent = file.path || "不明";

    const description = document.createElement("p");
    description.textContent = changedFileExplanation(file.path);

    top.append(status, name);
    row.append(top, description);
    el.saveChangesList.append(row);
  }

  if (repo.changedCount > files.length) {
    const more = document.createElement("p");
    more.className = "dialog-note";
    more.textContent =
      "ほか" + (repo.changedCount - files.length) + "件も同じ保存に含まれます。";
    el.saveChangesList.append(more);
  }

  if ((repo.ahead || 0) > 0 || (repo.behind || 0) > 0) {
    el.saveChangesSyncNote.textContent =
      "GitHubとの間に未送信・未取得の履歴があります。Hubが先に最新状態を確認し、安全に組み合わせられる場合だけGitHubへ送ります。";
  } else {
    el.saveChangesSyncNote.textContent =
      "GitHub側に新しい変更が見つかった場合も、Hubが安全に組み合わせられる場合だけ保存を続けます。";
  }

  el.saveChangesDialog.showModal();
}

function renderReferenceImages() {
  el.referenceImageList.replaceChildren();
  el.referenceImageCount.textContent = referenceImages.length + "枚";
  el.referenceImageEmpty.classList.toggle("hidden", referenceImages.length > 0);

  for (const image of referenceImages) {
    const card = document.createElement("article");
    card.className = "reference-image-card";

    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "reference-preview";
    preview.title = image.displayName;

    if (image.thumbnail) {
      const img = document.createElement("img");
      img.src = image.thumbnail;
      img.alt = image.displayName;
      preview.append(img);
    } else {
      const fallback = document.createElement("span");
      fallback.textContent = "画像";
      preview.append(fallback);
    }

    preview.addEventListener("click", () => {
      const project = selectedProject();
      if (!project) return;
      api.openReferenceImage({ projectId: project.id, imageId: image.id }).catch(() => {});
    });

    const footer = document.createElement("div");
    footer.className = "reference-card-footer";

    const name = document.createElement("span");
    name.textContent = image.displayName;
    name.title = image.displayName;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reference-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", image.displayName + " をHubから外す");
    remove.addEventListener("click", async () => {
      const project = selectedProject();
      if (!project) return;
      const result = await api.removeReferenceImage({ projectId: project.id, imageId: image.id });
      if (result?.ok) {
        referenceImages = result.images || [];
        renderReferenceImages();
        addLog(result.message, "success");
      } else {
        addLog(result?.message || "参考画像を外せませんでした。", "error");
      }
    });

    footer.append(name, remove);
    card.append(preview, footer);
    el.referenceImageList.append(card);
  }
}

async function refreshReferenceImages() {
  const project = selectedProject();
  if (!project) {
    referenceImages = [];
    referenceImagesProjectId = "";
    renderReferenceImages();
    return;
  }

  const projectId = project.id;
  const result = await api.listReferenceImages(projectId);
  if (selectedId !== projectId) return;

  if (result?.ok) {
    referenceImagesProjectId = projectId;
    referenceImages = result.images || [];
    renderReferenceImages();
  }
}

function setProjectTab(nextTab) {
  projectTab = nextTab === "auto-test" ? "auto-test" : "development";
  const autoSelected = projectTab === "auto-test";
  el.developmentTab.classList.toggle("active", !autoSelected);
  el.autoTestTab.classList.toggle("active", autoSelected);
  el.developmentTab.setAttribute("aria-selected", String(!autoSelected));
  el.autoTestTab.setAttribute("aria-selected", String(autoSelected));
  el.developmentTabPanel.classList.toggle("hidden", autoSelected);
  el.autoTestTabPanel.classList.toggle("hidden", !autoSelected);
  if (autoSelected) refreshAutoTestState().catch(() => {});
}

function formatAutoTestElapsed(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return minutes + ":" + seconds;
}

function autoTestStatusClass(status) {
  return String(status || "UNKNOWN").toLowerCase();
}

function autoTestConfigFromForm() {
  let tests;
  try {
    tests = JSON.parse(el.autoTestDefinitions.value || "[]");
  } catch {
    throw new Error("テスト定義JSONが正しくありません。カンマや括弧を確認してください。");
  }
  if (!Array.isArray(tests)) {
    throw new Error("テスト定義はJSON配列 [ ... ] にしてください。");
  }

  return {
    engine: el.autoTestEngine.value,
    exePath: el.autoTestExePath.value,
    targetVersion: el.autoTestTargetVersion.value,
    windowTitle: el.autoTestWindowTitle.value,
    launchArgs: el.autoTestLaunchArgs.value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean),
    timeout: Number(el.autoTestTimeout.value) || 60,
    maxAgentSteps: Number(el.autoTestMaxSteps.value) || 25,
    model: {
      baseURL: el.autoTestModelBaseUrl.value,
      name: el.autoTestModelName.value,
      serviceLabel: "OpenAI互換エンドポイント",
      localPreferred: /^https?:\/\/(127\.0\.0\.1|localhost)(?::|\/|$)/i.test(el.autoTestModelBaseUrl.value)
    },
    tests
  };
}

function setAutoTestControlsRunning(running) {
  autoTestRunning = running;
  for (const node of [
    el.autoTestChooseExe,
    el.autoTestSave,
    el.autoTestDiagnose,
    el.autoTestStart,
    el.autoTestRetest,
    el.autoTestOpenFolder
  ]) {
    node.disabled = running || busy;
  }
  el.autoTestStop.disabled = false;
  el.autoTestStart.textContent = running ? "AIテスト実行中" : "AIテスト開始";
}

function renderAutoTestDiagnostics(diagnostics) {
  el.autoTestDiagnostics.replaceChildren();
  if (!diagnostics) {
    const empty = document.createElement("p");
    empty.className = "dev-empty";
    empty.textContent = "「診断」を押すとUI-TARS・操作機能・exe・Model接続を確認します。";
    el.autoTestDiagnostics.append(empty);
    return;
  }

  const labels = {
    platform: "Windows",
    uiTars: "UI-TARS",
    python: "Python",
    gpu: "GPU",
    screenshot: "スクリーンショット",
    keyboard: "キーボード操作",
    mouse: "マウス操作",
    windowDetection: "ウィンドウ制限",
    exe: "テスト対象exe",
    modelEndpoint: "Model接続"
  };
  for (const [key, label] of Object.entries(labels)) {
    const item = diagnostics[key] || { status: "NG", message: "未確認" };
    const row = document.createElement("div");
    row.className = "auto-test-diagnostic-row " + String(item.status || "NG").toLowerCase();
    const title = document.createElement("strong");
    title.textContent = label + " / " + (item.status || "NG");
    const message = document.createElement("span");
    message.textContent = item.message || "詳細なし";
    row.append(title, message);
    el.autoTestDiagnostics.append(row);
  }
}

function renderAutoTestLatest(report) {
  el.autoTestSummaryCounts.replaceChildren();
  el.autoTestResultList.replaceChildren();

  if (!report) {
    el.autoTestSummaryTitle.textContent = "まだテスト結果はありません";
    return;
  }

  const summary = report.summary || {};
  el.autoTestSummaryTitle.textContent =
    new Date(report.testedAt || report.startedAt).toLocaleString("ja-JP") + " の結果";
  el.autoTestDate.textContent = new Date(report.testedAt || report.startedAt).toLocaleString("ja-JP");

  for (const [label, value, tone] of [
    ["PASS", summary.passed || 0, "pass"],
    ["FAIL", summary.failed || 0, "fail"],
    ["WARNING", summary.warning || 0, "warning"],
    ["UNKNOWN", summary.unknown || 0, "unknown"]
  ]) {
    const badge = document.createElement("span");
    badge.className = "auto-test-count " + tone;
    badge.textContent = label + " " + value;
    el.autoTestSummaryCounts.append(badge);
  }

  for (const test of report.tests || []) {
    const row = document.createElement("article");
    row.className = "auto-test-result " + autoTestStatusClass(test.status);

    const heading = document.createElement("div");
    heading.className = "auto-test-result-heading";
    const name = document.createElement("strong");
    name.textContent = test.name || test.id || "テスト";
    const status = document.createElement("span");
    status.className = "auto-test-result-status";
    status.textContent = test.status || "UNKNOWN";
    heading.append(name, status);

    const expected = document.createElement("p");
    expected.textContent = "期待: " + (test.expected || "未設定");
    const actual = document.createElement("p");
    actual.textContent = "実際: " + (test.actual || (test.error ? test.error : "AIが明示的な説明を残していません。"));
    const confidence = document.createElement("small");
    confidence.textContent = "信頼度: " + (test.confidence || "unknown") +
      " / 操作 " + String(test.actionLog?.length || 0) + "回";

    row.append(heading, expected, actual, confidence);

    if (test.error) {
      const error = document.createElement("p");
      error.className = "auto-test-result-error";
      error.textContent = "エラー: " + test.error;
      row.append(error);
    }

    if (test.reproduction) {
      const details = document.createElement("details");
      const summaryNode = document.createElement("summary");
      summaryNode.textContent = "再現手順";
      const pre = document.createElement("pre");
      pre.textContent = test.reproduction;
      details.append(summaryNode, pre);
      row.append(details);
    }

    el.autoTestResultList.append(row);
  }
}

function renderAutoTestHistory(history) {
  el.autoTestHistory.replaceChildren();
  if (!history?.length) {
    const empty = document.createElement("p");
    empty.className = "dev-empty";
    empty.textContent = "まだ履歴はありません。";
    el.autoTestHistory.append(empty);
    return;
  }

  for (const run of history.slice(0, 20)) {
    const row = document.createElement("div");
    row.className = "auto-test-history-row";
    const date = document.createElement("strong");
    date.textContent = new Date(run.testedAt).toLocaleString("ja-JP");
    const counts = document.createElement("span");
    counts.textContent =
      (run.passed || 0) + " PASS / " +
      (run.failed || 0) + " FAIL / " +
      (run.warning || 0) + " WARNING / " +
      (run.unknown || 0) + " UNKNOWN";
    row.append(date, counts);
    el.autoTestHistory.append(row);
  }
}

function renderAutoTestState() {
  const project = selectedProject();
  if (!project) return;

  el.autoTestProjectName.textContent = project.name;
  el.autoTestGitCommit.textContent = project.repository?.commit || "未確認";

  if (!autoTestState || autoTestState.project?.id !== project.id) {
    return;
  }

  const config = autoTestState.config || {};
  el.autoTestExePath.value = config.exePath || "";
  el.autoTestTargetVersion.value = config.targetVersion || "";
  el.autoTestWindowTitle.value = config.windowTitle || "";
  el.autoTestLaunchArgs.value = (config.launchArgs || []).join("\n");
  el.autoTestEngine.value = config.engine || "ui-tars";
  el.autoTestModelBaseUrl.value = config.model?.baseURL || "";
  el.autoTestModelName.value = config.model?.name || "";
  el.autoTestTimeout.value = String(config.timeout || 60);
  el.autoTestMaxSteps.value = String(config.maxAgentSteps || 25);
  el.autoTestDefinitions.value = JSON.stringify(config.tests || [], null, 2);
  el.autoTestApiKey.value = "";
  el.autoTestDate.textContent = autoTestState.latest?.testedAt
    ? new Date(autoTestState.latest.testedAt).toLocaleString("ja-JP")
    : "未実行";
  renderAutoTestLatest(autoTestState.latest);
  renderAutoTestHistory(autoTestState.history || []);
  setAutoTestControlsRunning(Boolean(autoTestState.active?.running));
}

async function refreshAutoTestState() {
  const project = selectedProject();
  if (!project) return null;
  const projectId = project.id;
  const result = await api.getAutoTestState(projectId);
  if (selectedId !== projectId) return result;
  if (result?.ok) {
    autoTestState = result;
    renderAutoTestState();
  }
  return result;
}

async function saveAutoTestSettings(showLog = true) {
  const project = requireSelected();
  if (!project) return null;
  let config;
  try {
    config = autoTestConfigFromForm();
  } catch (error) {
    addLog(error.message, "error");
    return null;
  }
  const result = await api.saveAutoTestConfig({ projectId: project.id, config });
  if (result?.ok) {
    if (autoTestState) autoTestState.config = result.config;
    if (showLog) addLog(result.message, "success");
    return result.config;
  }
  addLog(result?.message || "自動テスト設定を保存できませんでした。", "error");
  return null;
}

async function runProjectAutoTest(failedOnly = false) {
  const project = requireSelected();
  if (!project || autoTestRunning) return;

  let config;
  try {
    config = autoTestConfigFromForm();
  } catch (error) {
    addLog(error.message, "error");
    return;
  }

  if (!config.exePath) {
    addLog("先にテスト対象の.exeを選んでください。", "error");
    return;
  }
  if (config.engine !== "ui-tars") {
    addLog(config.engine === "agent-s"
      ? "Agent-Sは現在フォールバック候補として表示していますが、初期実装では未接続です。UI-TARSを選んでください。"
      : "AI操作エンジンが無効です。", "error");
    return;
  }

  setAutoTestControlsRunning(true);
  el.autoTestProgressCount.textContent = "開始準備";
  el.autoTestProgressTest.textContent = failedOnly ? "前回FAILした項目を再テスト" : "AI自動テスト";
  el.autoTestProgressMessage.textContent = "ゲームを起動する準備をしています。";
  el.autoTestProgressAction.textContent = "なし";
  addLog(failedOnly ? "失敗項目のAI再テストを開始しました。" : "AI自動テストを開始しました。");

  try {
    const payload = {
      projectId: project.id,
      config,
      apiKey: el.autoTestApiKey.value
    };
    const result = failedOnly
      ? await api.retestFailedAutoTests(payload)
      : await api.startAutoTest(payload);

    if (result?.ok) {
      autoTestState = result.autoTestState || autoTestState;
      renderAutoTestState();
      addLog(result.message, "success");
    } else {
      addLog(result?.message || "AI自動テストに失敗しました。", "error");
    }
  } catch (error) {
    addLog("AI自動テスト: " + String(error?.message || error), "error");
  } finally {
    setAutoTestControlsRunning(false);
    await refreshAutoTestState().catch(() => {});
  }
}

function renderDetail() {
  const project = selectedProject();

  if (!project) {
    el.emptyState.classList.remove("hidden");
    el.projectDetail.classList.add("hidden");
    return;
  }

  el.emptyState.classList.add("hidden");
  el.projectDetail.classList.remove("hidden");

  const repo = project.repository || {};
  el.start.textContent = "開発を開始";

  renderDevelopmentTasks(project);
  renderVerificationOverview(project);
  if (referenceImagesProjectId !== project.id) {
    referenceImages = [];
    renderReferenceImages();
    refreshReferenceImages().catch(() => {});
  }

  el.detailSlug.textContent = project.repositorySlug;
  el.detailName.textContent = project.name;
  el.detailPath.textContent = project.localPath;
  el.autoTestProjectName.textContent = project.name;
  el.autoTestGitCommit.textContent = repo.commit || "未確認";
  renderAutoTestState();

  if (!repo.exists) {
    setDot(el.repoDot, "warning");
    el.repoValue.textContent = "PCにまだありません";
    el.repoDescription.textContent = "「開発を開始」でGitHubから自動取得します。";
  } else if (!repo.valid) {
    setDot(el.repoDot, "error");
    el.repoValue.textContent = "要確認";
    el.repoDescription.textContent = "ローカルフォルダと登録Repositoryが一致しません。";
  } else {
    setDot(el.repoDot, "ok");
    el.repoValue.textContent = "接続済み";
    el.repoDescription.textContent =
      project.repositorySlug + " / " + (repo.commit || "commit確認済み");
  }

  if (!repo.exists) {
    setDot(el.branchDot, "warning");
    el.branchValue.textContent = "未取得";
    el.branchDescription.textContent = project.defaultBranch + " をCloneします。";
  } else if (repo.dirty) {
    setDot(el.branchDot, "warning");
    el.branchValue.textContent = "PC側に未保存の変更あり";
    el.branchDescription.textContent =
      repo.changedCount + "件の変更があります。「GitHubに保存」でまとめて保存できます。";
  } else if ((repo.ahead || 0) > 0) {
    setDot(el.branchDot, "warning");
    el.branchValue.textContent = "GitHubへの送信待ち";
    el.branchDescription.textContent =
      repo.ahead + "件の履歴がPCに保存済みです。「GitHubへ送る」で再試行できます。";
  } else if (repo.branch !== project.defaultBranch) {
    setDot(el.branchDot, "warning");
    el.branchValue.textContent = repo.branch || "Branch不明";
    el.branchDescription.textContent =
      "自動更新対象は " + project.defaultBranch + " です。";
  } else {
    setDot(el.branchDot, "ok");
    el.branchValue.textContent = repo.branch + " / 変更なし";
    const delta = repo.behind > 0
      ? "GitHubより " + repo.behind + " commit古い可能性があります。"
      : "ローカル変更はありません。";
    el.branchDescription.textContent = delta;
  }

  const foundation = project.foundation || {};
  if (!foundation.installed) {
    setDot(el.foundationDot, "warning");
    el.foundationValue.textContent = "未導入";
    el.foundationDescription.textContent =
      "既存Gameです。Phase 8のPilotまでは自動導入しません。";
    el.foundationUpdate.classList.add("hidden");
  } else if (!foundation.valid) {
    setDot(el.foundationDot, "error");
    el.foundationValue.textContent = "導入情報を確認";
    el.foundationDescription.textContent =
      ".game-foundation.json が現在のFoundation Contractと一致しません。";
    el.foundationUpdate.classList.add("hidden");
  } else {
    setDot(el.foundationDot, "ok");
    el.foundationValue.textContent = "v" + foundation.version;
    el.foundationDescription.textContent =
      "導入Commit " + String(foundation.commit || "").slice(0, 8) +
      " / 更新対象: addons/game_foundation";
    el.foundationUpdate.classList.remove("hidden");
    el.foundationUpdate.disabled =
      busy ||
      !repo.valid ||
      repo.dirty ||
      (repo.ahead || 0) > 0 ||
      repo.branch !== project.defaultBranch ||
      !state?.network?.online;
  }

  renderSafetyRecovery(project);

  const ready =
    state.git?.available &&
    state.godot?.available &&
    repo.valid &&
    !repo.dirty &&
    (repo.ahead || 0) === 0 &&
    repo.branch === project.defaultBranch;

  if (!state.git?.available) {
    el.heroStatus.textContent = "セットアップ";
    el.heroTitle.textContent = "Gitが必要です";
    el.heroDescription.textContent =
      "Git for Windowsを準備したあと状態を更新してください。";
  } else if (!state.godot?.available) {
    el.heroStatus.textContent = "初回設定";
    el.heroTitle.textContent = "Godotを一度だけ設定してください";
    el.heroDescription.textContent =
      "上の「Godotを設定」からGodot.exeを選べます。";
  } else if (repo.dirty) {
    el.heroStatus.textContent = "GitHubへの保存待ち";
    el.heroTitle.textContent = "PC側に変更があります";
    el.heroDescription.textContent =
      "下の「GitHubに保存」で変更を残したままGitHubへ保存できます。Godotでの作業を続けることもできます。";
    el.start.textContent = "保存せずGodotで続ける";
  } else if ((repo.ahead || 0) > 0) {
    el.heroStatus.textContent = "GitHubへの送信待ち";
    el.heroTitle.textContent = "PC側への保存は完了しています";
    el.heroDescription.textContent =
      "GitHubへの送信だけが残っています。下の「GitHubへ送る」で再試行できます。";
    el.start.textContent = "Godotで続ける";
  } else if (!state.network?.online && repo.valid) {
    el.heroStatus.textContent = "オフライン";
    el.heroTitle.textContent = "ローカル開発は続けられます";
    el.heroDescription.textContent =
      "GitHub同期は利用できません。Godotで開く・ゲーム起動・フォルダ表示は利用できます。";
    el.start.textContent = "Godotで開く";
  } else if (!state.network?.online && !repo.exists) {
    el.heroStatus.textContent = "オフライン";
    el.heroTitle.textContent = "最初の取得にはネット接続が必要です";
    el.heroDescription.textContent =
      "接続が戻ったら「開発を開始」でRepositoryを取得できます。";
  } else if (repo.valid && repo.branch !== project.defaultBranch) {
    el.heroStatus.textContent = "同期停止";
    el.heroTitle.textContent = "別ブランチなのでGitHub同期は停止中です";
    el.heroDescription.textContent =
      "ローカルのGodot作業は続けられます。同期する場合は " + project.defaultBranch + " に戻してから状態を更新してください。";
    el.start.textContent = "同期せずGodotで開く";
  } else if (ready) {
    el.heroStatus.textContent = "準備OK";
    el.heroTitle.textContent = "このまま開発を始められます";
    el.heroDescription.textContent =
      "GitHubを確認して最新化したあと、Godot Editorを開きます。";
  } else if (!repo.exists) {
    el.heroStatus.textContent = "初回準備";
    el.heroTitle.textContent = "最初の取得は自動で行います";
    el.heroDescription.textContent =
      "「開発を開始」でRepositoryをCloneしてGodotを開きます。";
  } else {
    el.heroStatus.textContent = "確認が必要";
    el.heroTitle.textContent = "Repository状態を確認してください";
    el.heroDescription.textContent =
      "登録情報・Branch・Local folderのどこかに確認が必要です。";
  }
}

function render() {
  if (!state) return;

  const preferred = state.settings?.lastSelectedProjectId;
  if (!selectedId && preferred && state.projects.some((project) => project.id === preferred)) {
    selectedId = preferred;
  }

  if (!selectedId || !state.projects.some((project) => project.id === selectedId)) {
    selectedId = state.projects[0]?.id || null;
  }

  if (state.settings && state.settings.lastSelectedProjectId !== (selectedId || "")) {
    state.settings.lastSelectedProjectId = selectedId || "";
    api.setSelectedProject(selectedId || null).catch(() => {});
  }

  renderGlobal();
  renderProjectList();
  renderDetail();
}

async function refreshState(log = false) {
  const result = await api.getState();
  if (result?.ok) {
    state = result;
    render();
    refreshReferenceImages().catch(() => {});
    refreshAutoTestState().catch(() => {});
    if (log) addLog("状態を更新しました。", "success");
  } else {
    addLog(result?.message || "状態確認に失敗しました。", "error");
  }
  return result;
}

async function runAction(label, action, options = {}) {
  if (busy) return null;
  let finalResult = null;
  setBusy(true, label);
  addLog(label + "を開始しました。");

  try {
    let result = await action();

    if (!result?.ok && result?.code === "GODOT_MISSING" && options.pickGodotOnMissing) {
      addLog("Godotが未設定です。Godot.exeを選択してください。");
      const selected = await api.chooseGodot();

      if (selected?.ok) {
        state = selected.state;
        render();
        addLog(selected.message, "success");
        result = await action();
      } else {
        result = selected;
      }
    }

    if (result?.ok) {
      if (result.state) state = result.state;
      if (result.projectId) {
        selectedId = result.projectId;
        if (state?.settings) state.settings.lastSelectedProjectId = result.projectId;
        api.setSelectedProject(result.projectId).catch(() => {});
      }
      render();
      refreshReferenceImages().catch(() => {});
      addLog(result.message || label + "が完了しました。", "success");
    } else if (result?.code !== "CANCELED") {
      addLog(result?.message || label + "に失敗しました。", "error");
      await refreshState(false);
    }
    finalResult = result;
  } catch (error) {
    addLog(String(error?.message || error), "error");
  } finally {
    setBusy(false);
  }
  return finalResult;
}

function closeDialog(dialog, returnValue = "cancel") {
  if (dialog?.open) dialog.close(returnValue);
}

function renderDiagnostics(diagnostics) {
  const app = diagnostics?.app || {};
  const update = diagnostics?.update || {};
  const storage = diagnostics?.storage || {};
  const last = diagnostics?.lastError;

  el.diagnosticsApp.textContent = (app.name || "Game Dev Hub") + " v" + (app.version || "?");
  el.diagnosticsElectron.textContent = app.electron || "不明";
  el.diagnosticsOs.textContent =
    (app.platform === "win32" ? "Windows" : app.platform || "不明") +
    " " + (app.platformRelease || "") + " / " + (app.arch || "");
  el.diagnosticsNetwork.textContent = diagnostics?.network?.online ? "オンライン" : "オフライン";
  el.diagnosticsUpdate.textContent =
    (update.channel === "stable" ? "Stable" : update.channel || "不明") +
    " / " + (update.status || "idle");
  el.diagnosticsProjects.textContent = String(diagnostics?.projectCount ?? 0) + "件";
  el.diagnosticsDataPath.textContent = storage.dataPath || "不明";
  el.diagnosticsLogsPath.textContent = storage.logsPath || "不明";
  el.diagnosticsLastError.textContent = last
    ? (last.code || "ERROR") + " / " + new Date(last.at).toLocaleString("ja-JP")
    : "なし";
}

async function openDiagnostics() {
  const result = await api.getDiagnostics();
  if (!result?.ok) {
    addLog(result?.message || "診断情報を取得できませんでした。", "error");
    return;
  }

  renderDiagnostics(result.diagnostics);
  el.diagnosticsDialog.showModal();
}

function requireSelected() {
  const project = selectedProject();
  if (!project) {
    addLog("先にゲームを選択してください。", "error");
    return null;
  }
  return project;
}

el.safetySave.addEventListener("click", () => {
  const project = requireSelected();
  if (!project || busy) return;
  openSaveChangesDialog(project);
});

el.safetyContinue.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;
  runAction(
    "Godot起動",
    () => api.openEditor(project.id),
    { pickGodotOnMissing: true }
  );
});

el.safetyExport.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;
  runAction(
    "ChatGPT確認データ作成",
    () => api.exportChatGptPack({
      projectId: project.id,
      taskId: project.development?.activeTaskId || ""
    })
  );
});

el.safetyOpenFolder.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;
  runAction("フォルダ表示", () => api.openFolder(project.id));
});

el.safetyRefresh.addEventListener("click", () => runAction("状態再確認", async () => {
  const result = await api.getState();
  return { ok: result.ok, message: "Repository状態を再確認しました。", state: result };
}));

el.saveChangesClose.addEventListener("click", () => closeDialog(el.saveChangesDialog));
el.saveChangesCancel.addEventListener("click", () => closeDialog(el.saveChangesDialog));

el.saveChangesForm.addEventListener("submit", (event) => {
  const submitter = event.submitter;
  if (!submitter || submitter.value !== "default") return;

  event.preventDefault();
  const project = requireSelected();
  if (!project) return;

  const message = el.saveChangesMessageInput.value;
  el.saveChangesDialog.close();

  runAction(
    "GitHubへ保存",
    () => api.saveRepositoryChanges({
      projectId: project.id,
      message
    })
  );
});

el.taskToggleCompleted.addEventListener("click", () => {
  showCompletedTasks = !showCompletedTasks;
  const project = selectedProject();
  if (project) renderDevelopmentTasks(project);
});

el.taskToggleFuture.addEventListener("click", () => {
  showFutureTasks = !showFutureTasks;
  const project = selectedProject();
  if (project) renderDevelopmentTasks(project);
});

el.taskClearSelection.addEventListener("click", async () => {
  const project = requireSelected();
  if (!project || busy) return;

  const result = await api.setActiveTask({ projectId: project.id, taskId: "" });
  if (result?.ok) {
    project.development.activeTaskId = "";
    renderDevelopmentTasks(project);
    addLog("今やるタスクの選択を解除しました。");
  } else {
    addLog(result?.message || "タスク選択を解除できませんでした。", "error");
  }
});

el.taskRunGame.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;
  runAction(
    "ゲーム起動",
    () => api.runGame(project.id),
    { pickGodotOnMissing: true }
  );
});

el.taskOpenEditor.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;
  runAction(
    "Godot起動",
    () => api.openEditor(project.id),
    { pickGodotOnMissing: true }
  );
});

el.taskVerificationNote.addEventListener("change", () => {
  const project = selectedProject();
  const task = project ? activeDevelopmentTask(project) : null;
  if (!project || !task || task.owner !== "user") return;

  saveVerificationNote(project, task).catch((error) => {
    addLog(String(error?.message || error), "error");
  });
});

el.taskVerificationClear.addEventListener("click", async () => {
  const project = selectedProject();
  const task = project ? activeDevelopmentTask(project) : null;
  if (!project || !task || task.owner !== "user" || busy) return;

  const result = await api.clearTaskVerification({
    projectId: project.id,
    taskId: task.id
  });

  if (!result?.ok) {
    addLog(result?.message || "確認結果をリセットできませんでした。", "error");
    return;
  }

  state = result.state;
  render();
  addLog(result.message, "success");
});

el.taskVerificationAddImage.addEventListener("click", async () => {
  const project = requireSelected();
  if (!project || busy) return;

  setBusy(true, "スクショ追加");
  try {
    const result = await api.addReferenceImages(project.id);
    if (result?.ok) {
      referenceImagesProjectId = project.id;
      referenceImages = result.images || [];
      renderReferenceImages();
      addLog(result.message, "success");
    } else if (result?.code !== "CANCELED") {
      addLog(result?.message || "スクショを追加できませんでした。", "error");
    }
  } catch (error) {
    addLog(String(error?.message || error), "error");
  } finally {
    setBusy(false);
  }
});

el.taskExport.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;
  runAction(
    "ChatGPT共有パック作成",
    () => api.exportChatGptPack({
      projectId: project.id,
      taskId: project.development?.activeTaskId || ""
    })
  );
});

el.developmentTab.addEventListener("click", () => setProjectTab("development"));
el.autoTestTab.addEventListener("click", () => setProjectTab("auto-test"));

el.autoTestChooseExe.addEventListener("click", async () => {
  const project = requireSelected();
  if (!project || autoTestRunning) return;
  const result = await api.chooseAutoTestExe(project.id);
  if (result?.ok) {
    el.autoTestExePath.value = result.exePath || "";
    addLog("テスト対象exeを選択しました。設定を保存してください。", "success");
  } else if (result?.code !== "CANCELED") {
    addLog(result?.message || "exeを選択できませんでした。", "error");
  }
});

el.autoTestSave.addEventListener("click", () => {
  saveAutoTestSettings(true).then(() => refreshAutoTestState()).catch((error) => {
    addLog("自動テスト設定: " + String(error?.message || error), "error");
  });
});

el.autoTestDiagnose.addEventListener("click", async () => {
  const project = requireSelected();
  if (!project || autoTestRunning) return;
  let config;
  try {
    config = autoTestConfigFromForm();
  } catch (error) {
    addLog(error.message, "error");
    return;
  }

  el.autoTestDiagnostics.replaceChildren();
  const checking = document.createElement("p");
  checking.className = "dev-empty";
  checking.textContent = "自動テスト環境を確認しています。";
  el.autoTestDiagnostics.append(checking);

  const result = await api.diagnoseAutoTest({
    projectId: project.id,
    config,
    apiKey: el.autoTestApiKey.value
  });
  if (result?.ok) {
    renderAutoTestDiagnostics(result.diagnostics);
    const failed = Object.values(result.diagnostics || {}).filter((item) => item?.status === "NG").length;
    addLog(failed ? "自動テスト診断で確認が必要な項目があります。" : "自動テスト診断はOKです.", failed ? "error" : "success");
  } else {
    addLog(result?.message || "自動テスト診断に失敗しました。", "error");
  }
});

el.autoTestStart.addEventListener("click", () => {
  runProjectAutoTest(false).catch((error) => addLog(String(error?.message || error), "error"));
});

el.autoTestRetest.addEventListener("click", () => {
  runProjectAutoTest(true).catch((error) => addLog(String(error?.message || error), "error"));
});

el.autoTestStop.addEventListener("click", async () => {
  const result = await api.stopAutoTest();
  addLog(result?.message || "AI操作の停止を要求しました。", result?.stopped ? "error" : "");
  if (result?.stopped) {
    el.autoTestProgressMessage.textContent = "緊急停止しました。キー入力も解除しています。";
  }
});

el.autoTestOpenFolder.addEventListener("click", async () => {
  const project = requireSelected();
  if (!project) return;
  const result = await api.openAutoTestFolder(project.id);
  if (!result?.ok) addLog(result?.message || "証拠保存先を開けませんでした。", "error");
});

api.onAutoTestProgress((progress) => {
  if (!progress) return;
  const total = Number(progress.total) || 0;
  const index = Number(progress.index) || 0;
  el.autoTestProgressCount.textContent = total
    ? "テスト " + index + " / " + total
    : (progress.phase === "stopped" ? "停止" : "準備中");
  el.autoTestProgressElapsed.textContent = formatAutoTestElapsed(progress.elapsedMs);
  el.autoTestProgressTest.textContent = progress.testName || (
    progress.phase === "complete" ? "テスト完了" :
    progress.phase === "stopped" ? "緊急停止" :
    "自動テスト"
  );
  el.autoTestProgressMessage.textContent = progress.message || "処理中";
  el.autoTestProgressAction.textContent = progress.lastAction || "なし";
  if (progress.phase === "stopped" || progress.phase === "complete") {
    setAutoTestControlsRunning(false);
  }
});

el.exportChatGptPack.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;

  runAction(
    "ChatGPT共有パック作成",
    () => api.exportChatGptPack({
      projectId: project.id,
      taskId: project.development?.activeTaskId || ""
    })
  );
});

el.addReferenceImage.addEventListener("click", async () => {
  const project = requireSelected();
  if (!project || busy) return;

  setBusy(true, "参考画像追加");
  try {
    const result = await api.addReferenceImages(project.id);
    if (result?.ok) {
      referenceImagesProjectId = project.id;
      referenceImages = result.images || [];
      renderReferenceImages();
      addLog(result.message, "success");
    } else if (result?.code !== "CANCELED") {
      addLog(result?.message || "参考画像を追加できませんでした。", "error");
    }
  } catch (error) {
    addLog(String(error?.message || error), "error");
  } finally {
    setBusy(false);
  }
});

el.diagnostics.addEventListener("click", () => {
  openDiagnostics().catch((error) => {
    addLog("診断情報の取得に失敗しました: " + String(error?.message || error), "error");
  });
});

el.diagnosticsClose.addEventListener("click", () => closeDialog(el.diagnosticsDialog));

el.diagnosticsExport.addEventListener("click", async () => {
  const result = await api.exportDiagnostics();
  if (result?.ok) addLog(result.message, "success");
  else if (result?.code !== "CANCELED") addLog(result?.message || "診断情報を書き出せませんでした。", "error");
});

el.diagnosticsOpenLogs.addEventListener("click", async () => {
  const result = await api.openLogsFolder();
  if (!result?.ok) addLog(result?.message || "ログフォルダを開けませんでした。", "error");
});

el.diagnosticsClearLogs.addEventListener("click", async () => {
  const result = await api.clearDiagnosticLogs();
  if (result?.ok) {
    addLog(result.message, "success");
    const refreshed = await api.getDiagnostics();
    if (refreshed?.ok) renderDiagnostics(refreshed.diagnostics);
  } else {
    addLog(result?.message || "診断ログを消去できませんでした。", "error");
  }
});

el.update.addEventListener("click", async () => {
  const status = state?.update?.status;
  let result;

  if (status === "available") {
    result = await api.downloadUpdate();
  } else if (status === "downloaded") {
    result = await api.installUpdate();
  } else {
    result = await api.checkForUpdates();
  }

  if (result?.state) {
    state.update = result.state;
    renderUpdate(state.update);
  }
  if (!result?.ok && result?.code !== "DEV_MODE") {
    addLog(result?.message || "更新処理に失敗しました。", "error");
  }
});

el.updateRelease.addEventListener("click", () => api.openUpdatePage());

api.onUpdateState((update) => {
  if (!state) return;
  state.update = update;
  renderUpdate(update);
  if (update.status === "available") addLog("Game Dev Hub v" + update.availableVersion + " を利用できます。");
  if (update.status === "downloaded") addLog("更新の準備ができました。再起動して適用できます。", "success");
  if (update.status === "error") addLog(update.message || "自動更新に失敗しました。", "error");
});

el.refresh.addEventListener("click", () => runAction("状態更新", async () => {
  const result = await api.getState();
  return { ok: result.ok, message: "状態を更新しました。", state: result };
}));

el.godot.addEventListener("click", () => runAction("Godot設定", () => api.chooseGodot()));

el.createFoundationProject.addEventListener("click", () => {
  el.foundationGameNameInput.value = "";
  el.foundationRepositoryUrlInput.value = "";
  el.foundationCreateError.textContent = "";
  el.foundationCreateError.classList.add("hidden");
  el.foundationCreateDialog.showModal();
  el.foundationGameNameInput.focus();
});

el.foundationCreateClose.addEventListener("click", () => closeDialog(el.foundationCreateDialog));
el.foundationCreateCancel.addEventListener("click", () => closeDialog(el.foundationCreateDialog));

el.foundationCreateForm.addEventListener("submit", async (event) => {
  const submitter = event.submitter;
  if (!submitter || submitter.value !== "default") return;

  event.preventDefault();
  el.foundationCreateError.textContent = "";
  el.foundationCreateError.classList.add("hidden");

  const result = await runAction(
    "Foundation付きゲーム作成",
    () => api.createFoundationProject({
      name: el.foundationGameNameInput.value,
      repositoryUrl: el.foundationRepositoryUrlInput.value
    })
  );

  if (result?.ok) {
    closeDialog(el.foundationCreateDialog, "default");
    return;
  }

  if (result?.code && result.code !== "CANCELED") {
    el.foundationCreateError.textContent =
      result.message || "Foundation付きGameを作成できませんでした。";
    el.foundationCreateError.classList.remove("hidden");
    el.foundationGameNameInput.focus();
  }
});

el.foundationUpdate.addEventListener("click", () => {
  const project = requireSelected();
  if (!project || busy || !project.foundation?.valid) return;
  runAction(
    "Foundation更新",
    () => api.updateProjectFoundation(project.id)
  );
});

el.addProject.addEventListener("click", () => {
  el.nameInput.value = "";
  el.urlInput.value = "";
  el.addDialog.showModal();
  el.urlInput.focus();
});

el.addDialogClose.addEventListener("click", () => closeDialog(el.addDialog));
el.addDialogCancel.addEventListener("click", () => closeDialog(el.addDialog));

el.importProject.addEventListener("click", () => runAction(
  "既存Game登録",
  () => api.importExistingProject()
));

el.addForm.addEventListener("submit", (event) => {
  const submitter = event.submitter;
  if (!submitter || submitter.value !== "default") return;

  event.preventDefault();
  el.addDialog.close();

  runAction("ゲーム追加", () => api.addGitHubProject({
    name: el.nameInput.value,
    repositoryUrl: el.urlInput.value
  }));
});

el.start.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;

  const repo = project.repository || {};
  const localOnly =
    repo.valid &&
    (repo.dirty || (repo.ahead || 0) > 0 || !state?.network?.online || repo.branch !== project.defaultBranch);

  if (localOnly) {
    runAction(
      "Godot起動",
      () => api.openEditor(project.id),
      { pickGodotOnMissing: true }
    );
    return;
  }

  runAction(
    "開発開始",
    () => api.startDevelopment(project.id),
    { pickGodotOnMissing: true }
  );
});

el.sync.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;
  runAction("最新版への更新", () => api.syncProject(project.id));
});

el.editor.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;
  runAction(
    "Godot起動",
    () => api.openEditor(project.id),
    { pickGodotOnMissing: true }
  );
});

el.run.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;
  runAction(
    "ゲーム起動",
    () => api.runGame(project.id),
    { pickGodotOnMissing: true }
  );
});

el.folder.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;
  runAction("フォルダ表示", () => api.openFolder(project.id));
});

el.github.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;
  runAction("GitHub表示", () => api.openGitHub(project.id));
});

el.remove.addEventListener("click", () => {
  const project = requireSelected();
  if (!project) return;

  el.removeDialogText.textContent =
    project.name + " をGame Dev Hubから外します。PC上のFileとGitHub Repositoryは削除しません。";
  el.removeDialog.showModal();
});

el.removeDialogCancel.addEventListener("click", () => closeDialog(el.removeDialog));

el.confirmRemove.addEventListener("click", (event) => {
  event.preventDefault();
  const project = requireSelected();
  if (!project) return;

  el.removeDialog.close();
  runAction("ゲーム登録解除", () => api.removeProject(project.id));
});

el.clearLog.addEventListener("click", () => {
  el.logList.replaceChildren();
});

setProjectTab("development");
renderAutoTestDiagnostics(null);

refreshState(false).catch((error) => {
  addLog("初期状態の確認に失敗しました: " + String(error?.message || error), "error");
});
