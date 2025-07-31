import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://equgeqaxzzzlhxvfplno.supabase.co";
const supabaseKey =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxdWdlcWF4enp6bGh4dmZwbG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5ODc2MzYsImV4cCI6MjA2OTU2MzYzNn0.dtc4n1pLaQ8S3ZXyTwhgVIKDQLmHFUWjKiAU0pwat9Q";

export const supabase = createClient(supabaseUrl, supabaseKey);
