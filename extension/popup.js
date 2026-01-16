// Get DOM elements
const promptInput = document.getElementById('prompt-input');
const formatSelect = document.getElementById('format-select');
const rewriteBtn = document.getElementById('rewrite-btn');
const getSelectedBtn = document.getElementById('get-selected-btn');
const resultSection = document.getElementById('result-section');
const resultContent = document.getElementById('result-content');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const copyBtn = document.getElementById('copy-btn');
const replaceBtn = document.getElementById('replace-btn');
const useBtn = document.getElementById('use-btn');
const serverUrlInput = document.getElementById('server-url');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const userIconBtn = document.getElementById('user-icon-btn');

let rewrittenPrompt = '';
let originalPrompt = '';

// Load saved settings
chrome.storage.sync.get(['serverUrl'], (result) => {
  if (result.serverUrl) {
    serverUrlInput.value = result.serverUrl;
  }
});

// Get selected text from active tab
getSelectedBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        return window.getSelection().toString();
      }
    }, (results) => {
      if (results && results[0] && results[0].result) {
        const selectedText = results[0].result;
        if (selectedText.trim()) {
          promptInput.value = selectedText;
        } else {
          showError('No text selected. Please select some text on the page first.');
        }
      }
    });
  } catch (error) {
    showError('Failed to get selected text: ' + error.message);
  }
});

// Rewrite prompt
rewriteBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  
  if (!prompt) {
    showError('Please enter a prompt to rewrite.');
    return;
  }

  originalPrompt = prompt;
  const format = formatSelect.value;
  const serverUrl = serverUrlInput.value || 'http://localhost:3000';

  // Show loading state
  rewriteBtn.disabled = true;
  rewriteBtn.querySelector('.btn-text').style.display = 'none';
  rewriteBtn.querySelector('.btn-loader').style.display = 'inline';
  hideError();
  resultSection.style.display = 'none';

  try {
    const response = await fetch(`${serverUrl}/api/rewrite-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, format }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    rewrittenPrompt = data.rewrittenPrompt;
    
    // Display result
    resultContent.textContent = rewrittenPrompt;
    resultSection.style.display = 'block';
    
  } catch (error) {
    showError(`Failed to rewrite prompt: ${error.message}. Make sure the server is running at ${serverUrl}`);
  } finally {
    // Reset button state
    rewriteBtn.disabled = false;
    rewriteBtn.querySelector('.btn-text').style.display = 'inline';
    rewriteBtn.querySelector('.btn-loader').style.display = 'none';
  }
});

// Copy rewritten prompt
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(rewrittenPrompt).then(() => {
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => {
      copyBtn.textContent = '📋 Copy';
    }, 2000);
  });
});

// Replace prompt on page
replaceBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send message to content script to replace the prompt
    chrome.tabs.sendMessage(tab.id, {
      action: 'replacePrompt',
      originalPrompt: originalPrompt,
      rewrittenPrompt: rewrittenPrompt
    }, (response) => {
      if (chrome.runtime.lastError) {
        showError('Failed to replace prompt on page. Make sure the page is loaded.');
      } else if (response && response.success) {
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.textContent = '✓ Prompt replaced on page!';
        successMsg.style.cssText = 'color: #10b981; margin-top: 10px; font-weight: 600;';
        resultSection.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
      } else {
        showError('Could not find the prompt on the page to replace.');
      }
    });
  } catch (error) {
    showError('Failed to replace prompt: ' + error.message);
  }
});

// Use this prompt (replace in input)
useBtn.addEventListener('click', () => {
  promptInput.value = rewrittenPrompt;
  resultSection.style.display = 'none';
});

// Save settings
saveSettingsBtn.addEventListener('click', () => {
  const serverUrl = serverUrlInput.value.trim();
  if (serverUrl) {
    chrome.storage.sync.set({ serverUrl }, () => {
      saveSettingsBtn.textContent = '✓ Saved!';
      setTimeout(() => {
        saveSettingsBtn.textContent = 'Save Settings';
      }, 2000);
    });
  }
});

// User icon click - redirect to dashboard
userIconBtn.addEventListener('click', async () => {
  try {
    // Get dashboard URL from config
    chrome.storage.sync.get(['loginUrl'], (result) => {
      const loginUrl = result.loginUrl || 'http://localhost:5173';
      const dashboardUrl = `${loginUrl.replace(/\/+$/, '')}/dashboard`;
      
      // Open dashboard in a new tab
      chrome.tabs.create({ url: dashboardUrl });
    });
  } catch (error) {
    showError('Failed to open dashboard: ' + error.message);
  }
});

// Helper functions
function showError(message) {
  errorMessage.textContent = message;
  errorSection.style.display = 'block';
}

function hideError() {
  errorSection.style.display = 'none';
}
