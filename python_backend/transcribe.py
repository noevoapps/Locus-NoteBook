"""
Local audio transcription using faster-whisper.
Accepts an audio file path as command-line argument.
Outputs JSON to stdout: {'text': '...'} or {'error': '...'}
"""
import sys
import json

try:
    from faster_whisper import WhisperModel
except ImportError:
    print(json.dumps({'error': 'faster_whisper not installed. Run: pip install faster-whisper'}))
    sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No audio file path provided'}))
        sys.exit(1)

    audio_path = sys.argv[1]

    try:
        model = WhisperModel('base', device='cpu', compute_type='int8')
        segments, info = model.transcribe(audio_path)

        text_parts = []
        for segment in segments:
            text_parts.append(segment.text)

        full_text = ''.join(text_parts).strip()
        print(json.dumps({'text': full_text}))

    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
