# Prompt Rewriter Extension

A browser extension that uses GPT to rewrite and improve prompts in a proper format (RTF, Markdown, HTML, etc.). The extension communicates with a Node.js backend server that handles the GPT API calls.

## Features

- ✨ Rewrite prompts using GPT
- 📝 Multiple output formats (RTF, Markdown, HTML, Default)
- 🔄 Replace prompts directly on web pages
- 📋 Copy rewritten prompts to clipboard
- 🎯 Get selected text from pages
- ⚙️ Configurable server URL

## Project Structure

```
extension/
├── server/              # Node.js backend
│   ├── server.js        # Express server with GPT integration
│   ├── package.json     # Server dependencies
│   └── .env.example     # Environment variables template
├── extension/           # Browser extension
│   ├── manifest.json    # Extension manifest
│   ├── popup.html       # Extension popup UI
│   ├── popup.css        # Popup styles
│   ├── popup.js         # Popup logic
│   ├── content.js       # Content script for page interaction
│   ├── background.js    # Background service worker
│   └── icons/           # Extension icons (create these)
└── README.md           # This file
```

## Setup Instructions

### 1. Backend Server Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from the example:
   ```bash
   cp env.example .env
   ```
   
   Or run the setup script:
   ```bash
   ./setup.sh
   ```

4. Add your OpenAI API key to `.env`:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

5. Start the server:
   ```bash
   npm start
   ```

   The server will run on `http://localhost:3000` by default.

### 2. Browser Extension Setup

1. **Generate Extension Icons** (already done, but you can regenerate):
   - Icons are already created in the `extension/icons/` directory
   - To regenerate: `cd extension && node create-icons-simple.js`

2. **Load the Extension in Chrome/Edge**:
   - Open Chrome or Edge browser
   - Go to `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `extension` folder

3. **Configure Server URL** (if needed):
   - Click the extension icon
   - If your server runs on a different URL/port, update it in the settings
   - Click "Save Settings"

## Usage

1. **Start the Node.js server** (if not already running):
   ```bash
   cd server
   npm start
   ```

2. **Use the Extension**:
   
   **Method 1: Floating Popup (Recommended)**
   - Select any text (at least 10 characters) on any webpage
   - A floating popup will appear above the selected text
   - Click "✨ Rewrite Prompt" button
   - The selected text will be automatically replaced with the rewritten version
   
   **Method 2: Extension Popup**
   - Click the extension icon in your browser
   - Type or paste a prompt in the text area, or click "📋 Get Selected Text"
   - Choose your desired output format (RTF, Markdown, HTML, or Default)
   - Click "Rewrite Prompt"
   - Review the rewritten prompt and use one of these actions:
     - **📋 Copy**: Copy to clipboard
     - **✅ Replace on Page**: Replace the original prompt on the current webpage
     - **Use This Prompt**: Replace the text in the input field

## API Endpoints

### POST `/api/rewrite-prompt`

Rewrites a prompt using GPT.

**Request Body:**
```json
{
  "prompt": "Your prompt text here",
  "format": "rtf"  // Optional: "rtf", "markdown", "html", or "default"
}
```

**Response:**
```json
{
  "success": true,
  "originalPrompt": "Your prompt text here",
  "rewrittenPrompt": "Rewritten and improved prompt...",
  "format": "rtf"
}
```

### GET `/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "message": "Prompt Rewriter Server is running"
}
```

## Environment Variables

- `OPENAI_API_KEY` (required): Your OpenAI API key
- `OPENAI_MODEL` (optional): Model to use (default: `gpt-4o-mini`)
- `PORT` (optional): Server port (default: `3000`)

## Troubleshooting

1. **Extension can't connect to server**:
   - Make sure the Node.js server is running
   - Check that the server URL in extension settings matches your server
   - Verify CORS is enabled (it should be by default)

2. **OpenAI API errors**:
   - Verify your API key is correct in the `.env` file
   - Check that you have sufficient API credits
   - Ensure the API key has proper permissions

3. **Prompt replacement not working**:
   - Some websites may have complex input handling
   - Try manually copying and pasting the rewritten prompt
   - The extension tries multiple strategies to find and replace prompts

## Development

### Server Development
```bash
cd server
npm run dev  # Uses node --watch for auto-reload
```

### Extension Development
- Make changes to extension files
- Go to `chrome://extensions/`
- Click the refresh icon on the extension card to reload

## License

MIT
