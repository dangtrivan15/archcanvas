use std::sync::{Arc, Mutex};
use std::process::Command;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

/// Stores the bridge server port once discovered from sidecar stdout.
struct BridgePort(Arc<Mutex<Option<u16>>>);

/// Resolve the user's login shell PATH.
/// When launched from Finder, the app gets a minimal PATH (/usr/bin:/bin:...).
/// The sidecar needs the full PATH so the Claude SDK can find the `claude` CLI.
fn resolve_shell_path() -> String {
    let default_path = std::env::var("PATH").unwrap_or_default();
    // Try to get PATH from user's login shell
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    Command::new(&shell)
        .args(["-l", "-c", "echo $PATH"])
        .output()
        .ok()
        .and_then(|out| String::from_utf8(out.stdout).ok())
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
        .unwrap_or(default_path)
}

/// Tauri command: returns the bridge port, or an error if not yet started.
#[tauri::command]
fn get_bridge_port(state: tauri::State<BridgePort>) -> Result<u16, String> {
    state
        .0
        .lock()
        .unwrap()
        .ok_or_else(|| "Bridge not started".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(BridgePort(Arc::new(Mutex::new(None))))
        .setup(|app| {
            let shell_path = resolve_shell_path();

            let sidecar = app
                .shell()
                .sidecar("archcanvas-bridge")
                .expect("failed to create sidecar command")
                .env("PATH", &shell_path);

            let (mut rx, _child) = sidecar
                .args(["--port", "0"])
                .spawn()
                .expect("failed to spawn bridge sidecar");

            // Clone the Arc so the async task owns it independently of `app`
            let port_lock = app.state::<BridgePort>().0.clone();
            tauri::async_runtime::spawn(async move {
                let mut port_found = false;
                while let Some(event) = rx.recv().await {
                    match &event {
                        CommandEvent::Stdout(line) => {
                            if !port_found {
                                let line = String::from_utf8_lossy(line);
                                if let Some(port_str) = line.strip_prefix("BRIDGE_PORT=") {
                                    if let Ok(port) = port_str.trim().parse::<u16>() {
                                        *port_lock.lock().unwrap() = Some(port);
                                        port_found = true;
                                    }
                                }
                            }
                        }
                        CommandEvent::Stderr(line) => {
                            let line = String::from_utf8_lossy(line);
                            eprintln!("[sidecar] {}", line.trim());
                        }
                        CommandEvent::Terminated(payload) => {
                            eprintln!("[sidecar] terminated: code={:?} signal={:?}", payload.code, payload.signal);
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_bridge_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
