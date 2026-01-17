import { GoogleGenAI, FunctionDeclaration, Type, Tool, Chat, Part } from "@google/genai";
import { UNYRA_SYSTEM_INSTRUCTION } from "../constants";
import { UnyraTaskResponse, SubAccount, Attachment } from "../types";
import { unyraService } from "./unyraService";

// --- Tool Definitions ---

const createUnyraTaskTool: FunctionDeclaration = {
  name: "create_unyra_task",
  description: "Create an internal support task in Unyra via API and return unyra_task_id.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      unyra_api_base: { type: Type.STRING },
      auth: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["bearer"] },
          token: { type: Type.STRING, description: "Provided by app config; never ask user." }
        },
        required: ["type", "token"]
      },
      task: {
        type: Type.OBJECT,
        properties: {
          locationId: { type: Type.STRING, nullable: true },
          assignedTo: { type: Type.STRING, description: "Support agent/user ID; if unknown, null.", nullable: true },
          dueDate: { type: Type.STRING, description: "ISO 8601", nullable: true },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },

          title: { type: Type.STRING },
          description: { type: Type.STRING },

          severity: { type: Type.STRING, enum: ["S1", "S2", "S3", "S4"] },
          area: { type: Type.STRING },
          priority_score: { type: Type.INTEGER },
          sheet_ticket_id: { type: Type.STRING, description: "Optional reference ID if available.", nullable: true },
          requester_email: { type: Type.STRING },
          attachments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                url: { type: Type.STRING }
              },
              required: ["type", "url"]
            }
          },

          metadata: {
            type: Type.OBJECT,
            properties: {
              location_name: { type: Type.STRING },
              expected_result: { type: Type.STRING },
              actual_result: { type: Type.STRING },
              error_text: { type: Type.STRING, nullable: true }
            }
          }
        },
        required: ["tags", "title", "description", "severity", "area", "priority_score", "requester_email"]
      }
    },
    required: ["unyra_api_base", "auth", "task"]
  }
};

const supportTools: Tool = {
  functionDeclarations: [createUnyraTaskTool]
};

// --- Mock Implementations (Client Side Simulation) ---

const mockCreateUnyraTask = async (args: any): Promise<UnyraTaskResponse> => {
  console.log("MOCK API: Creating Unyra task...", args);
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate latency
  return {
    ok: true,
    unyra_task_id: `TASK-${Math.floor(Math.random() * 10000)}`,
    task_url: `https://unyra.net/tasks/TASK-${Math.floor(Math.random() * 10000)}`
  };
};

// --- Service Class ---

export class UnyraSupportService {
  private ai: GoogleGenAI;
  private chat: Chat | null = null;

  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    if (!apiKey) {
      console.warn("⚠️ NO API KEY FOUND: VITE_GEMINI_API_KEY is missing. App will run in Mock Mode or fail.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async startChat(subAccount: SubAccount) {
    try {
      const accountContext = `
──────────────────────────────────────────────────────────────────────────────
CONTEXTO DE LA SUBCUENTA ACTIVA (AUTO-INJECTADO)
El usuario actual está gestionando la siguiente cuenta. Úsala para pre-rellenar datos de tickets (location_id, location_name, requester_email) y para dar contexto.

ID Cuenta: ${subAccount.id}
Nombre: ${subAccount.name}
Email Admin: ${subAccount.email}
Plan Actual: ${subAccount.plan}
Estado: ${subAccount.status}
──────────────────────────────────────────────────────────────────────────────
`;

      this.chat = this.ai.chats.create({
        model: "gemini-2.0-flash-exp",
        config: {
          systemInstruction: UNYRA_SYSTEM_INSTRUCTION + accountContext,
          tools: [supportTools],
          temperature: 0.4,
        }
      });
    } catch (e) {
      console.warn("Failed to initialize real Gemini chat, falling back to mock mode if needed.", e);
      this.chat = null; // Mark as null to trigger fallback in sendMessage
    }
  }

  async sendMessage(
    message: string,
    attachments: Attachment[] = [],
    onToolExecution?: (toolName: string) => void
  ): Promise<string> {

    // --- MOCK FALLBACK MODE (For testing without API Key) ---
    if (!this.chat || message.toLowerCase().includes('mock_error')) {
      console.warn("Using Mock AI Fallback due to missing/invalid API Key or init failure.");
      await new Promise(resolve => setTimeout(resolve, 1000));

      const lowerMsg = message.toLowerCase();

      // Simple heuristic conversation for testing ticket flow
      if (lowerMsg.includes('ticket') && lowerMsg.includes('crea')) {

        if (onToolExecution) onToolExecution('create_unyra_task');
        await new Promise(resolve => setTimeout(resolve, 1000));
        const taskRes = await mockCreateUnyraTask({
          locationId: 'loc_123', tags: ['support'], title: 'Test Task', description: 'Mock', severity: 'S3', area: 'Calendar', priority_score: 50, sheet_ticket_id: 'MOCK-SHEET', requester_email: 'test@example.com'
        });

        return `Entendido. He procedido a crear el ticket de soporte como solicitaste.
             
\`\`\`json
{
  "ticket_created": true,
  "unyra_task": { "unyra_task_id": "${taskRes.unyra_task_id}", "task_url": "${taskRes.task_url}" },
  "status": "new"
}
\`\`\`
             `;
      }

      if (lowerMsg.includes('hola') || lowerMsg.includes('problema')) {
        return "Hola. Veo que tienes un problema. (Modo Mock: La API Key no es válida, pero puedo simular la creación de tickets). Si me pides 'crea un ticket', generaré uno de prueba.";
      }

      return "Estoy en modo de prueba (Mock) porque no se detectó una API Key válida. Pídeme 'crea un ticket' para probar esa funcionalidad.";
    }
    // ----------------------------------------------------

    // Construct Parts
    const parts: (string | Part)[] = [];

    // Add attachments first (images/video/audio)
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

    // Add text message
    if (message) {
      parts.push({ text: message });
    }

    try {
      // 1. Send user message with parts
      let result = await this.chat.sendMessage({ message: parts });

      // 2. Check for function calls loop
      while (result.functionCalls && result.functionCalls.length > 0) {
        const toolCalls = result.functionCalls;
        const functionResponseParts = [];

        for (const call of toolCalls) {
          const { name, args, id } = call;

          if (onToolExecution) onToolExecution(name);

          let responseContent = {};

          try {
            if (name === 'create_unyra_task') {
              console.log("🛠️ Tool Exec: create_unyra_task", args);
              responseContent = await unyraService.createTask(args.task as any);
            } else {
              responseContent = { error: `Unknown tool ${name}` };
            }
          } catch (e: any) {
            responseContent = { error: e.message || "Tool execution failed" };
          }

          functionResponseParts.push({
            functionResponse: {
              name,
              id,
              response: responseContent
            }
          });
        }

        // 3. Send tool results back to the model
        result = await this.chat.sendMessage({
          message: functionResponseParts
        });
      }

      // 4. Return final text
      return result.text || "No response generated.";

    } catch (error: any) {
      console.error("Gemini API Error:", error);

      // Auto-fallback if it's an API Key error
      if (error.message?.includes('API key') || error.toString().includes('400')) {
        console.warn("Triggering Fallback due to API Error");
        this.chat = null; // Force mock next time or retry immediately?
        // Recursive retry in mock mode for this message
        return this.sendMessage(message, attachments, onToolExecution);
      }

      return "Lo siento, hubo un error de conexión con la IA. (Verifica tu API Key).";
    }
  }
}

export const geminiService = new UnyraSupportService();