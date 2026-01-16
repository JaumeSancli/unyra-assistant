
export default async function handler(req, res) {
    const apiKey = process.env.GHL_API_KEY || process.env.VITE_GHL_API_KEY;

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const ghlRes = await fetch('https://services.leadconnectorhq.com/tasks', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await ghlRes.json();
        return res.status(ghlRes.status).json(data);

    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
