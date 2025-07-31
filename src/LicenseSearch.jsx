const searchLicense = async () => {
  if (!query.trim()) {
    alert("Please enter a contractor name or license number");
    return;
  }

  setLoading(true);
  setHasSearched(true);

  try {
    // Attempt live CA search first
    if (state === 'CA') {
      const isLicenseNumber = /^\d+$/.test(query.trim());

      try {
        const response = await fetch('/api/live-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.trim(),
            searchType: isLicenseNumber ? 'license' : 'name'
          })
        });

        if (response.ok) {
          const result = await response.json();

          if (result.success && result.data) {
            // Mark expired licenses
            const today = new Date();
            const expDate = new Date(result.data.expiration_date);
            if (expDate < today) {
              result.data.status = 'expired';
            }

            setResults([result.data]);

            // Log success
            await supabase.from("search_logs").insert([{
              search_query: query,
              state: state,
              results_found: 1,
              user_ip: "unknown",
