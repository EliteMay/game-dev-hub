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
  importProject: document.querySelector("#import-project-button"),
  start: document.querySelector("#start-button"),
  sync: document.querySelector("#sync-button"),
  editor: document.querySelector("#editor-button"),
  run: document.querySelector("#run-button"),
  folder: document.querySelector("#folder-button"),
  github: document.querySelector("#github-button"),
  remove: document.querySelector("#remove-project-button"),
  taskProgressBadge: document.querySelector("#task-progress-badge"),
  taskCurrentPhase: document.querySelector("#task-current-phase"),
  taskSource: document.querySelector("#task-source"),
  developmentTaskList: document.querySelector("#development-task-list"),
  taskEmpty: document.querySelector("#task-empty"),
  exportChatGptPack: document.querySelector("#export-chatgpt-pack-button"),
  addReferenceImage: document.querySelector("#add-reference-image-button"),
  referenceImageCount: document.querySelector("#reference-image-count"),
  referenceImageList: document.querySelector("#reference-image-list"),
  referenceImageEmpty: document.querySelector("#reference-image-empty"),
  clearLog: document.querySelector("#clear-log-button"),
  logList: document.querySelector("#log-list"),
  taskStatus: document.querySelector("#task-status"),
  appVersion: document.querySelector("#app-version"),
  addDialog: document.querySelector("#add-dialog"),
  addDialogClose: document.querySelector("#add-dialog-close-button"),
  addDialogCancel: document.querySelector("#add-dialog-cancel-button"),
  addForm: document.querySelector("#add-form"),
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
  diagnosticsClearLogs: document.querySelector("#diagnostics-clear-logs-button")
};

let state = null;
let selectedId = null;
let busy = false;
let referenceImages = [];
let referenceImagesProjectId = "";

const actionButtons = [
  el.refresh,
  el.update,
  el.godot,
  el.addProject,
  el.importProject,
  el.start,
  el.sync,
  el.editor,
  el.run,
  el.folder,
  el.github,
  el.remove,
  el.exportChatGptPack,
  el.addReferenceImage
];

function setBusy(value, label = "") {
  busy = value;
  for (const button of actionButtons) {
    if (button) button.disabled = value;
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
      render();
    });

    el.projectList.append(button);
  }
}

function allDevelopmentTasks(tasks) {
  return (tasks?.sections || []).flatMap((section) =>
    section.tasks.map((task) => ({ ...task, section: section.title }))
  );
}

function renderDevelopmentTasks(project) {
  const tasks = project?.development?.tasks;
  const activeTaskId = project?.development?.activeTaskId || "";

  el.developmentTaskList.replaceChildren();

  if (!tasks?.available) {
    el.taskProgressBadge.textContent = "Roadmapなし";
    el.taskCurrentPhase.textContent = "やることFileが見つかりません";
    el.taskSource.textContent = "Repository内のRoadmap/TODOを読みます。";
    el.taskEmpty.classList.remove("hidden");
    return;
  }

  el.taskEmpty.classList.add("hidden");
  el.taskProgressBadge.textContent = tasks.done + " / " + tasks.total + " 完了";
  el.taskCurrentPhase.textContent = tasks.currentSection || "Roadmap";
  el.taskSource.textContent = tasks.sourceFile + " をRepositoryから読込";

  for (const section of tasks.sections) {
    const group = document.createElement("section");
    group.className = "task-group";

    const heading = document.createElement("h4");
    heading.textContent = section.title;
    group.append(heading);

    for (const task of section.tasks) {
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
      meta.textContent = task.done
        ? "完了"
        : task.id === activeTaskId
          ? "作業中"
          : (!activeTaskId && tasks.nextTask?.id === task.id ? "次の候補" : "クリックして作業中にする");

      copy.append(text, meta);
      item.append(mark, copy);

      if (!task.done) {
        item.addEventListener("click", async () => {
          const result = await api.setActiveTask({ projectId: project.id, taskId: task.id });
          if (!result?.ok) {
            addLog(result?.message || "作業中タスクを保存できませんでした。", "error");
            return;
          }

          project.development.activeTaskId = task.id;
          renderDevelopmentTasks(project);
          addLog("作業中タスク: " + task.text, "success");
        });
      }

      group.append(item);
    }

    el.developmentTaskList.append(group);
  }
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

  renderDevelopmentTasks(project);
  if (referenceImagesProjectId !== project.id) {
    referenceImages = [];
    renderReferenceImages();
    refreshReferenceImages().catch(() => {});
  }

  el.detailSlug.textContent = project.repositorySlug;
  el.detailName.textContent = project.name;
  el.detailPath.textContent = project.localPath;

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
    el.branchValue.textContent = "ローカル変更あり";
    el.branchDescription.textContent =
      repo.changedCount + "件の変更があります。自動更新は安全停止します。";
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

  const ready =
    state.git?.available &&
    state.godot?.available &&
    repo.valid &&
    !repo.dirty &&
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
    el.heroStatus.textContent = "安全停止";
    el.heroTitle.textContent = "Local変更を保護しています";
    el.heroDescription.textContent =
      "変更を勝手に消さないため、GitHubからの自動更新を停止しています。";
  } else if (!state.network?.online && repo.valid) {
    el.heroStatus.textContent = "オフライン";
    el.heroTitle.textContent = "ローカル開発は続けられます";
    el.heroDescription.textContent =
      "GitHub同期は利用できません。Godotで開く・ゲーム起動・フォルダ表示は利用できます。";
  } else if (!state.network?.online && !repo.exists) {
    el.heroStatus.textContent = "オフライン";
    el.heroTitle.textContent = "最初の取得にはネット接続が必要です";
    el.heroDescription.textContent =
      "接続が戻ったら「開発を開始」でRepositoryを取得できます。";
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
    if (log) addLog("状態を更新しました。", "success");
  } else {
    addLog(result?.message || "状態確認に失敗しました。", "error");
  }
  return result;
}

async function runAction(label, action, options = {}) {
  if (busy) return;
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
  } catch (error) {
    addLog(String(error?.message || error), "error");
  } finally {
    setBusy(false);
  }
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

refreshState(false).catch((error) => {
  addLog("初期状態の確認に失敗しました: " + String(error?.message || error), "error");
});
