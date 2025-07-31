const axios = require('axios');
const cheerio = require('cheerio');

// For Vercel serverless functions
export default async function handler(req, res) {
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
    console.log(`Searching for: ${query} (type: ${searchType})`);
    
    // ScrapingBee API call
    const response = await axios.get('https://app.scrapingbee.com/api/v1/', {
      params: {
        'api_key': process.env.SCRAPINGBEE_API_KEY,
        'url': 'https://www2.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx',
        'render_js': 'true',
        'wait': 3000,
        'premium_proxy': 'true',
        'custom_google': 'true'
      }
    });

    // Parse the HTML response
    const $ = cheerio.load(response.data);
    
    // Check if we need to perform a search (if we got the form page)
    if ($('#txtLicnum').length > 0) {
      // We got the search form, need to submit search
      const searchUrl = 'https://www2.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx';
      
      // Build form data for the search
      const formData = new URLSearchParams();
      formData.append('__VIEWSTATE', $('#__VIEWSTATE').val() || '');
      formData.append('__VIEWSTATEGENERATOR', $('#__VIEWSTATEGENERATOR').val() || '');
      formData.append('__EVENTVALIDATION', $('#__EVENTVALIDATION').val() || '');
      
      if (searchType === 'license') {
        formData.append('txtLicnum', query);
        formData.append('btnSubmit', 'Search');
      } else {
        formData.append('txtContractorName', query);
        formData.append('btnSubmit', 'Search');
      }

      // Submit the search form
      const searchResponse = await axios.post('https://app.scrapingbee.com/api/v1/', {
        'api_key': process.env.SCRAPINGBEE_API_KEY,
        'url': searchUrl,
        'render_js': 'true',
        'wait': 3000,
        'premium_proxy': 'true',
        'post_data': formData.toString(),
        'headers': JSON.stringify({
          'Content-Type': 'application/x-www-form-urlencoded'
        })
      });

      // Parse search results
      const $results = cheerio.load(searchResponse.data);
      
      // Check for results
      const contractorName = $results('#lblContractorName').text().trim();
      
      if (!contractorName) {
        return res.json({ 
          success: false, 
          message: 'No license found',
          query: query 
        });
      }

      // Extract license data
      const licenseData = {
        contractor_name: contractorName,
        business_name: $results('#lblBusinessName').text().trim(),
        license_number: $results('#lblLicenseNumber').text().trim(),
        status: $results('#lblLicenseStatus').text().trim().toLowerCase(),
        license_type: $results('#lblLicenseType').text().trim(),
        issue_date: $results('#lblIssueDate').text().trim(),
        expiration_date: $results('#lblExpirationDate').text().trim(),
        address: $results('#lblAddress').text().trim(),
        phone: $results('#lblPhone').text().trim(),
        
        // Enhanced data
        data_source: 'California Contractors State License Board',
        last_scraped: new Date().toISOString(),
        state: 'CA',
        license_url: 'https://www2.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx'
      };

      return res.json({ 
        success: true, 
        data: licenseData,
        source: 'live_scrape'
      });
    }
    
    // If we didn't get the form, something went wrong
    return res.status(500).json({ 
      success: false, 
      error: 'Unable to access CA database' 
    });

  } catch (error) {
    console.error('ScrapingBee error:', error.response?.data || error.message);
    return res.status(500).json({ 
      success: false, 
      error: 'Search failed',
      message: 'Unable to verify license at this time'
    });
  }
}
