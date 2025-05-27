// server.js
// ConfigSwitch - JSON/YAML Converter & Validator backend

const express = require('express');
const yaml = require('js-yaml');
const xml2js = require('xml2js');
const toml = require('toml');
const tomlStringify = require('@iarna/toml');
const dotenv = require('dotenv');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());
// Middleware to parse urlencoded bodies (for form submissions, if needed)
app.use(express.urlencoded({ extended: true }));

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Recursively flattens a nested object into a single-level object
 * with concatenated keys using a specified separator.
 * @param {object} obj The object to flatten.
 * @param {string} [prefix=''] The prefix for the current level of keys.
 * @param {string} [separator='_'] The separator to use for concatenating keys.
 * @returns {object} The flattened object.
 */
function flattenObject(obj, prefix = '', separator = '_') {
    const flattened = {};

    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

        const newKey = prefix ? `${prefix}${separator}${key}` : key;
        const value = obj[key];

        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                // Serialize arrays to JSON string to preserve content
                flattened[newKey] = JSON.stringify(value);
            } else {
                // Recursively flatten nested objects
                Object.assign(flattened, flattenObject(value, newKey, separator));
            }
        } else {
            // Directly assign primitive values
            flattened[newKey] = value;
        }
    }
    return flattened;
}

/**
 * Recursively sanitizes object keys to be valid XML element names.
 * Invalid characters are replaced with underscores. Keys starting with a number
 * are prefixed with an underscore.
 * @param {object} obj The object to sanitize.
 * @returns {object} The object with sanitized keys.
 */
function sanitizeXmlKeys(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeXmlKeys(item));
    }

    const newObj = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            let sanitizedKey = key.replace(/[^a-zA-Z0-9_.-]/g, '_'); // Replace invalid chars with underscore
            if (/^\d/.test(sanitizedKey)) { // If starts with a number, prefix with underscore
                sanitizedKey = '_' + sanitizedKey;
            }
            newObj[sanitizedKey] = sanitizeXmlKeys(obj[key]);
        }
    }
    return newObj;
}

// POST /convert endpoint
app.post('/convert', async (req, res) => {
    const { inputText, inputFormat, outputFormat } = req.body;

    /**
     * Attempts to parse a string as JSON. If successful, returns the parsed object.
     * Otherwise, returns the original string.
     * @param {string} value The string to parse.
     * @returns {any} The parsed JSON object or the original string.
     */
    function tryParseJson(value) {
        if (typeof value !== 'string') {
            return value;
        }
        try {
            const parsed = JSON.parse(value);
            // Ensure it's an object or array, not just a primitive string that was valid JSON
            if (typeof parsed === 'object' && parsed !== null) {
                return parsed;
            }
        } catch (e) {
            // Not a valid JSON string, return original value
        }
        return value;
    }

    // --- STRATEGY PATTERN FOR PARSERS ---
    const parsers = {
        'JSON': (text) => JSON.parse(text),
        'YAML': (text) => yaml.load(text),
        'XML': async (text) => {
            const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true, charkey: 'text' });
            return await parser.parseStringPromise(text);
        },
        'TOML': (text) => toml.parse(text),
        'ENV': (text) => {
            const parsedEnv = dotenv.parse(text);
            // Post-process parsed .env values to correctly interpret JSON strings
            const processedEnv = {};
            for (const key in parsedEnv) {
                if (Object.prototype.hasOwnProperty.call(parsedEnv, key)) {
                    processedEnv[key] = tryParseJson(parsedEnv[key]);
                }
            }
            return processedEnv;
        }
    };

    // --- STRATEGY PATTERN FOR STRINGIFIERS ---
    const stringifiers = {
        'JSON': (data) => JSON.stringify(data, null, 2),
        'YAML': (data) => yaml.dump(data),
        'XML': (data) => {
            const builder = new xml2js.Builder();
            const sanitizedData = sanitizeXmlKeys(data);
            return builder.buildObject(sanitizedData);
        },
        'TOML': (data) => tomlStringify.stringify(data),
        'ENV': (data) => {
            const flattenedData = flattenObject(data);
            return Object.entries(flattenedData)
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');
        }
    };

    try {
        if (!parsers[inputFormat] || !stringifiers[outputFormat]) {
            return res.status(400).json({ success: false, error: 'Unsupported format selected.' });
        }

        // --- EXECUTION LOGIC ---
        // Step 1: Parse the input text into a JavaScript object
        const parsedData = await parsers[inputFormat](inputText);

        // Step 2: Stringify the JavaScript object into the output format
        const outputText = stringifiers[outputFormat](parsedData);

        // Monetization Hook Placeholder
        // TODO: Implement rate limiting or feature checking here in the future.

        res.json({ success: true, data: outputText });

    } catch (error) {
        console.error(error);
        res.status(400).json({ success: false, error: `Invalid ${inputFormat} syntax or conversion failed: ${error.message}` });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`ConfigSwitch server running at http://localhost:${PORT}`);
});