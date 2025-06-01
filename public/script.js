// script.js - Frontend logic for ConfigSwitch

document.addEventListener('DOMContentLoaded', () => {
    const inputTextArea = document.getElementById('inputText');
    const outputTextArea = document.getElementById('outputText');
    const inputFormatSelect = document.getElementById('inputFormat');
    const outputFormatSelect = document.getElementById('outputFormat');
    const convertBtn = document.getElementById('convertBtn');
    const messageArea = document.getElementById('message');
    const beautifyBtn = document.getElementById('beautifyBtn');

    const copyBtn = document.getElementById('copy-btn');
    const clearBtn = document.getElementById('clear-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const downloadBtn = document.getElementById('download-btn');
    const fileInput = document.getElementById('file-input');

    // Helper to show messages
    // Helper to show messages
    function showMessage(msg, type = 'error') {
        messageArea.textContent = msg;
        messageArea.className = 'message ' + type;
    }

    // Clear message
    function clearMessage() {
        messageArea.textContent = '';
        messageArea.className = 'message';
    }

    // Function to detect format
    function detectFormat(text) {
        text = text.trim();
        if (!text) return null;

        // Try JSON
        try {
            JSON.parse(text);
            return 'JSON';
        } catch (e) { /* not JSON */ }

        // Try XML (basic detection)
        if (text.startsWith('<') && text.endsWith('>')) {
            // More robust XML check could involve DOMParser, but this is a quick check
            if (text.includes('<') && text.includes('</')) {
                return 'XML';
            }
        }

        // Try YAML (basic detection)
        // YAML often starts with --- or a key-value pair, and uses indentation
        // This is a very basic check, a full YAML parser would be more accurate
        if (text.includes(':') && !text.includes('<') && !text.includes('{') && !text.includes('[') && !text.includes('=')) {
            try {
                // Use js-yaml to validate if it's valid YAML
                window.jsyaml.load(text);
                return 'YAML';
            } catch (e) { /* not YAML */ }
        }

        // Plain Text (fallback)
        return 'Plain Text';
    }

    // Handle Convert button click
    convertBtn.addEventListener('click', async () => {
        clearMessage();
        outputTextArea.value = '';

        const input = inputTextArea.value.trim();
        if (!input) {
            showMessage('Please enter some input to convert.', 'error');
            return;
        }

        // Prepare request payload
        const payload = {
            inputText: input,
            inputFormat: inputFormatSelect.value,
            outputFormat: outputFormatSelect.value
        };

        try {
            const response = await fetch('/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                outputTextArea.value = result.data;
                showMessage('Conversion successful!', 'success');
            } else {
                outputTextArea.value = '';
                showMessage(result.error || 'Conversion failed.', 'error');
            }
        } catch (err) {
            outputTextArea.value = '';
            showMessage('Network or server error. Please try again.', 'error');
        }
    });

    // Beautify input logic
    async function beautifyInput() {
        clearMessage();
        const input = inputTextArea.value.trim();
        if (!input) {
            showMessage('Nothing to beautify.', 'error');
            return;
        }
        const format = inputFormatSelect.value;
        try {
            let beautified;
            if (format === 'JSON') {
                beautified = JSON.stringify(JSON.parse(input), null, 2);
            } else if (format === 'YAML') {
                // js-yaml is loaded globally as window.jsyaml
                const parsed = window.jsyaml.load(input);
                beautified = window.jsyaml.dump(parsed, { indent: 2, lineWidth: 120 });
            } else {
                // For XML, TOML, ENV, send to backend for beautification
                const payload = {
                    inputText: input,
                    inputFormat: format,
                    outputFormat: format // Beautify by converting to the same format
                };

                const response = await fetch('/convert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (result.success) {
                    beautified = result.data;
                } else {
                    showMessage(result.error || `Beautification failed for ${format}.`, 'error');
                    return;
                }
            }
            inputTextArea.value = beautified;
            showMessage('Input beautified!', 'success');
        } catch (e) {
            showMessage('Invalid ' + format + ' syntax. Cannot beautify.', 'error');
        }
    }

    beautifyBtn.addEventListener('click', beautifyInput);

    // Implement "Copy to Clipboard"
    copyBtn.addEventListener('click', () => {
        const outputText = outputTextArea.value;
        if (navigator.clipboard && outputText) {
            navigator.clipboard.writeText(outputText)
                .then(() => {
                    // Optional: Show a temporary success message
                    messageArea.textContent = 'Copied to clipboard!';
                    messageArea.style.color = 'green';
                    setTimeout(() => messageArea.textContent = '', 2000);
                })
                .catch(err => {
                    console.error('Failed to copy: ', err);
                });
        }
    });

    // Implement "Clear"
    clearBtn.addEventListener('click', () => {
        inputTextArea.value = '';
        outputTextArea.value = '';
        messageArea.textContent = '';
    });

    // Implement File Upload
    uploadBtn.addEventListener('click', () => {
        fileInput.click(); // Trigger the hidden file input
    });

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            inputTextArea.value = e.target.result;
            // Trigger format detection after file content is loaded
            const detected = detectFormat(inputTextArea.value);
            if (detected) {
                inputFormatSelect.value = detected;
            }
        };
        reader.readAsText(file);
    });

    // Automatic format detection on input
    inputTextArea.addEventListener('input', () => {
        const detected = detectFormat(inputTextArea.value);
        if (detected) {
            inputFormatSelect.value = detected;
        }
    });

    // Implement File Download
    downloadBtn.addEventListener('click', () => {
        const outputText = outputTextArea.value;
        const outputFormat = outputFormatSelect.value.toLowerCase();
        const mimeTypes = {
            json: 'application/json',
            yaml: 'application/x-yaml',
            xml: 'application/xml',
            toml: 'application/toml',
            env: 'text/plain'
        };

        if (!outputText) return;

        const blob = new Blob([outputText], { type: mimeTypes[outputFormat] || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `converted.${outputFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Keyboard shortcut: Ctrl+Enter or Cmd+Enter triggers conversion
    // Keyboard shortcut: Ctrl+B or Cmd+B triggers beautify
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            convertBtn.click();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
            e.preventDefault();
            beautifyInput();
        }
    });
});