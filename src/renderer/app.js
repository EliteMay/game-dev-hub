const api = window.gameDevHub;

const el = {
  gitDot: document.querySelector("#git-dot"),
  gitValue: document.querySelector("#git-value"),
  godotDot: document.querySelector("#godot-dot"),
  godotValue: document.querySelector("#godot-value"),
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
  clearLog: document.querySelector("#clear-log-button"),
  logList: document.querySelector("#log-list"),
  appVersion: document.querySelector("#app-version"),
  addDialog: document.querySelector("#add-dialog"),
  addForm: document.querySelector("#add-form"),
  nameInput: document.querySelector("#project-name-input"),
  urlInput: document.querySelector("#project-url-input"),
  removeDialog: document.querySelector("#remove-dialog"),
  removeDialogText: document.querySelector("#remove-dialog-text"),
  confirmRemove: document.querySelector("#confirm-remove-button")
};

let state = null;
let selectedId = null;
let busy = false;

const actionButtons = [
  el.refresh,
  el.godot,
  el.addProject,
  el.importProject,
  el.start,
  el.sync,
  el.editor,
  el.run,
  el.folder,
  el.github,
  el.remove
];

function setBusy(value) {
  busy = value;
  for (const button of actionButtons) {
    if (button) button.disabled = value;
  }
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

function renderGlobal() {
  if (!state) return;

  el.appVersion.textContent = "Game Dev Hub v" + state.appVersion;
  el.projectsRoot.textContent = state.settings?.projectsRoot || "未設定";

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
      render();
    });

    el.projectList.append(button);
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

  if (ready) {
    el.heroStatus.textContent = "準備OK";
    el.heroTitle.textContent = "このまま開発を始められます";
    el.heroDescription.textContent =
      "GitHubを確認して最新化したあと、Godot Editorを開きます。";
  } else if (!state.git?.available) {
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

  if (!selectedId || !state.projects.some((project) => project.id === selectedId)) {
    selectedId = state.projects[0]?.id || null;
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
    if (log) addLog("状態を更新しました。", "success");
  } else {
    addLog(result?.message || "状態確認に失敗しました。", "error");
  }
  return result;
}

async function runAction(label, action, options = {}) {
  if (busy) return;
  setBusy(true);
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
      if (result.projectId) selectedId = result.projectId;
      render();
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

function requireSelected() {
  const project = selectedProject();
  if (!project) {
    addLog("先にゲームを選択してください。", "error");
    return null;
  }
  return project;
}

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
