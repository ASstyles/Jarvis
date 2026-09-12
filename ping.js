(async () => {
  try {
    const start = Date.now();
    console.log("SENDING REQUEST TO http://localhost:4000/api/chat");
    const res = await fetch("http://localhost:4000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello API" })
    });
    console.log("RESPONSE OK:", res.ok, "STATUS:", res.status);
    const json = await res.json();
    console.log("DATA:", json);
    console.log(`TOOK: ${Date.now() - start}ms`);
  } catch(e) {
    console.error("FAIL:", e);
  }
})();
