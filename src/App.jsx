import React from "react";
import LicenseSearch from "./LicenseSearch";
import "./App.css";

function App() {
  return (
    <div
      className="App"
      style={{
        backgroundColor: "#ecf0f1",
        minHeight: "100vh",
        padding: "20px 0",
      }}
    >
      <LicenseSearch />
    </div>
  );
}

export default App;
