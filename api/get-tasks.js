export default async function handler(req, res) {
    // Priority: Location Key (for specific task access) > Agency Key (might fail for this endpoint)
    const apiKey = process.env.GHL_LOCATION_KEY || process.env.GHL_API_KEY || process.env.VITE_GHL_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Missing API Key (GHL_LOCATION_KEY required for Task operations)' });
    }

    const { email, locationId } = req.query;

    if (!email || !locationId) {
        return res.status(400).json({ error: 'Missing email or locationId' });
    }

    try {
        // 1. Search Contact to get ID using POST /contacts/search
        const searchRes = await fetch('https://services.leadconnectorhq.com/contacts/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                locationId: locationId,
                query: email
            })
        });

        if (!searchRes.ok) {
            const errText = await searchRes.text();
            console.error("GHL Search Error:", errText);
            return res.status(searchRes.status).json({ error: 'Contact Search Failed', details: errText });
        }

        const searchJson = await searchRes.json();
        const contact = searchJson.contacts?.[0];

        if (!contact) {
            // Contact not found -> No tickets
            return res.status(200).json({ tasks: [] });
        }

        // 2. Fetch Tasks for Contact
        const tasksUrl = `https://services.leadconnectorhq.com/tasks/search?contactId=${contact.id}`;
        const tasksRes = await fetch(tasksUrl, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Version': '2021-07-28',
                'Accept': 'application/json'
            }
        });

        if (!tasksRes.ok) {
            // Handle 404 or empty specifically if needed, but GHL usually returns array
            return res.status(tasksRes.status).json({ error: 'Tasks Fetch Failed' });
        }

        const tasksJson = await tasksRes.json();

        // Return format
        return res.status(200).json({ tasks: tasksJson.tasks || [] });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
