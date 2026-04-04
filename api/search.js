export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { city, specialty, pagetoken } = req.query;
  const key = process.env.GOOGLE_PLACES_KEY;

  if (!key) return res.status(500).json({ error: 'API key não configurada no Vercel.' });
  if (!city || !specialty) return res.status(400).json({ error: 'Informe cidade e especialidade.' });

  function detectSiteType(url) {
    if (!url) return null;
    const u = url.toLowerCase();
    if (u.includes('wa.me') || u.includes('whatsapp.com')) return 'whatsapp';
    if (u.includes('instagram.com')) return 'instagram';
    if (u.includes('facebook.com') || u.includes('fb.com')) return 'facebook';
    if (u.includes('linktr.ee')) return 'linktree';
    return 'site';
  }

  try {
    const body = {
      textQuery: `${specialty} em ${city}`,
      languageCode: 'pt-BR',
      regionCode: 'BR',
    };
    if (pagetoken) body.pageToken = pagetoken;

    const textRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,nextPageToken',
      },
      body: JSON.stringify(body),
    });

    const textData = await textRes.json();

    if (textData.error) {
      return res.status(400).json({ error: textData.error.status, message: textData.error.message || '' });
    }

    const places = textData.places || [];

    const results = places.map(p => {
      const url = p.websiteUri || null;
      const site_type = detectSiteType(url);
      return {
        name: p.displayName?.text || '',
        phone: p.nationalPhoneNumber || null,
        phone_intl: p.internationalPhoneNumber || null,
        website: url,
        site_type,
        has_site: site_type === 'site',
        rating: p.rating ?? null,
        reviews: p.userRatingCount ?? 0,
        address: p.formattedAddress || '',
        place_id: p.id,
      };
    });

    return res.json({
      results,
      next_page_token: textData.nextPageToken || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
