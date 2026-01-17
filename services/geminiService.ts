import { UNYRA_SYSTEM_INSTRUCTION } from "../constants";
import { SubAccount, Attachment } from "../types";

export class UnyraSupportService {
  private subaccount: SubAccount | null = null;
  private systemInstruction: string = "";

  async startChat(subaccount: SubAccount) {
    this.subaccount = subaccount;

    // Inject context into system instruction for local use (if needed) or just setup
    // But primarily we just need to ensure we can call the backend.

    // We don't necessarily NOT need to call /init on backend if backend is stateless,
    // but the backend 'init' endpoint was designed to return context.
    // For now, let's just save the subaccount locally.

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
    this.systemInstruction = UNYRA_SYSTEM_INSTRUCTION + accountContext;
  }

  async sendMessage(
    message: string,
    attachments: Attachment[] = [],
    onToolExecution?: (toolName: string) => void
  ): Promise<string> {

    if (!this.subaccount) {
      return "Error: Chat not initialized. Please refresh the page.";
    }

    try {
      // Call backend API for message processing
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          subaccount: this.subaccount,
          message: message,
          attachments: attachments,
          history: [
            { role: 'system', systemInstruction: this.systemInstruction }
          ]
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Backend API error');
      }

      const data = await res.json();

      // Trigger tool execution callback if provided and detected in response
      // The backend returns the final text which might contain evidence of tool use,
      // generally we want to know if a specific tool was used.
      // Our backend implementation currently returns { success: true, response: text }
      // It processes tool calls internally.
      // If we need to trigger client side effects, we might need the backend to return "toolsExecuted": ["create_task"]

      // For now, let's assume if the response mentions the ticket ID it was created.
      // Or better, update api/chat.js to return executed tools.

      // Heuristic for now used in frontend UI (Ticket created confirmation):
      if (onToolExecution && (data.response?.includes('TASK-') || data.response?.includes('unyra_task_id'))) {
        onToolExecution('create_unyra_task');
      }

      return data.response || "No response generated.";

    } catch (error: any) {
      console.error("Chat API Error:", error);
      return `Lo siento, hubo un error al procesar tu solicitud: ${error.message}. Por favor, intenta de nuevo.`;
    }
  }
}

export const geminiService = new UnyraSupportService();