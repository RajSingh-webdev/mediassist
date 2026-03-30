import json
import os
import re
import site
import sys
from pathlib import Path

MODEL = None
MODEL_DEVICE = "cpu"
WHISPER_MODEL_CLASS = None
DLL_HANDLES = []


def configure_windows_cuda_dlls():
    if os.name != "nt":
        return

    candidate_roots = []
    try:
        candidate_roots.append(Path(site.getusersitepackages()))
    except Exception:
        pass

    try:
        candidate_roots.extend(Path(path) for path in site.getsitepackages())
    except Exception:
        pass

    candidate_dirs = []
    for root in candidate_roots:
        candidate_dirs.extend([
            root / "nvidia" / "cublas" / "bin",
            root / "nvidia" / "cuda_runtime" / "bin",
            root / "nvidia" / "cuda_nvrtc" / "bin",
            root / "nvidia" / "cudnn" / "bin",
            root / "ctranslate2",
        ])

    existing_path = os.environ.get("PATH", "")
    prepend_paths = []

    for directory in candidate_dirs:
        if directory.exists():
            DLL_HANDLES.append(os.add_dll_directory(str(directory)))
            prepend_paths.append(str(directory))

    if prepend_paths:
        os.environ["PATH"] = os.pathsep.join(prepend_paths + [existing_path])


def get_whisper_model_class():
    global WHISPER_MODEL_CLASS

    if WHISPER_MODEL_CLASS is None:
        configure_windows_cuda_dlls()
        from faster_whisper import WhisperModel
        WHISPER_MODEL_CLASS = WhisperModel

    return WHISPER_MODEL_CLASS


def build_model():
    model_size = os.getenv("WHISPER_MODEL_SIZE", "medium")
    preferred_device = os.getenv("WHISPER_DEVICE", "cuda")
    preferred_compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8_float16")
    WhisperModel = get_whisper_model_class()

    try:
        model = WhisperModel(
            model_size,
            device=preferred_device,
            compute_type=preferred_compute_type
        )
        return model, preferred_device
    except Exception as error:
        print(
            json.dumps({
                "warning": f"GPU transcription unavailable. Falling back to CPU. {error}"
            }),
            file=sys.stderr,
            flush=True
        )
        return WhisperModel(model_size, device="cpu", compute_type="int8"), "cpu"


def transcribe_audio(model, audio_path):
    language = os.getenv("WHISPER_LANGUAGE", "en")

    segments, _info = model.transcribe(
        audio_path,
        language=language,
        beam_size=3,
        best_of=3,
        temperature=0.0,
        vad_filter=True,
        compression_ratio_threshold=2.0,
        log_prob_threshold=-1.0,
        no_speech_threshold=0.5,
        condition_on_previous_text=False,
        initial_prompt=(
            "Medical patient intake. "
            "Transcribe the speech exactly once. "
            "Do not repeat words or phrases. "
            "Stop when the speaker stops. "
            "Possible details include name, age, gender, symptoms, allergies, conditions, and medications."
        ),
    )
    transcript_parts = []

    for segment in segments:
        text = segment.text.strip()
        if text:
            transcript_parts.append(text)

    return " ".join(transcript_parts).strip()


def get_model():
    global MODEL, MODEL_DEVICE

    if MODEL is None:
        MODEL, MODEL_DEVICE = build_model()

    return MODEL, MODEL_DEVICE


def reset_model_to_cpu():
    global MODEL, MODEL_DEVICE
    model_size = os.getenv("WHISPER_MODEL_SIZE", "medium")
    WhisperModel = get_whisper_model_class()
    MODEL = WhisperModel(model_size, device="cpu", compute_type="int8")
    MODEL_DEVICE = "cpu"
    return MODEL, MODEL_DEVICE


def safe_transcribe(audio_path):
    model, device = get_model()

    try:
        return transcribe_audio(model, audio_path), device
    except Exception:
        if device == "cuda":
            model, _device = reset_model_to_cpu()
            return transcribe_audio(model, audio_path), "cpu"
        raise


def run_stdio_server():
    print(json.dumps({"ready": True}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
          payload = json.loads(line)
          audio_path = payload.get("audio_path", "")
          if not audio_path:
              raise ValueError("Audio file path is required.")

          text, device = safe_transcribe(audio_path)
          print(json.dumps({"text": text, "device": device}), flush=True)
        except Exception as error:
          print(json.dumps({"error": str(error)}), flush=True)


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == "--stdio-server":
        run_stdio_server()
        return

    if len(sys.argv) < 2:
        print(json.dumps({"error": "Audio file path is required."}))
        sys.exit(1)

    audio_path = sys.argv[1]
    final_text, device = safe_transcribe(audio_path)

    print(json.dumps({"text": final_text, "device": device}))


if __name__ == "__main__":
    main()
