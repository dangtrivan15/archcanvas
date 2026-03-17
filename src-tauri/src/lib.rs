use std::sync::{Arc, Mutex};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

/// Sidecar lifecycle state — tracks port discovery and holds the child handle
/// so we can kill the process on app exit and report failures to the frontend.
struct SidecarState {
    /// The bridge port, set once the sidecar prints `BRIDGE_PORT=<n>`.
    port: Option<u16>,
    /// The sidecar child process handle. Stored so we can kill it on exit.
    child: Option<CommandChild>,
    /// If the sidecar terminates before reporting a port, this holds the exit code.
    exit_code: Option<i32>,
}

impl SidecarState {
    fn new() -> Self {
        Self { port: None, child: None, exit_code: None }
    }
}

type SharedSidecarState = Arc<Mutex<SidecarState>>;

/// Resolve the user's login shell PATH.
/// When launched from Finder, the app gets a minimal PATH (/usr/bin:/bin:...).
/// The sidecar needs the full PATH so the Claude SDK can find the `claude` CLI.
fn resolve_shell_path() -> String {
    let default_path = std::env::var("PATH").unwrap_or_default();
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    std::process::Command::new(&shell)
        .args(["-l", "-c", "echo $PATH"])
        .output()
        .ok()
        .and_then(|out| String::from_utf8(out.stdout).ok())
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
        .unwrap_or(default_path)
}

/// Tauri command: returns the bridge port once the sidecar is ready.
///
/// Returns:
/// - `Ok(port)` if the sidecar has reported its port
/// - `Err("Bridge sidecar crashed (exit code: N)")` if the sidecar terminated
/// - `Err("Bridge starting...")` if still waiting for the port
#[tauri::command]
fn get_bridge_port(state: tauri::State<SharedSidecarState>) -> Result<u16, String> {
    let guard = state.lock().map_err(|_| "Internal error: lock poisoned".to_string())?;

    if let Some(port) = guard.port {
        return Ok(port);
    }

    if let Some(code) = guard.exit_code {
        return Err(format!("Bridge sidecar crashed (exit code: {})", code));
    }

    Err("Bridge starting...".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sidecar_state: SharedSidecarState = Arc::new(Mutex::new(SidecarState::new()));

    // Each closure gets its own Arc clone — setup and run both require 'static
    let state_for_setup = sidecar_state.clone();
    let state_for_run = sidecar_state.clone();

    // Option A: Install signal handler (SIGTERM + SIGINT) to kill sidecar
    // before the process exits. Covers graceful kill, system shutdown, Ctrl+C.
    // SIGKILL is uncatchable — Option B (sidecar idle timeout) handles that.
    let state_for_signal = sidecar_state.clone();
    ctrlc::set_handler(move || {
        eprintln!("[signal] Caught SIGTERM/SIGINT — killing sidecar");
        if let Ok(mut guard) = state_for_signal.lock() {
            if let Some(child) = guard.child.take() {
                let _ = child.kill();
                eprintln!("[signal] Sidecar killed");
            }
        }
        std::process::exit(0);
    })
    .expect("failed to set signal handler");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(sidecar_state)
        .setup(move |app| {
            let shell_path = resolve_shell_path();

            let sidecar = app
                .shell()
                .sidecar("archcanvas-bridge")
                .expect("failed to create sidecar command")
                .env("PATH", &shell_path);

            let (mut rx, child) = sidecar
                .args(["--port", "0"])
                .spawn()
                .expect("failed to spawn bridge sidecar");

            // Store the child handle so we can kill it on app exit
            {
                let mut guard = state_for_setup
                    .lock()
                    .expect("sidecar state lock poisoned during setup");
                guard.child = Some(child);
            }

            // Clone for the async stdout reader task
            let state_for_task = state_for_setup.clone();
            tauri::async_runtime::spawn(async move {
                let mut port_found = false;
                while let Some(event) = rx.recv().await {
                    match &event {
                        CommandEvent::Stdout(line) => {
                            if !port_found {
                                let line = String::from_utf8_lossy(line);
                                if let Some(port_str) = line.strip_prefix("BRIDGE_PORT=") {
                                    if let Ok(port) = port_str.trim().parse::<u16>() {
                                        if let Ok(mut guard) = state_for_task.lock() {
                                            guard.port = Some(port);
                                        }
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
                            eprintln!(
                                "[sidecar] terminated: code={:?} signal={:?}",
                                payload.code, payload.signal
                            );
                            if let Ok(mut guard) = state_for_task.lock() {
                                guard.exit_code = Some(payload.code.unwrap_or(-1));
                                guard.child = None; // Already dead — drop the handle
                            }
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_bridge_port])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app, event| {
            if let tauri::RunEvent::Exit = event {
                // Gracefully kill the sidecar on app exit
                if let Ok(mut guard) = state_for_run.lock() {
                    if let Some(child) = guard.child.take() {
                        let _ = child.kill();
                        eprintln!("[sidecar] killed on app exit");
                    }
                }
            }
        });
}
