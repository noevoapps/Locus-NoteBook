"""
Local audio transcription using faster-whisper.
Accepts an audio file path as command-line argument.
Outputs JSON to stdout: {'text': '...'} or {'error': '...'}
"""
import sys
import json
import os

try:
    from faster_whisper import WhisperModel
except ImportError:
    print(json.dumps({'error': 'faster_whisper not installed. Run: pip install faster-whisper'}))
    sys.exit(1)

def _json_error(message: str):
    print(json.dumps({'error': message}))

def _looks_like_network_error(msg: str) -> bool:
    m = (msg or "").lower()
    return any(s in m for s in [
        "connection error",
        "ssl",
        "httpsconnectionpool",
        "name resolution",
        "temporary failure",
        "offline",
        "failed to connect",
        "max retries exceeded",
        "connection refused",
        "getaddrinfo failed",
        "couldn't connect",
        "could not connect",
        "unable to connect",
    ])


def main():
    if len(sys.argv) < 2:
        _json_error('No audio file path provided')
        sys.exit(1)

    audio_path = sys.argv[1]

    try:
        model_name_or_path = os.environ.get("LOCUS_WHISPER_MODEL", "base")
        # Cache directory is controlled by env (HF_HOME / HUGGINGFACE_HUB_CACHE) from the Electron main process.
        # This allows first-run download when online, and offline use afterwards.
        try:
            model = WhisperModel(model_name_or_path, device='cpu', compute_type='int8', download_root=os.environ.get("HF_HOME"))
        except TypeError:
            # Older faster-whisper versions may not support download_root.
            model = WhisperModel(model_name_or_path, device='cpu', compute_type='int8')
        segments, info = model.transcribe(audio_path)

        text_parts = []
        for segment in segments:
            text_parts.append(segment.text)

        full_text = ''.join(text_parts).strip()
        print(json.dumps({'text': full_text}))

    except Exception as e:
        msg = str(e)
        if _looks_like_network_error(msg):
            msg = (
                "Transcription model download failed (network). Connect to the internet once so the Whisper model can download, "
                "then it will work offline afterwards."
            )
        _json_error(msg)
        sys.exit(1)


if __name__ == '__main__':
    main()
