import { UnyraTaskResponse, UnyraTaskData } from '../types';

export const unyraService = {
    async getSubaccounts(): Promise<any[]> {
        const apiKey = import.meta.env.VITE_GHL_API_KEY;
        if (!apiKey) return [];

        try {
            // Use Proxy Path to avoid CORS
            const baseUrl = '/ghl-api';

            const res = await fetch(`${baseUrl}/locations/search?limit=100`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Version': '2021-07-28',
                    'Accept': 'application/json'
                }
            });
            const json = await res.json();

            // Map to simpler format if needed, or return raw
            // Matches SubAccount interface: { id, name, email, plan, status }
            return (json.locations || []).map((loc: any) => ({
                id: loc.id,
                name: loc.name || "Unnamed Location",
                email: loc.email || "no-email",
                plan: "Standard", // API doesn't always return plan name easily
                status: "active" // Defaulting for now
            }));
        } catch (e) {
            console.error("Failed to fetch subaccounts", e);
            return [];
        }
    },

    async createTask(taskData: any): Promise<UnyraTaskResponse> {
        const apiKey = import.meta.env.VITE_GHL_API_KEY;
        const locationId = import.meta.env.VITE_GHL_LOCATION_ID;

        if (!apiKey) {
            console.warn("Missing VITE_GHL_API_KEY");
            return { ok: false, unyra_task_id: 'ERR-CFG', task_url: '' };
        }

        // GHL v2 API for Tasks (or v1 depending on endpoint)
        // Using standard endpoint: https://services.leadconnectorhq.com/tasks
        // This requires locationId in the body or header depending on auth type.
        // If using Agency Key, usually we need to specify 'Location-Id' header if acting on behalf?
        // Or simpler: We just assume the user provided a Location API Key? 
        // The user mentioned "Agency API Key". 
        // With Agency Token -> We likely need access token (OAuth).
        // If it's a "Personal Access Token" (new system), it works similarly.
        // Let's assume standard POST /contacts/{contact_id}/tasks or generic /tasks logic if available.

        // Actually, creating a task usually requires a Contact ID. 
        // Our tool definition receives `requester_email`. We must first Find/Create Contact, then Create Task.

        try {
            // 1. Find/Create Contact
            const contactId = await this._ensureContactInGHL(taskData.requester_email, taskData.metadata?.location_name);

            // 2. Create Task
            const res = await fetch('/ghl-api/tasks', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Version': '2021-07-28',
                    'Content-Type': 'application/json'
                },
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
                task_url: `https://app.gohighlevel.com/v2/location/${locationId}/tasks` // Construct generic URL since direct link might vary
            };

        } catch (e: any) {
            console.error("Unyra Service Error", e);
            return { ok: false, unyra_task_id: 'ERR-API', task_url: '', error: e.message };
        }
    },

    async _ensureContactInGHL(email: string, name?: string): Promise<string> {
        const apiKey = import.meta.env.VITE_GHL_API_KEY;
        const locationId = import.meta.env.VITE_GHL_LOCATION_ID; // If using Agency Key, might need this in body/query?
        // NOTE: With Agency Key, you can't hit location endpoints directly without specifying location context usually.
        // But assuming the user put a Location-level API Key OR a Bearer token with scope.
        // Let's try standard lookup.

        const searchRes = await fetch(`/ghl-api/contacts/search?query=${email}&locationId=${locationId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Version': '2021-07-28' }
        });

        const searchJson = await searchRes.json();
        if (searchJson.contacts && searchJson.contacts.length > 0) {
            return searchJson.contacts[0].id;
        }

        // Create
        const createRes = await fetch(`/ghl-api/contacts/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                locationId: locationId,
                email: email,
                name: name || 'Support User',
                tags: ['unyra-support']
            })
        });

        const createJson = await createRes.json();
        return createJson.contact.id;
    }
};
