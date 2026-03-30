# TETR-REDACT × pretext

A stylized, editorial-style Tetris implementation where blocks act as redaction bars over a scrolling document. Powered by the `@chenglou/pretext` library for dynamic text flow around game pieces.

## Features

- **Redaction Aesthetic**: Pure white canvas with flat black blocks and thick white dividing lines for a document-redaction feel.
- **Dynamic Text Flow**: Integration with `@chenglou/pretext` allowing text to flow seamlessly around falling pieces and fixed board blocks.
- **Advanced Handling System**: Pro-level input logic mimicking competitive Tetris platforms (TETR.IO style).
  - **DAS (Delayed Auto Shift)**: Configurable delay before continuous movement starts.
  - **ARR (Auto Repeat Rate)**: Configurable speed of continuous movement (supports instant teleport to wall).
  - **DCD (DAS Cut Delay)**: Prevents accidental piece slips after rotations or spawns.
  - **SDF (Soft Drop Factor)**: Adjustable falling speed multiplier when holding the down key.
- **Customizable Document Text**: Use the side panel to input your own text, which will be redacted during the game.
- **Vintage Editorial Palette**: A unique, copyright-safe color palette for the next queue and hold pieces.

## Project Structure

```text
Tetris/
├── app.py              # Flask backend server
├── templates/
│   └── index.html      # Main application frontend
├── static/
│   ├── css/
│   │   └── style.css   # Modern, editorial styling
│   ├── js/
│   │   └── index.js    # Core game logic and pretext integration
│   └── icon/
│       └── tetrr.png   # Application icon
└── README.md           # Project documentation
```

## Setup and Running

### Prerequisites
- Python 3.x
- Flask

### Installation
1. Install Flask:
   ```bash
   pip install flask
   ```

### Running Locally
1. Start the Flask server:
   ```bash
   python app.py
   ```
2. Open your browser and navigate to `http://127.0.0.1:5000`

## Controls

| Key | Action |
| --- | --- |
| **← / →** | Move Left / Right |
| **↓** | Soft Drop (Faster Fall) |
| **V** | Hard Drop (Instant Place) |
| **↑** | Rotate Clockwise |
| **C** | Rotate Counter-Clockwise |
| **X** | Rotate 180° |
| **Z** | Hold Piece |
| **A** | Retry (Game Over) |
| **ESC** | Pause / Quit |

## Settings
Access individual handling settings and the custom transcription panel via the **Burger Menu** on the top left or the **Custom Text** panel on the right.
