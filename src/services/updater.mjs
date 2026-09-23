import electronUpdater from "electron-updater";
import { app } from "electron";

const { autoUpdater } = electronUpdater;

export const LATEST_RELEASE_URL = "https://github.com/EliteMay/game-dev-hub/releases/latest";

let configured = false;
let sendStatus = () => {};
let currentStatus = {
  state: "idle",
  version: null,
  percent: null,
  message: "更新を確認できます。"
};
let checkPromise = null;
let downloadPromise = null;

function publicError(error) {
  const text = String(error?.message || error || "更新処理に失敗しました。");
  return text.length > 240 ? text.slice(0, 237) + "..." : text;
}

function publish(next) {
  currentStatus = {
    ...currentStatus,
    ...next,
    checkedAt: new Date().toISOString()
  };
  sendStatus({ ...currentStatus });
  return { ...currentStatus };
}

export function getUpdateStatus() {
  return { ...currentStatus };
}

export function configureUpdater(options = {}) {
  if (configured) {
    if (typeof options.sendStatus === "function") sendStatus = options.sendStatus;
    return;
  }

  configured = true;
  if (typeof options.sendStatus === "function") sendStatus = options.sendStatus;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    publish({
      state: "checking",
      percent: null,
      message: "新しいバージョンを確認しています。"
    });
  });

  autoUpdater.on("update-available", (info) => {
    publish({
      state: "available",
      version: info?.version || null,
      percent: null,
      message: "新しいバージョンが利用できます。"
    });
  });

  autoUpdater.on("update-not-available", () => {
    publish({
      state: "not-available",
      version: app.getVersion(),
      percent: null,
      message: "現在のバージョンが最新版です。"
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    const percent = Number.isFinite(progress?.percent)
      ? Math.max(0, Math.min(100, Math.round(progress.percent * 10) / 10))
      : null;

    publish({
      state: "downloading",
      percent,
      message: percent === null
        ? "更新をダウンロードしています。"
        : `更新をダウンロードしています。 ${percent}%`
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    publish({
      state: "downloaded",
      version: info?.version || currentStatus.version,
      percent: 100,
      message: "更新の準備ができました。再起動すると適用されます。"
    });
  });

  autoUpdater.on("error", (error) => {
    publish({
      state: "error",
      percent: null,
      message: "更新処理に失敗しました: " + publicError(error)
    });
  });
}

export async function checkForUpdates() {
  if (!app.isPackaged) {
    return {
      ok: false,
      code: "UPDATE_DEV_MODE",
      message: "開発起動では自動更新を確認しません。インストール版で利用できます。"
    };
  }

  if (checkPromise) return checkPromise;

  checkPromise = (async () => {
    try {
      await autoUpdater.checkForUpdates();
      return {
        ok: true,
        message: "更新を確認しました。",
        status: getUpdateStatus()
      };
    } catch (error) {
      const message = publicError(error);
      publish({
        state: "error",
        percent: null,
        message: "更新確認に失敗しました: " + message
      });
      return {
        ok: false,
        code: "UPDATE_CHECK_FAILED",
        message: "更新確認に失敗しました。Releaseページから手動更新もできます。"
      };
    } finally {
      checkPromise = null;
    }
  })();

  return checkPromise;
}

export async function downloadUpdate() {
  if (!app.isPackaged) {
    return {
      ok: false,
      code: "UPDATE_DEV_MODE",
      message: "開発起動では更新をダウンロードしません。"
    };
  }

  if (currentStatus.state !== "available") {
    return {
      ok: false,
      code: "UPDATE_NOT_READY",
      message: "先に更新を確認してください。"
    };
  }

  if (downloadPromise) return downloadPromise;

  downloadPromise = (async () => {
    try {
      publish({
        state: "downloading",
        percent: 0,
        message: "更新のダウンロードを開始しています。"
      });
      await autoUpdater.downloadUpdate();
      return {
        ok: true,
        message: "更新をダウンロードしました。",
        status: getUpdateStatus()
      };
    } catch (error) {
      const message = publicError(error);
      publish({
        state: "error",
        percent: null,
        message: "更新ダウンロードに失敗しました: " + message
      });
      return {
        ok: false,
        code: "UPDATE_DOWNLOAD_FAILED",
        message: "更新のダウンロードに失敗しました。再試行するかReleaseページを利用してください。"
      };
    } finally {
      downloadPromise = null;
    }
  })();

  return downloadPromise;
}

export function installDownloadedUpdate() {
  if (currentStatus.state !== "downloaded") {
    return {
      ok: false,
      code: "UPDATE_NOT_DOWNLOADED",
      message: "更新のダウンロードがまだ完了していません。"
    };
  }

  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });

  return {
    ok: true,
    message: "アプリを再起動して更新します。"
  };
}
