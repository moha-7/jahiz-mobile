const res = await fetch("http://127.0.0.1:4000/api/health");
console.log(await res.json());
