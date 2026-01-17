
export default async function handler(req, res) {
    const apiKey = process.env.GHL_LOCATION_KEY || process.env.GHL_API_KEY || process.env.VITE_GHL_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Missing API Key (GHL_LOCATION_KEY required)' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { email, name, locationId } = req.body;

    if (!email || !locationId) {
        return res.status(400).json({ error: 'Missing required fields: email, locationId' });
    }

    try {
        // 1. Search
        const searchUrl = `https://services.leadconnectorhq.com/contacts/search?query=${encodeURIComponent(email)}&locationId=${locationId}`;
        const searchRes = await fetch(searchUrl, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Version': '2021-07-28' }
        });

        if (!searchRes.ok) {
            const errText = await searchRes.text();
            console.error("GHL Contact Search Error:", errText);
            return res.status(searchRes.status).json({ error: 'Contact Search Failed', details: errText });
        }

        const searchJson = await searchRes.json();

        if (searchJson.contacts && searchJson.contacts.length > 0) {
            return res.status(200).json({ id: searchJson.contacts[0].id, status: 'found' });
        }

        // 2. Create if not found
        const createRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                locationId,
                email,
                name: name || 'Support User',
                tags: ['unyra-support']
            })
        });

        const createJson = await createRes.json();

        if (!createRes.ok) {
            return res.status(createRes.status).json({ error: 'Failed to create contact', details: createJson });
        }

        return res.status(201).json({ id: createJson.contact.id, status: 'created' });

    } catch (error) {
        return res.status(500).json({ error: 'Server Error', details: error.message });
    }
}
