export default async function handler(req, res) {
    const scriptURL = process.env.INVOICE_GAS_SCRIPT_URL;
    const adminPass = process.env.INVOICE_ADMIN_PASSWORD || "Shopno@2024@";
    const managerPass = process.env.INVOICE_MANAGER_PASSWORD || "Manager@2024@";
    const allowedDomain = "shopnobilash.pro.bd";

    // CORS Headers
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

    // GET Request (অতি দ্রুত ডাটা লোডিং ও অথেনটিকেশন)
    if (req.method === 'GET') {
        const { action, pass, role } = req.query;

        // অ্যাডমিন এবং ম্যানেজার পিন যাচাইকরণ
        if (action === 'checkLogin') {
            if (role === 'manager') {
                if (pass === managerPass) return res.status(200).json({ success: true, role: 'manager' });
                return res.status(401).json({ error: "Unauthorized Manager" });
            }
            if (pass === adminPass) return res.status(200).json({ success: true, role: 'admin' });
            return res.status(401).json({ error: "Unauthorized Admin" });
        }

        try {
            // Vercel Global Edge Cache সক্রিয় করা হলো (সুপার ফাস্ট ৫ সেকেন্ড ক্যাশ + ব্যাকগ্রাউন্ড রিভ্যালিডেশন)
            res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');

            const queryAction = action ? action : 'getData';
            const response = await fetch(`${scriptURL}?action=${queryAction}&_t=${Date.now()}`);
            const data = await response.json();
            return res.status(200).json(data);
        } catch (error) {
            return res.status(500).json({ error: "Fetch failed from Google Apps Script" });
        }
    }
    
    // POST Request (ডাটা সংরক্ষণ, এডিট ও ডিলিট)
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
