(async () => {
  const tryUrl = async (url) => {
    try {
      console.log(`TESTING: ${url}`);
      let abort = new AbortController();
      let timeout = setTimeout(() => abort.abort(), 3000);
      let res = await fetch(url, { signal: abort.signal, method: 'GET' });
      clearTimeout(timeout);
      console.log(`SUCCESS: ${url} -> ${res.status}`);
    } catch(e) {
      console.log(`FAIL: ${url} -> ${e.message}`);
    }
  }
  await tryUrl("http://127.0.0.1:4000/health");
  await tryUrl("http://localhost:4000/health");
  await tryUrl("http://[::1]:4000/health");
})();
