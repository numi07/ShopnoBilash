// ইন-মেমোরি ক্যাশ ভ্যারিয়েবল (Vercel Serverless Instance-এ ডাটা দ্রুত রাখার জন্য)
let cachedFullData = null;
let lastCacheTime = 0;
const CACHE_DURATION = 15 * 1000; // ১৫ সেকেন্ড ক্যাশ থাকবে

export default async function handler(req, res) {
    const scriptURL = process.env.INVOICE_GAS_SCRIPT_URL;
    const adminPass = process.env.INVOICE_ADMIN_PASSWORD;
    const managerPass = process.env.INVOICE_MANAGER_PASSWORD;
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

        // পিন যাচাইকরণ (Admin & Manager)
        if (action === 'checkLogin') {
            if (role === 'manager') {
                if (pass === managerPass) return res.status(200).json({ success: true, role: 'manager' });
                return res.status(401).json({ error: "Unauthorized Manager" });
            }
            if (pass === adminPass) return res.status(200).json({ success: true, role: 'admin' });
            return res.status(401).json({ error: "Unauthorized Admin" });
        }

        try {
            const now = Date.now();
            const queryAction = action ? action : 'getData';

            // ইন-মেমোরি ক্যাশ থাকলে গুগল শিটে না গিয়ে ২০ মিলি-সেকেন্ডে রেসপন্স দিবে
            if (queryAction === 'getData' && cachedFullData && (now - lastCacheTime < CACHE_DURATION)) {
                res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');
                return res.status(200).json(cachedFullData);
            }

            res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');
            const response = await fetch(`${scriptURL}?action=${queryAction}&_t=${now}`);
            const data = await response.json();

            if (queryAction === 'getData') {
                cachedFullData = data;
                lastCacheTime = now;
            }

            return res.status(200).json(data);
        } catch (error) {
            // এরর হলেও পুরানো ক্যাশ ডাটা থাকলে রিটার্ন করবে (Fail-safe)
            if (cachedFullData) return res.status(200).json(cachedFullData);
            return res.status(500).json({ error: "Fetch failed from Google Apps Script" });
        }
    }
    
    // POST Request (ডাটা সংরক্ষণ বা পরিবর্তনের সময় ক্যাশ ইনভ্যালিডেট করা হবে)
    if (req.method === 'POST') {
        try {
            const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

            const response = await fetch(scriptURL, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            // নতুন ডাটা সেভ হলে মেমোরি ক্যাশ ক্লিয়ার করা হলো যাতে সাথে সাথে ফ্রেশ ডাটা আসে
            cachedFullData = null;
            lastCacheTime = 0;

            return res.status(200).json(data);
        } catch (error) {
            return res.status(500).json({ error: "Operation failed in Google Apps Script" });
        }
    }

    return res.status(405).json({ error: "Method not allowed" });
}
