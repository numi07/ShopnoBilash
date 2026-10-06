export default async function handler(req, res) {
    const scriptURL = process.env.INVOICE_GAS_SCRIPT_URL;
    const adminPass = process.env.INVOICE_ADMIN_PASSWORD;
    const allowedDomain = "shopnobilash.pro.bd";

    // CORS Headers (মোবাইল ও ব্রাউজার থেকে নিরবচ্ছিন্ন সংযোগ নিশ্চিত করার জন্য)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!scriptURL) {
        return res.status(500).json({ error: "Environment variable INVOICE_GAS_SCRIPT_URL is not set" });
    }

    const referer = req.headers.referer || "";
    const origin = req.headers.origin || "";
    const isAllowedSource = referer.includes(allowedDomain) || origin.includes(allowedDomain) || referer.includes("localhost") || origin.includes("localhost") || !referer;

    // GET Request (দ্রুত ডাটা ফেচিং)
    if (req.method === 'GET') {
        const { action, pass } = req.query;

        if (action === 'checkLogin') {
            if (pass === adminPass) return res.status(200).json({ success: true });
            else return res.status(401).json({ error: "Unauthorized" });
        }

        try {
            const queryAction = action ? action : 'getData';
            const response = await fetch(`${scriptURL}?action=${queryAction}&_t=${Date.now()}`);
            const data = await response.json();
            return res.status(200).json(data);
        } catch (error) {
            return res.status(500).json({ error: "Fetch failed from Google Apps Script" });
        }
    }
    
    // POST Request (নোটিশ, ইনভয়েস ও অন্যান্য ডাটা দ্রুত সংরক্ষণ)
    if (req.method === 'POST') {
        try {
            const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

            const response = await fetch(scriptURL, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            return res.status(200).json(data);
        } catch (error) {
            return res.status(500).json({ error: "Operation failed in Google Apps Script" });
        }
    }

    return res.status(405).json({ error: "Method not allowed" });
}
