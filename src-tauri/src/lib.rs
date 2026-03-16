use std::sync::{Arc, Mutex};
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

/// Stores the bridge server port once discovered from sidecar stdout.
struct BridgePort(Arc<Mutex<Option<u16>>>);

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
        .manage(BridgePort(Arc::new(Mutex::new(None))))
        .setup(|app| {
            let sidecar = app
                .shell()
                .sidecar("archcanvas-bridge")
                .expect("failed to create sidecar command");

            let (mut rx, _child) = sidecar
                .args(["--port", "0"])
                .spawn()
                .expect("failed to spawn bridge sidecar");

            // Clone the Arc so the async task owns it independently of `app`
            let port_lock = app.state::<BridgePort>().0.clone();
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    if let CommandEvent::Stdout(line) = &event {
                        let line = String::from_utf8_lossy(line);
                        if let Some(port_str) = line.strip_prefix("BRIDGE_PORT=") {
                            if let Ok(port) = port_str.trim().parse::<u16>() {
                                *port_lock.lock().unwrap() = Some(port);
                                break;
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_bridge_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
