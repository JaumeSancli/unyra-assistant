import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Missing Gemini API Key' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { action, subaccount, message, attachments, history } = req.body;

    try {
        const ai = new GoogleGenAI({ apiKey });

        if (action === 'init') {
            // Initialize chat with system instructions
            const SYSTEM_INSTRUCTION = `Eres un asistente de soporte técnico profesional...`; // Will need to import from constants

            const accountContext = `
──────────────────────────────────────────────────────────────────────────────
CONTEXTO DE LA SUBCUENTA ACTIVA (AUTO-INJECTADO)
El usuario actual está gestionando la siguiente cuenta. Úsala para pre-rellenar datos de tickets (location_id, location_name, requester_email) y para dar contexto.

ID Cuenta: ${subaccount.id}
Nombre: ${subaccount.name}
Email Admin: ${subaccount.email}
Plan Actual: ${subaccount.plan}
Estado: ${subaccount.status}
──────────────────────────────────────────────────────────────────────────────
`;

            // Return success with context info
            return res.status(200).json({
                success: true,
                message: 'Chat initialized',
                context: accountContext
            });
        }

        if (action === 'message') {
            // Define the tool for creating tasks
            const createUnyraTaskTool = {
                name: "create_unyra_task",
                description: "Create an internal support task in Unyra via API and return unyra_task_id.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        task: {
                            type: "OBJECT",
                            properties: {
                                title: { type: "STRING" },
                                description: { type: "STRING" },
                                severity: { type: "STRING", enum: ["S1", "S2", "S3", "S4"] },
                                area: { type: "STRING" },
                                priority_score: { type: "INTEGER" },
                                requester_email: { type: "STRING" },
                                locationId: { type: "STRING" },
                                metadata: { type: "OBJECT" }
                            },
                            required: ["title", "description", "severity", "area", "priority_score", "requester_email"]
                        }
                    },
                    required: ["task"]
                }
            };

            // Create chat with system instruction
            const chat = ai.chats.create({
                model: "gemini-2.0-flash-exp",
                config: {
                    systemInstruction: history[0]?.systemInstruction || "You are a helpful assistant",
                    tools: [{ functionDeclarations: [createUnyraTaskTool] }],
                    temperature: 0.4
                }
            });

            // Build message parts (text + attachments)
            const parts = [];
            if (attachments && attachments.length > 0) {
                for (const att of attachments) {
                    if (att.base64Data) {
                        parts.push({
                            inlineData: {
                                mimeType: att.mimeType,
                                data: att.base64Data
                            }
                        });
                    }
                }
            }
            parts.push({ text: message });

            // Send message
            let result = await chat.sendMessage({ message: parts });

            // Handle function calls
            while (result.functionCalls && result.functionCalls.length > 0) {
                const functionResponseParts = [];

                for (const call of result.functionCalls) {
                    const { name, args, id } = call;
                    let responseContent = {};

                    if (name === 'create_unyra_task') {
                        // Call our secure backend endpoint
                        try {
                            const taskData = args.task;
                            const locationId = process.env.VITE_GHL_LOCATION_ID;

                            // 1. Ensure contact exists
                            const contactRes = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/contact`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    locationId,
                                    email: taskData.requester_email,
                                    name: taskData.metadata?.location_name || 'Support User'
                                })
                            });
                            const contactData = await contactRes.json();

                            if (!contactRes.ok) {
                                throw new Error(contactData.error || 'Contact creation failed');
                            }

                            // 2. Create task
                            const taskRes = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/create-task`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    locationId,
                                    contactId: contactData.id,
                                    title: taskData.title,
                                    body: taskData.description,
                                    dueDate: taskData.dueDate || new Date(Date.now() + 86400000).toISOString(),
                                    status: 'incomplete'
                                })
                            });

                            const taskResult = await taskRes.json();

                            if (taskRes.ok) {
                                responseContent = {
                                    ok: true,
                                    unyra_task_id: taskResult.task?.id || taskResult.id,
                                    task_url: `https://app.gohighlevel.com/v2/location/${locationId}/tasks`
                                };
                            } else {
                                responseContent = { ok: false, error: taskResult.error || 'Task creation failed' };
                            }
                        } catch (e) {
                            responseContent = { ok: false, error: e.message };
                        }
                    } else {
                        responseContent = { error: `Unknown tool ${name}` };
                    }

                    functionResponseParts.push({
                        functionResponse: {
                            name,
                            id,
                            response: responseContent
                        }
                    });
                }

                // Send function results back
                result = await chat.sendMessage({ message: functionResponseParts });
            }

            return res.status(200).json({
                success: true,
                response: result.text || 'No response generated'
            });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
        console.error('Gemini API Error:', error);
        return res.status(500).json({
            error: 'AI Processing Error',
            details: error.message
        });
    }
}
