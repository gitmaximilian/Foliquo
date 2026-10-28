#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use sha2::{Digest, Sha256};
use std::{
    env,
    fs::{self, OpenOptions},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
};
use tauri::{utils::config::WebviewUrl, webview::{DownloadEvent, NewWindowResponse, WebviewWindowBuilder}, AppHandle, Manager, WindowEvent};
use tauri_plugin_opener::OpenerExt;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri_plugin_updater::UpdaterExt;

struct OwnedService {
    child: Mutex<Option<Child>>,
    port: u16,
    token: String,
}

impl OwnedService {
    fn stop(&self) {
        let Ok(mut guard) = self.child.lock() else { return };
        let Some(mut child) = guard.take() else { return };
        let endpoint = format!("http://127.0.0.1:{}/api/lifecycle/stop", self.port);
        let _ = ureq::post(&endpoint)
            .set("Authorization", &format!("Bearer {}", self.token))
            .timeout(Duration::from_secs(3))
            .call();
        for _ in 0..20 {
            if child.try_wait().ok().flatten().is_some() { return }
            thread::sleep(Duration::from_millis(100));
        }
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn workspace_directory() -> Result<PathBuf, String> {
    if let Some(path) = env::var_os("FOLIQUO_DATA_DIR") {
        let path = PathBuf::from(path);
        if !path.is_absolute() { return Err("FOLIQUO_DATA_DIR must be absolute.".into()) }
        return Ok(path);
    }
    let home = env::var_os("HOME").map(PathBuf::from).or_else(|| env::var_os("USERPROFILE").map(PathBuf::from)).ok_or("Home directory is unavailable.")?;
    #[cfg(target_os = "macos")]
    { Ok(home.join("Library/Application Support/Foliquo")) }
    #[cfg(target_os = "windows")]
    { Ok(env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or(home.join("AppData/Local")).join("Foliquo")) }
    #[cfg(target_os = "linux")]
    {
        if env::var("FLATPAK_ID").ok().as_deref() == Some("at.maximilianauer.foliquo") {
            return Ok(home.join(".local/share/foliquo"));
        }
        let xdg = env::var_os("XDG_DATA_HOME").map(PathBuf::from).unwrap_or(home.join(".local/share"));
        if !xdg.is_absolute() { return Err("XDG_DATA_HOME must be absolute.".into()) }
        Ok(xdg.join("foliquo"))
    }
}

fn workspace_id(path: &Path) -> String {
    format!("{:x}", Sha256::digest(path.to_string_lossy().as_bytes()))
}

fn probe(port: u16) -> Option<serde_json::Value> {
    let endpoint = format!("http://127.0.0.1:{port}/api/health");
    ureq::get(&endpoint).timeout(Duration::from_millis(800)).call().ok()?.into_json().ok()
}

fn select_port(workspace: &Path) -> Result<(u16, bool), String> {
    if let Some(health) = probe(4318) {
        if health["application"] == "foliquo" && health["protocol"] == 1 {
            if health["workspaceId"] == workspace_id(workspace) {
                if health["version"] != env!("CARGO_PKG_VERSION") || health["desktopBridge"] != 1 {
                    return Err("The running Foliquo service is incompatible with the desktop app. Close it before opening this version.".into());
                }
                return Ok((4318, true));
            }
        }
    }
    if std::net::TcpStream::connect(("127.0.0.1", 4318)).is_err() { return Ok((4318, false)) }
    let listener = std::net::TcpListener::bind(("127.0.0.1", 0)).map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    Ok((port, false))
}

fn node_path(service: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    { service.join("runtime/node.exe") }
    #[cfg(not(target_os = "windows"))]
    { service.join("runtime/node") }
}

fn office_path(resource: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    { resource.join("office/LibreOffice/program/soffice.exe") }
    #[cfg(target_os = "macos")]
    { resource.join("office/LibreOffice.app/Contents/MacOS/soffice") }
    #[cfg(target_os = "linux")]
    { resource.join("office/libreoffice/program/soffice") }
}

fn start_service(app: &tauri::App) -> Result<(u16, Option<OwnedService>), String> {
    let resource = app.path().resource_dir().map_err(|e| e.to_string())?;
    let service = resource.join("service");
    let node = node_path(&service);
    let office = office_path(&resource);
    if !node.is_file() || !service.join("server.mjs").is_file() || !office.is_file() {
        return Err("The desktop package is incomplete: Node, Foliquo, or LibreOffice is missing.".into());
    }
    let workspace = workspace_directory()?;
    let (port, reuse) = select_port(&workspace)?;
    if reuse { return Ok((port, None)) }
    let logs = env::var_os("FOLIQUO_LOG_DIR")
        .map(PathBuf::from)
        .map(Ok)
        .unwrap_or_else(|| app.path().app_log_dir())
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&logs).map_err(|e| e.to_string())?;
    let log = OpenOptions::new().create(true).append(true).open(logs.join("desktop-service.log")).map_err(|e| e.to_string())?;
    let stdout = log.try_clone().map_err(|e| e.to_string())?;
    let mut child = Command::new(&node)
        .arg(service.join("server.mjs"))
        .current_dir(&service)
        .env("FOLIQUO_PORT", port.to_string())
        .env("FOLIQUO_DATA_DIR", &workspace)
        .env("FOLIQUO_NO_BROWSER", "1")
        .env("TRANSLATEOCR_SOFFICE", &office)
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(log))
        .spawn().map_err(|e| format!("The bundled Node service could not start: {e}"))?;
    let expected_id = workspace_id(&workspace);
    for _ in 0..400 {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            return Err(format!("The local service exited during startup ({status}). Check desktop-service.log in the Foliquo log directory."));
        }
        if let Some(health) = probe(port) {
            if health["application"] == "foliquo" && health["protocol"] == 1 && health["workspaceId"] == expected_id {
                let record_path = workspace.join("service.json");
                if let Ok(bytes) = fs::read(&record_path) {
                    if let Ok(record) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                        if record["instance"] == health["instance"] {
                            if let Some(token) = record["token"].as_str() {
                                return Ok((port, Some(OwnedService { child: Mutex::new(Some(child)), port, token: token.to_owned() })));
                            }
                        }
                    }
                }
            }
        }
        thread::sleep(Duration::from_millis(150));
    }
    let _ = child.kill();
    Err("The local Foliquo service did not become ready. Check desktop-service.log in the Foliquo log directory.".into())
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn emit_updater_state(app: &AppHandle, payload: serde_json::Value) {
    let Ok(payload) = serde_json::to_string(&payload) else { return };
    let script = format!("window.dispatchEvent(new CustomEvent('foliquo-desktop-updater',{{detail:{payload}}}));");
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(&script);
    }
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn request_update(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let updater = match app.updater() {
            Ok(updater) => updater,
            Err(error) => {
                eprintln!("Foliquo updater setup failed: {error}");
                emit_updater_state(&app, serde_json::json!({"state":"failed"}));
                return;
            }
        };
        let update = match updater.check().await {
            Ok(Some(update)) => update,
            Ok(None) => {
                emit_updater_state(&app, serde_json::json!({"state":"unavailable"}));
                return;
            }
            Err(error) => {
                eprintln!("Foliquo updater check failed: {error}");
                emit_updater_state(&app, serde_json::json!({"state":"failed"}));
                return;
            }
        };
        let version = update.version.clone();
        emit_updater_state(&app, serde_json::json!({"state":"downloading","version":version,"downloaded":0,"total":null}));
        #[cfg(target_os = "windows")]
        let update = update.restart_after_install(true);
        let progress_app = app.clone();
        let progress_version = version.clone();
        let install_app = app.clone();
        let install_version = version.clone();
        let mut downloaded = 0_u64;
        let result = update.download_and_install(
            move |chunk, total| {
                downloaded += chunk as u64;
                emit_updater_state(&progress_app, serde_json::json!({"state":"downloading","version":progress_version,"downloaded":downloaded,"total":total}));
            },
            move || emit_updater_state(&install_app, serde_json::json!({"state":"installing","version":install_version})),
        ).await;
        if let Err(error) = result {
            eprintln!("Foliquo updater installation failed: {error}");
            emit_updater_state(&app, serde_json::json!({"state":"failed"}));
            return;
        }
        emit_updater_state(&app, serde_json::json!({"state":"installed","version":version}));
        #[cfg(target_os = "macos")]
        app.restart();
    });
}

fn main() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init());
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    builder
        .setup(|app| {
            let startup = start_service(app);
            let app_for_navigation = app.handle().clone();
            let app_for_new_window = app.handle().clone();
            let mut builder = match &startup {
                Ok((port, _)) => WebviewWindowBuilder::new(app, "main", WebviewUrl::External(format!("http://127.0.0.1:{port}/").parse()?)),
                Err(_) => WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into())),
            };
            if let Ok((port, _)) = &startup {
                let origin = format!("http://127.0.0.1:{port}");
                builder = builder.initialization_script(format!("if (location.origin === {}) window.__FOLIQUO_DESKTOP__ = true;", serde_json::to_string(&origin)?));
            } else if let Err(message) = &startup {
                builder = builder.initialization_script(format!("window.__FOLIQUO_START_ERROR__ = {};", serde_json::to_string(message)?));
            }
            let local_port = startup.as_ref().ok().map(|(port, _)| *port);
            builder = builder
                .title("Foliquo")
                .inner_size(1280.0, 820.0)
                .min_inner_size(800.0, 560.0)
                .on_navigation(move |url| {
                    if url.scheme() == "foliquo-update" {
                        if url.host_str() == Some("install") {
                            #[cfg(any(target_os = "macos", target_os = "windows"))]
                            request_update(app_for_navigation.clone());
                        }
                        return false;
                    }
                    // Tauri uses its custom scheme on macOS/Linux and the
                    // tauri.localhost origin for local assets on Windows.
                    // Keep both available for the service-start error page,
                    // and allow WebView2's initial empty document.
                    if url.as_str() == "about:blank"
                        || url.scheme() == "tauri"
                        || (matches!(url.scheme(), "http" | "https") && url.host_str() == Some("tauri.localhost"))
                    { return true }
                    if url.scheme() == "http" && url.host_str() == Some("127.0.0.1") && url.port() == local_port { return true }
                    if url.scheme() == "https" || url.scheme() == "mailto" {
                        let _ = app_for_navigation.opener().open_url(url.as_str(), None::<&str>);
                    }
                    false
                })
                .on_new_window(move |url, _| {
                    if url.scheme() == "foliquo-update" {
                        if url.host_str() == Some("install") {
                            #[cfg(any(target_os = "macos", target_os = "windows"))]
                            request_update(app_for_new_window.clone());
                        }
                        return NewWindowResponse::Deny;
                    }
                    if url.scheme() == "https" || url.scheme() == "mailto" {
                        let _ = app_for_new_window.opener().open_url(url.as_str(), None::<&str>);
                    }
                    NewWindowResponse::Deny
                })
                .on_download(|_webview, event| {
                    if let DownloadEvent::Requested { destination, .. } = event {
                        let default_name = destination.file_name().and_then(|name| name.to_str()).unwrap_or("foliquo-download");
                        let selected = rfd::FileDialog::new().set_file_name(default_name).save_file();
                        if let Some(path) = selected { *destination = path; true } else { false }
                    } else { true }
                });
            builder.build()?;
            if let Ok((_, Some(owned))) = startup { app.manage(owned); }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, WindowEvent::Destroyed) {
                if let Some(owned) = window.app_handle().try_state::<OwnedService>() { owned.stop(); }
            }
        })
        .run(tauri::generate_context!())
        .expect("Foliquo desktop failed to start");
}
