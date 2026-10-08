const API_BASE = "https://SEU-WORKER.seu-subdominio.workers.dev";

const products = {
  content: { name: "5 fotos + 3 vídeos", price: 10 },
  preview: { name: "Prévia de 1 min", price: 5 },
  call: { name: "Chamada", price: 15 }
};

const params = new URLSearchParams(location.search);
const key = params.get("product");
const product = products[key];

if (!product) {
  location.href = "index.html";
}

const nameEl = document.getElementById("productName");
const priceEl = document.getElementById("productPrice");
nameEl.textContent = product.name;
priceEl.textContent = product.price.toLocaleString("pt-BR", {style:"currency",currency:"BRL"});

const form = document.getElementById("checkoutForm");
const formError = document.getElementById("formError");
const payBtn = document.getElementById("payBtn");

document.getElementById("document").addEventListener("input", e => {
  let v = e.target.value.replace(/\D/g,"").slice(0,11);
  v = v.replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2");
  e.target.value = v;
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  formError.textContent = "";
  payBtn.disabled = true;
  payBtn.textContent = "Gerando PIX...";

  const data = {
    product: key,
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    document: document.getElementById("document").value.replace(/\D/g,"")
  };

  try {
    const r = await fetch(`${API_BASE}/create-charge`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(data)
    });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error || "Não foi possível gerar a cobrança.");

    document.getElementById("stepForm").hidden = true;
    document.getElementById("stepPix").hidden = false;
    document.getElementById("qr").src = j.charge.qr_code_image;
    document.getElementById("pixCode").value = j.charge.qr_code;

    startPolling(j.charge.id, j.charge.expires_at);
  } catch(err) {
    formError.textContent = err.message;
    payBtn.disabled = false;
    payBtn.textContent = "Gerar PIX";
  }
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  const code = document.getElementById("pixCode").value;
  await navigator.clipboard.writeText(code);
  const btn = document.getElementById("copyBtn");
  btn.textContent = "✓ Código copiado";
  setTimeout(() => btn.textContent = "Copiar código PIX", 1800);
});

let pollTimer;
function startPolling(id, expiresAt) {
  const end = new Date(expiresAt).getTime();

  const tick = async () => {
    const left = Math.max(0, end - Date.now());
    const sec = Math.floor(left / 1000);
    document.getElementById("timer").textContent =
      String(Math.floor(sec/60)).padStart(2,"0") + ":" + String(sec%60).padStart(2,"0");

    if (left <= 0) {
      clearInterval(pollTimer);
      document.getElementById("pixError").textContent = "Esta cobrança expirou. Volte e gere um novo PIX.";
      return;
    }

    try {
      const r = await fetch(`${API_BASE}/charge/${encodeURIComponent(id)}`);
      const j = await r.json();
      if (j.ok && j.charge.status === "paid") {
        clearInterval(pollTimer);
        showSuccess(j.charge);
        return;
      }
      if (j.ok && ["expired","failed"].includes(j.charge.status)) {
        clearInterval(pollTimer);
        document.getElementById("pixError").textContent = "Esta cobrança não está mais disponível.";
      }
    } catch (_) {}
  };

  tick();
  pollTimer = setInterval(tick, 3000);
}

function showSuccess(charge) {
  document.getElementById("stepPix").hidden = true;
  document.getElementById("stepSuccess").hidden = false;

  const delivery = document.getElementById("delivery");
  if (key === "call") {
    delivery.innerHTML = "<p class='muted'>Pagamento confirmado. Entre em contato para combinar o atendimento.</p>";
  } else {
    delivery.innerHTML = "<p class='muted'>Pagamento confirmado. O conteúdo pode ser entregue pelo canal de atendimento configurado por você.</p>";
  }
}