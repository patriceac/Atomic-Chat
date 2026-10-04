use base64::Engine;
use serde::{Deserialize, Serialize};
use std::{path::Path, process::Stdio, sync::OnceLock, time::Duration};
use tauri::Manager;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, ChildStdout, Command},
    sync::Mutex,
};

struct SpeechWorker {
    _child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
}

impl SpeechWorker {
    fn start(resources: &Path) -> Result<Self, String> {
        // Bun's module resolver expects ordinary paths rather than Win32 verbatim paths.
        #[cfg(windows)]
        let resources = {
            let value = resources.to_string_lossy();
            std::path::PathBuf::from(if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
                format!(r"\\{}", rest)
            } else {
                value.strip_prefix(r"\\?\").unwrap_or(&value).to_string()
            })
        };
        let mut command =
            Command::new(resources.join(if cfg!(windows) { "bun.exe" } else { "bun" }));
        command
            .arg(resources.join("resources/tts/read-aloud-worker.mjs"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        #[cfg(windows)]
        command.creation_flags(0x08000000);
        let mut child = command.spawn().map_err(|err| err.to_string())?;
        let input = child.stdin.take().ok_or("Speech input unavailable")?;
        let output = BufReader::new(child.stdout.take().ok_or("Speech output unavailable")?);
        Ok(Self {
            _child: child,
            input,
            output,
        })
    }

    async fn render(&mut self, request: &SpeechRequest) -> Result<Vec<u8>, String> {
        let mut body = serde_json::to_vec(request).map_err(|err| err.to_string())?;
        body.push(b'\n');
        self.input
            .write_all(&body)
            .await
            .map_err(|err| err.to_string())?;
        self.input.flush().await.map_err(|err| err.to_string())?;
        let mut line = String::new();
        if self
            .output
            .read_line(&mut line)
            .await
            .map_err(|err| err.to_string())?
            == 0
        {
            return Err("Speech worker exited".into());
        }
        let reply: SpeechReply = serde_json::from_str(&line).map_err(|err| err.to_string())?;
        if let Some(error) = reply.error {
            return Err(error);
        }
        base64::engine::general_purpose::STANDARD
            .decode(reply.audio.ok_or("Speech returned no audio")?)
            .map_err(|err| err.to_string())
    }
}

#[derive(Serialize)]
struct SpeechRequest {
    text: String,
    language: String,
    voice: String,
    rate: f32,
}
#[derive(Deserialize)]
struct SpeechReply {
    audio: Option<String>,
    error: Option<String>,
}

fn worker() -> &'static Mutex<Option<SpeechWorker>> {
    static WORKER: OnceLock<Mutex<Option<SpeechWorker>>> = OnceLock::new();
    WORKER.get_or_init(|| Mutex::new(None))
}

#[tauri::command]
pub async fn synthesize_speech(
    app: tauri::AppHandle,
    text: String,
    language: String,
    voice: String,
    rate: f32,
) -> Result<tauri::ipc::Response, String> {
    if text.chars().count() > 300
        || text.trim().is_empty()
        || !["en", "fr"].contains(&language.as_str())
        || !["F1", "F2", "F3", "F4", "F5", "M1", "M2", "M3", "M4", "M5"].contains(&voice.as_str())
        || !rate.is_finite()
        || !(0.5..=2.0).contains(&rate)
    {
        return Err("Invalid speech request".into());
    }
    let mut state = worker().lock().await;
    if state.is_none() {
        let resources = app.path().resource_dir().map_err(|err| err.to_string())?;
        *state = Some(SpeechWorker::start(&resources)?);
    }
    let request = SpeechRequest {
        text,
        language,
        voice,
        rate,
    };
    let result = tokio::time::timeout(
        Duration::from_secs(90),
        state.as_mut().unwrap().render(&request),
    )
    .await;
    match result {
        Ok(Ok(audio)) => Ok(tauri::ipc::Response::new(audio)),
        Ok(Err(error)) => {
            *state = None;
            Err(error)
        }
        Err(_) => {
            *state = None;
            Err("Speech generation timed out".into())
        }
    }
}
