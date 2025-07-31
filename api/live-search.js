const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, searchType } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  // For testing, return mock data if no ScrapingBee key
  if (!process.env.SCRAPINGBEE_API_KEY) {
    return res.json({
      success: false,
      error: 'ScrapingBee API key not configured',
      message: 'API key missing'
    });
  }

  try {
    console.log(`Searching CA database for: ${query}`);
    
    // Simple CA search URL
    const searchUrl = `https://www2.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx`;

    // Use ScrapingBee to get the search results
    const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
      params: {
        'api_key': process.env.SCRAPINGBEE_API_KEY,
        'url': searchUrl,
        'render_js': 'true',
        'wait': 3000
      }
    });

    // For now, return a test response to verify API is working
    return res.json({ 
      success: false,
      message: 'API is working but no scraping logic yet',
      query: query,
      scrapingbee_response_length: response.data.length
    });

  } catch (error) {
    console.error('CA search error:', error.message);
    return res.status(500).json({ 
      success: false, 
      error: 'Search failed',
      message: error.message
    });
  }
};
