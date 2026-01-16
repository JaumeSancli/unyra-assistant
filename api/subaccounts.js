
export default async function handler(req, res) {
    const apiKey = process.env.GHL_API_KEY || process.env.VITE_GHL_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Server Configuration Error: Missing API Key' });
    }

    try {
        const ghlRes = await fetch('https://services.leadconnectorhq.com/locations/search?limit=100', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Version': '2021-07-28',
                'Accept': 'application/json'
            }
        });

        if (!ghlRes.ok) {
            const errText = await ghlRes.text();
            return res.status(ghlRes.status).json({ error: 'GHL API Error', details: errText });
        }

        const data = await ghlRes.json();
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
