import { GoogleGenAI } from "@google/genai";
import fs from 'fs';

// Read .env.local manually
let apiKey = null;
try {
    const envContent = fs.readFileSync('.env.local', 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && key.trim() === 'GEMINI_API_KEY' && value) {
            apiKey = value.trim();
        }
    });
} catch (e) {
    console.error("❌ Could not read .env.local:", e.message);
}

if (!apiKey) {
    console.error("❌ No GEMINI_API_KEY found in .env.local");
    process.exit(1);
}

console.log("✅ Found API Key:", apiKey.substring(0, 10) + "...\n");

async function listModels() {
    try {
        const ai = new GoogleGenAI({ apiKey });

        console.log("🔍 Querying available models...\n");

        const response = await ai.models.list();

        if (response && response.models && response.models.length > 0) {
            console.log("✅ Available Models:\n");
            response.models.forEach(m => {
                console.log(`📌 ${m.name}`);
                if (m.displayName) console.log(`   Display: ${m.displayName}`);
                if (m.supportedGenerationMethods) {
                    console.log(`   Methods: ${m.supportedGenerationMethods.join(', ')}`);
                }
                console.log('');
            });
        } else {
            console.log("⚠️  No models returned or unexpected response format:");
            console.log(JSON.stringify(response, null, 2));
        }

    } catch (error) {
        console.error("\n❌ Error:", error.message);
        console.error("\nFull error:", error);
    }
}

listModels();
