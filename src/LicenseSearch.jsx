import React, { useState } from "react";
import { supabase } from "./supabase";
import "./LicenseSearch.css";

function LicenseSearch() {
	const [query, setQuery] = useState("");
	const [state, setState] = useState("CA");
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);

	const calculateYearsActive = (issueDate) => {
		if (!issueDate) return "Unknown";
		const issue = new Date(issueDate);
		const now = new Date();
		const years = Math.floor((now - issue) / (365.25 * 24 * 60 * 60 * 1000));
		return years;
	};

	const searchLicense = async () => {
		if (!query.trim()) {
			alert("Please enter a contractor name or license number");
			return;
		}

		setLoading(true);
		setHasSearched(true);

		try {
			// First try live CA database search
			if (state === 'CA') {
				console.log('Searching live CA database...');
				
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
							console.log('Found in CA database:', result.data);
							
							// Check expiration date
							const today = new Date();
							const expDate = new Date(result.data.expiration_date);
							if (expDate < today) {
								result.data.status = 'expired';
							}
							
							setResults([result.data]);
							
							// Log successful search
							try {
								await supabase.from("search_logs").insert([{
									search_query: query,
									state: state,
									results_found: 1,
									user_ip: "unknown",
									search_type: "live_ca_scrape"
								}]);
							} catch (logError) {
								console.log('Logging error (non-critical):', logError);
							}
							
							setLoading(false);
							return;
						} else {
							console.log('No results from CA database, trying local...');
						}
					} else {
						console.log('CA API error:', response.status);
					}
				} catch (apiError) {
					console.log('CA API failed:', apiError.message);
				}
			}
			
			// Fallback: search your local database
			console.log('Searching local database...');
			const { data, error } = await supabase
				.from("Licenses")
				.select("*")
				.eq("state", state)
				.or(`license_number.ilike.%${query}%,contractor_name.ilike.%${query}%,business_name.ilike.%${query}%`)
				.limit(10);

			if (error) {
				console.error("Local database error:", error);
				alert("Search failed. Please try again.");
			} else {
				// Check expiration dates
				if (data) {
					const today = new Date();
					data.forEach((license) => {
						const expDate = new Date(license.expiration_date);
						if (expDate < today) {
							license.status = "expired";
						}
					});
				}

				setResults(data || []);

				// Log search (with proper columns only)
				try {
					await supabase.from("search_logs").insert([{
						search_query: query,
						state: state,
						results_found: data?.length || 0,
						user_ip: "unknown"
					}]);
				} catch (logError) {
					console.log('Logging error (non-critical):', logError);
				}
			}
			
		} catch (err) {
			console.error('Search error:', err);
			alert('Search failed. Please try again.');
			setResults([]);
		}

		setLoading(false);
	};

	return (
		<div className="search-container">
			{/* Header */}
			<div className="header">
				<h1>🔍 LicenseLookup</h1>
				<p>Verify contractor licenses instantly</p>
			</div>

			{/* Search Form */}
			<div className="search-form">
				<div className="input-group">
					<label>Search for contractor:</label>
					<input
						type="text"
						placeholder="Enter contractor name, business name, or license number"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyPress={(e) => e.key === "Enter" && searchLicense()}
					/>
				</div>

				<div className="input-group">
					<label>State:</label>
					<select value={state} onChange={(e) => setState(e.target.value)}>
						<option value="CA">California</option>
						<option value="TX">Texas</option>
						<option value="FL">Florida</option>
						<option value="NY">New York</option>
						<option value="IL">Illinois</option>
					</select>
				</div>

				<button
					onClick={searchLicense}
					disabled={loading}
					className={`search-button ${loading ? "loading" : ""}`}
				>
					{loading ? "Verifying with CA Database..." : "Verify License ($2.99)"}
				</button>
			</div>

			{/* Results */}
			{hasSearched && (
				<div className="results">
					<h3>Search Results</h3>

					{results.length > 0 ? (
						results.map((license) => (
							<div
								key={license.id}
								className={`license-card ${license.status === "active" ? "active" : "expired"}`}
							>
								{/* Status Header */}
								<div className="status-header">
									{license.status === "active"
										? "✅ ACTIVE LICENSE FOUND"
										: "⚠️ EXPIRED LICENSE"}
								</div>

								{/* Basic Info */}
								<h4>{license.contractor_name}</h4>

								<div className="license-details">
									{license.business_name && (
										<p><strong>Business:</strong> {license.business_name}</p>
									)}
									<p><strong>License #:</strong> {license.license_number}</p>
									<p><strong>Status:</strong> {license.status}</p>
									<p><strong>Type:</strong> {license.license_type}</p>
									<p>
										<strong>Licensed Since:</strong> {license.issue_date}
										<span className="experience">
											({calculateYearsActive(license.issue_date)} years experience)
										</span>
									</p>
									{license.last_renewal_date && (
										<p><strong>Last Renewed:</strong> {license.last_renewal_date}</p>
									)}
									<p><strong>Expires:</strong> {license.expiration_date}</p>
									{license.address && (
										<p><strong>Address:</strong> {license.address}</p>
									)}
								</div>

								{/* License Classifications */}
								{license.classifications && license.classifications.length > 0 && (
									<div className="info-section classifications">
										<strong>License Classifications:</strong>
										<ul>
											{license.classifications.map((classification, index) => (
												<li key={index}>{classification}</li>
											))}
										</ul>
										{license.scope_of_work && (
											<p><strong>Authorized Work:</strong> {license.scope_of_work}</p>
										)}
									</div>
								)}

								{/* Bonding Information */}
								{license.bond_info && (
									<p className="bond-info">
										<strong>Bond Status:</strong>
										<span className={license.bond_info.status === "active" ? "bond-active" : "bond-inactive"}>
											{license.bond_info.status === "active" ? "✅ Bonded" : "❌ Bond Issues"}
											{license.bond_info.amount && ` (${license.bond_info.amount})`}
										</span>
									</p>
								)}

								{/* Disciplinary Actions */}
								{license.disciplinary_actions && license.disciplinary_actions.length > 0 ? (
									<div className="info-section warning">
										<strong>⚠️ Disciplinary History:</strong>
										<ul>
											{license.disciplinary_actions.map((action, index) => (
												<li key={index}>
													<strong>{action.date}:</strong> {action.description}
													{action.status && <em> (Status: {action.status})</em>}
												</li>
											))}
										</ul>
									</div>
								) : (
									<div className="info-section clean-record">
										<strong>✅ Clean Record:</strong> No disciplinary actions on file
									</div>
								)}

								{/* Renewal History */}
								{license.renewal_history && (
									<div className="info-section renewal-history">
										<strong>Renewal History:</strong>
										<p>
											{license.renewal_history.on_time_renewals} on-time renewals,{" "}
											{license.renewal_history.late_renewals} late renewals
											{license.renewal_history.late_renewals > 0 && (
												<span className="late-renewals"> ⚠️ (Pattern of late renewals)</span>
											)}
										</p>
									</div>
								)}

								{/* Important Warnings */}
								{license.warnings && license.warnings.length > 0 && (
									<div className="info-section alerts">
										<strong>🚨 Important Notices:</strong>
										<ul>
											{license.warnings.map((warning, index) => (
												<li key={index}>{warning}</li>
											))}
										</ul>
									</div>
								)}

								{/* Smart Hiring Tips */}
								<div className="info-section hiring-tips">
									<h5>✅ Smart Hiring Tips</h5>
									<ul>
										<li>Always verify this license is current before starting work</li>
										<li>Request proof of liability insurance and workers compensation</li>
										<li>Get all agreements in writing with detailed scope of work</li>
										<li>Check that work permits are pulled in contractor's name</li>
										{license.status !== "active" && (
											<li className="critical-warning">
												⚠️ Do NOT hire - license is {license.status}
											</li>
										)}
										{license.disciplinary_actions?.length > 0 && (
											<li className="caution-warning">
												⚠️ Use caution - contractor has disciplinary history
											</li>
										)}
									</ul>
								</div>

								{/* Verification Details */}
								<div className="info-section verification-details">
									<h5>🔍 Verification Details</h5>
									<p><strong>Data Source:</strong> {license.data_source || "State Licensing Board"}</p>
									<p><strong>Last Updated:</strong> {new Date(license.last_scraped || license.created_at).toLocaleDateString()}</p>
									<p><strong>Verification ID:</strong> #{license.id}</p>
									{license.license_url && (
										<p>
											<strong>Official Record:</strong>{" "}
											<a href={license.license_url} target="_blank" rel="noopener noreferrer">
												View on State Website
											</a>
										</p>
									)}
								</div>
							</div>
						))
					) : (
						<div className="no-results">
							<h4>⚠️ No License Found</h4>
							<p>We couldn't find an active license for "{query}" in {state}.</p>
							<p className="warning-text">
								Warning: This contractor may not be properly licensed.
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export default LicenseSearch;
