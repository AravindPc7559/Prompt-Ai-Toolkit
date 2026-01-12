# Quick Start Guide

## 1. Install Server Dependencies

```bash
cd server
npm install
```

## 2. Configure OpenAI API Key

Create a `.env` file in the `server` directory:

```bash
cd server
cp env.example .env
```

Then edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

## 3. Start the Server

```bash
cd server
npm start
```

You should see:
```
🚀 Prompt Rewriter Server running on http://localhost:3000
```

## 4. Load the Extension

1. Open Chrome or Edge
2. Go to `chrome://extensions/` (or `edge://extensions/`)
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `extension` folder from this project

## 5. Use the Extension

### Quick Method (Floating Popup):
1. **Select any text** (at least 10 characters) on any webpage
2. A **floating popup** will appear above the selected text
3. Click **"✨ Rewrite Prompt"** button
4. The text will be automatically rewritten and replaced!

### Alternative Method (Extension Popup):
1. Click the extension icon in your browser toolbar
2. Type or paste a prompt, or click "📋 Get Selected Text" to grab text from the page
3. Select your desired format (RTF, Markdown, HTML, or Default)
4. Click **Rewrite Prompt**
5. Review the rewritten prompt and:
   - **📋 Copy** to clipboard
   - **✅ Replace on Page** to replace it on the current webpage
   - **Use This Prompt** to use it in the input field

## Troubleshooting

- **Can't connect to server**: Make sure the server is running on `http://localhost:3000`
- **API errors**: Check your OpenAI API key in `server/.env`
- **Extension not loading**: Make sure you selected the `extension` folder (not the root folder)

## Icons

Icons are automatically generated. To regenerate them:
```bash
cd extension
node create-icons-simple.js
```
