#!/usr/bin/env node
import fs from "node:fs/promises";

const AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";
const COUNTRIES_URL = "https://davidmegginson.github.io/ourairports-data/countries.csv";
const OUTPUT = "src/data/routeOptions.generated.js";

const allowCountries = new Set([
  "AE","EG","SA","QA","KW","OM","BH","JO","LB","TR","ES","FR","IT","DE","NL","BE","AT","CH","PT","GR","CZ","HU","PL","SE","NO","DK","FI","IE","GB","US","CA","MX","BR","AR","MA","TN","DZ","ZA","KE","ET","NG","IN","PK","BD","LK","NP","TH","ID","MY","SG","VN","PH","CN","HK","JP","KR","AU","NZ"
]);

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else {
      if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ""; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch !== '\r') cell += ch;
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const header = rows.shift();
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

async function fetchCsv(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return parseCsv(await res.text());
}

const airportRows = await fetchCsv(AIRPORTS_URL);
const countryRows = await fetchCsv(COUNTRIES_URL);

const countryMap = new Map(countryRows.map(c => [c.code, c.name]));
const airports = airportRows
  .filter(a => allowCountries.has(a.iso_country))
  .filter(a => a.iata_code && ["large_airport", "medium_airport"].includes(a.type))
  .filter(a => a.scheduled_service === "yes" || a.type === "large_airport")
  .sort((a,b) => a.iso_country.localeCompare(b.iso_country) || (a.municipality || "").localeCompare(b.municipality || ""))
  .map(a => ({
    code: a.iata_code,
    city: a.municipality || a.name,
    countryCode: a.iso_country,
    name: a.name
  }));

const seen = new Set();
const uniqueAirports = airports.filter(a => {
  if (seen.has(a.code)) return false;
  seen.add(a.code);
  return true;
});

const countries = [...allowCountries]
  .map(code => ({ code, name: countryMap.get(code) || code, currency: "", flag: "🌍" }))
  .sort((a,b) => a.name.localeCompare(b.name));

const output = `// Auto-generated from OurAirports open data. Review currencies/flags before replacing routeOptions.js.\nexport const countries = ${JSON.stringify(countries, null, 2)};\n\nexport const airports = ${JSON.stringify(uniqueAirports, null, 2)};\n`;
await fs.writeFile(OUTPUT, output, "utf8");
console.log(`Generated ${OUTPUT}`);
console.log(`${countries.length} countries, ${uniqueAirports.length} airports`);
