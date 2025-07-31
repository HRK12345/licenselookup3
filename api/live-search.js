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

  try {
    console.log(`Searching CA database for: ${query}`);
    
    // Build the search URL with query parameters
    const searchUrl = new URL('https://www2.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx');
    
    if (searchType === 'license') {
      searchUrl.searchParams.append('LicNum', query);
    } else {
      searchUrl.searchParams.append('ContractorName', query);
    }

    // Use ScrapingBee to get the search results
    const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
      params: {
        'api_key': process.env.SCRAPINGBEE_API_KEY,
        'url': searchUrl.toString(),
        'render_js': 'true',
        'wait': 3000,
        'premium_proxy': 'true'
      }
    });

    // Parse the HTML response
    const $ = cheerio.load(response.data);
    
    // Check for contractor name (indicates results found)
    const contractorName = $('#lblContractorName').text().trim();
    
    if (!contractorName) {
      return res.json({ 
        success: false, 
        message: 'No license found in CA database',
        query: query 
      });
    }

    // Extract license data
    const licenseData = {
      contractor_name: contractorName,
      business_name: $('#lblBusinessName').text().trim(),
      license_number: $('#lblLicenseNumber').text().trim(),
      status: $('#lblLicenseStatus').text().trim().toLowerCase(),
      license_type: $('#lblLicenseType').text().trim(),
      issue_date: $('#lblIssueDate').text().trim(),
      expiration_date: $('#lblExpirationDate').text().trim(),
      address: $('#lblAddress').text().trim(),
      phone: $('#lblPhone').text().trim(),
      
      // Enhanced data
      data_source: 'California Contractors State License Board',
      last_scraped: new Date().toISOString(),
      state: 'CA',
      license_url: 'https://www2.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx'
    };

    return res.json({ 
      success: true, 
      data: licenseData,
      source: 'live_ca_database'
    });

  } catch (error) {
    console.error('CA search error:', error.message);
    return res.status(500).json({ 
      success: false, 
      error: 'Search failed',
      message: 'Unable to access CA database at this time'
    });
  }
};
