import { TicketData, GoogleSheetResponse } from '../types';

export const sheetsService = {
    async appendTicket(ticketData: TicketData): Promise<GoogleSheetResponse> {
        try {
            const scriptUrl = import.meta.env.VITE_GOOGLE_SHEETS_SCRIPT_URL;
            if (!scriptUrl) throw new Error("VITE_GOOGLE_SHEETS_SCRIPT_URL not configured");

            const response = await fetch(scriptUrl, {
                method: 'POST',
                mode: 'no-cors', // Important for Google Apps Script simple triggers sometimes, but 'cors' is better if script handles options. 
                // Note: Google Apps Script Web Apps usually require redirect handling. 
                // 'text/plain' avoids preflight OPTIONS request which GAS doesn't handle well usually.
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({
                    action: 'append',
                    payload: ticketData
                })
            });

            // With no-cors, we can't read the response. 
            // However, usually for these integrations we want to read the response.
            // To read response, we must use mode: 'cors' and the script must return correct headers (which ContentService usually does).
            // Let's try standard fetch first. If CORS issues arise, we might need a proxy or different approach.
            // Actually, standard modern approach for GAS Web App:
            // Use 'Content-Type': 'text/plain' to avoid OPTIONS preflight.
            // GAS will return 302 Redirect to the actual content. Browser follows it.

            // Let's retry with standard await fetch and expect it works if published as "Anyone".
        } catch (e) {
            console.error("Sheets API Error (Client-side limitation?)", e);
            // Fallback response since we might be in no-cors blind mode or error
            return {
                ok: false,
                ticket_id: 'ERR-NET',
                row_id: '0',
                sheet_url: ''
            };
        }

        // Re-implementation with better handling assumption
        return this._makeRequest({
            action: 'append',
            payload: ticketData
        });
    },

    async updateTicket(rowId: string, patch: any): Promise<{ ok: boolean }> {
        return this._makeRequest({
            action: 'update',
            payload: { row_id: rowId, patch }
        });
    },

    async getTickets(email?: string): Promise<any[]> {
        const res = await this._makeRequest({
            action: 'get_tickets',
            email
        });
        return res.tickets || [];
    },

    async _makeRequest(body: any): Promise<any> {
        const scriptUrl = import.meta.env.VITE_GOOGLE_SHEETS_SCRIPT_URL;
        // Fallback ID provided by user
        const SPREADSHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID || "1BV8exnTVi1zHnXiJty6CezSoaMTCJ3ibvbf7pvRZd88";

        if (!scriptUrl) {
            console.warn("Missing VITE_GOOGLE_SHEETS_SCRIPT_URL");
            return { ok: false, error: "Configuration Missing" };
        }

        // Inject spreadsheet_id into the top-level data object
        const requestData = {
            ...body,
            spreadsheet_id: SPREADSHEET_ID
        };

        // Google Apps Script Web App "text/plain" hack to skip OPTIONS preflight
        const response = await fetch(scriptUrl, {
            method: "POST",
            body: JSON.stringify(requestData),
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
        });

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            console.warn("Failed to parse Sheets response", text);
            return { ok: false, raw: text };
        }
    }
};
