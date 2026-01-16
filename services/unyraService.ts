import { UnyraTaskResponse, UnyraTaskData } from '../types';

export const unyraService = {
    async getSubaccounts(): Promise<any[]> {
        try {
            // API Key is now handled by the backend function
            const res = await fetch('/api/subaccounts');
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || 'Failed to fetch subaccounts');
            }

            // Map to simpler format if needed, or return raw
            // Matches SubAccount interface: { id, name, email, plan, status }
            return (json.locations || []).map((loc: any) => ({
                id: loc.id,
                name: loc.name || "Unnamed Location",
                email: loc.email || "no-email",
                plan: "Standard",
                status: "active"
            }));
        } catch (e) {
            console.error("Failed to fetch subaccounts", e);
            return [];
        }
    },

    async createTask(taskData: any): Promise<UnyraTaskResponse> {
        const locationId = import.meta.env.VITE_GHL_LOCATION_ID;

        // Note: API Key is NOT accessed here. Secure backend handles it.

        try {
            // 1. Find/Create Contact (Securely via backend)
            const contactId = await this._ensureContactInGHL(taskData.requester_email, taskData.metadata?.location_name);

            // 2. Create Task (Securely via backend)
            const res = await fetch('/api/create-task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contactId: contactId,
                    title: taskData.title,
                    body: taskData.description,
                    dueDate: taskData.dueDate || new Date(Date.now() + 86400000).toISOString(),
                    status: 'incomplete'
                })
            });

            const json = await res.json();

            if (!res.ok) {
                console.error("GHL Task Error", json);
                throw new Error(json.message || "Failed to create task");
            }

            return {
                ok: true,
                unyra_task_id: json.id,
                task_url: `https://app.gohighlevel.com/v2/location/${locationId}/tasks`
            };

        } catch (e: any) {
            console.error("Unyra Service Error", e);
            return { ok: false, unyra_task_id: 'ERR-API', task_url: '', error: e.message };
        }
    },

    async _ensureContactInGHL(email: string, name?: string): Promise<string> {
        const locationId = import.meta.env.VITE_GHL_LOCATION_ID;

        // Single call to backend which handles Search AND Create
        const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                locationId,
                email,
                name
            })
        });

        const json = await res.json();

        if (!res.ok) {
            throw new Error(json.error || "Failed to identify contact");
        }

        return json.id; // Backend returns { id: '...', status: 'found'|'created' }
    },

    async getTickets(email: string): Promise<any[]> {
        const locationId = import.meta.env.VITE_GHL_LOCATION_ID;
        if (!email || !locationId) return [];

        try {
            // Use our new secure backend endpoint
            const res = await fetch(`/api/get-tasks?email=${encodeURIComponent(email)}&locationId=${locationId}`);
            if (!res.ok) return [];

            const json = await res.json();
            return json.tasks || [];
        } catch (e) {
            console.error("Failed to fetch GHL tickets", e);
            return [];
        }
    }
};
