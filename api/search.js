export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { city, specialty, pagetoken } = req.query;
  const key = process.env.GOOGLE_PLACES_KEY;

  if (!key) return res.status(500).json({ error: 'API key não configurada no Vercel.' });
  if (!city || !specialty) return res.status(400).json({ error: 'Informe cidade e especialidade.' });

  try {
    let textUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(specialty + ' em ' + city)}&language=pt-BR&region=br&key=${key}`;
    if (pagetoken) textUrl += `&pagetoken=${encodeURIComponent(pagetoken)}`;

    const textRes = await fetch(textUrl);
    const textData = await textRes.json();

    if (textData.status !== 'OK' && textData.status !== 'ZERO_RESULTS') {
      return res.status(400).json({ error: textData.status, message: textData.error_message || '' });
    }

    const places = textData.results || [];

    const results = await Promise.all(
      places.map(async (place) => {
        try {
          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,formatted_address&language=pt-BR&key=${key}`;
          const detailRes = await fetch(detailUrl);
          const detailData = await detailRes.json();
          const d = detailData.result || {};

          return {
            name: d.name || place.name,
            phone: d.formatted_phone_number || null,
            phone_intl: d.international_phone_number || null,
            website: d.website || null,
            has_site: !!(d.website),
            rating: d.rating ?? place.rating ?? null,
            reviews: d.user_ratings_total ?? place.user_ratings_total ?? 0,
            address: d.formatted_address || place.formatted_address || '',
            place_id: place.place_id,
          };
        } catch {
          return {
            name: place.name,
            phone: null,
            phone_intl: null,
            website: null,
            has_site: false,
            rating: place.rating ?? null,
            reviews: place.user_ratings_total ?? 0,
            address: place.formatted_address || '',
            place_id: place.place_id,
          };
        }
      })
    );

    return res.json({
      results,
      next_page_token: textData.next_page_token || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
