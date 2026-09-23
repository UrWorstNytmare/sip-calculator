// Quick test only — not part of the app yet.
// Calls AMFI's own TER (expense ratio) endpoint, which their website uses
// internally. Requires a Referer header or it gets rejected.

async function testTER() {
  const url = 'https://www.amfiindia.com/api/populate-te-rdata-revised?MF_ID=All&Month=08-2026&strCat=-1&strType=-1';

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://www.amfiindia.com/ter-of-mf-schemes'
    }
  });

  console.log('Status:', res.status);
  const data = await res.json();
  const records = Array.isArray(data) ? data : (data.data || data);
  console.log('Total records:', Array.isArray(records) ? records.length : 'not an array — raw shape below');
  console.log('First 3 records:');
  console.log(JSON.stringify(Array.isArray(records) ? records.slice(0, 3) : records, null, 2));
}

testTER().catch(err => console.error('Failed:', err.message));