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

  if (!process.env.SCRAPINGBEE_API_KEY) {
    return res.json({
      success: false,
      error: 'ScrapingBee API key not configured'
    });
  }

  try {
    console.log(`Debugging CA search for: ${query} (${searchType})`);
    
    // Step 1: Get the initial search form
    const formResponse = await axios.get('https://app.scrapingbee.com/api/v1/', {
      params: {
        'api_key': process.env.SCRAPINGBEE_API_KEY,
        'url': 'https://www2.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx',
        'render_js': 'true',
        'wait': 2000,
        'premium_proxy': 'true'
      }
    });

    console.log('Form page length:', formResponse.data.length);
    
    // Parse the form to get hidden fields
    const $form = cheerio.load(formResponse.data);
    
    // Get form state
    const viewState = $form('#__VIEWSTATE').val();
    const viewStateGenerator = $form('#__VIEWSTATEGENERATOR').val();
    const eventValidation = $form('#__EVENTVALIDATION').val();
    
    console.log('Form fields found:', {
      viewState: viewState ? 'yes' : 'no',
      viewStateGenerator: viewStateGenerator ? 'yes' : 'no',
      eventValidation: eventValidation ? 'yes' : 'no'
    });

    // Build form data for submission
    const formData = new URLSearchParams();
    if (viewState) formData.append('__VIEWSTATE', viewState);
    if (viewStateGenerator) formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
    if (eventValidation) formData.append('__EVENTVALIDATION', eventValidation);
    
    // Add search query
    if (searchType === 'license') {
      formData.append('txtLicnum', query);
    } else {
      formData.append('txtContractorName', query);
    }
    formData.append('btnSubmit', 'Search');

    console.log('Submitting search with data:', Object.fromEntries(formData));

    // Step 2: Submit the search
    const searchResponse = await axios.post('https://app.scrapingbee.com/api/v1/', {
      'api_key': process.env.SCRAPINGBEE_API_KEY,
      'url': 'https://www2.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx',
      'render_js': 'true',
      'wait': 3000,
      'premium_proxy': 'true',
      'post_data': formData.toString(),
      'headers': JSON.stringify({
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      })
    });

    console.log('Search response length:', searchResponse.data.length);

    // Parse search results
    const $results = cheerio.load(searchResponse.data);
    
    // Debug: Log what we found
    console.log('Looking for results...');
    console.log('Contractor name element exists:', $results('#lblContractorName').length > 0);
    console.log('Contractor name text:', $results('#lblContractorName').text());
    console.log('Business name text:', $results('#lblBusinessName').text());
    console.log('License number text:', $results('#lblLicenseNumber').text());
    
    // Check for error messages
    const errorMsg = $results('.error, .alert, .warning').text();
    console.log('Error message on page:', errorMsg);
    
    // Look for any results table or container
    const resultsTable = $results('table').length;
    console.log('Tables found:', resultsTable);
    
    // Return debug info for now
    return res.json({
      success: false,
      debug: true,
      query: query,
      searchType: searchType,
      formFieldsFound: {
        viewState: !!viewState,
        viewStateGenerator: !!viewStateGenerator,
        eventValidation: !!eventValidation
      },
      responseLength: searchResponse.data.length,
      contractorNameFound: $results('#lblContractorName').text(),
      businessNameFound: $results('#lblBusinessName').text(),
      licenseNumberFound: $results('#lblLicenseNumber').text(),
      errorMessage: errorMsg,
      tablesFound: resultsTable,
      // Return first 1000 chars of HTML for debugging
      htmlSample: searchResponse.data.substring(0, 1000)
    });

  } catch (error) {
    console.error('CA search error:', error.message);
    return res.status(500).json({ 
      success: false, 
      error: 'Search failed',
      message: error.message,
      stack: error.stack
    });
  }
};
