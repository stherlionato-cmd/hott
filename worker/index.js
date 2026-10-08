const PRODUCTS = {
  content: { name: "5 fotos + 3 vídeos", amount_cents: 1000 },
  preview: { name: "Prévia de 1 min", amount_cents: 500 },
  call: { name: "Chamada", amount_cents: 1500 }
};

const LARANJINHA_URL = "https://mqvdjjbkjglaimbnpcer.supabase.co/functions/v1/api-proxy";

function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": allowed === "*" ? "*" : (origin === allowed ? origin : allowed),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(data, status=200, origin="", env={}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"Content-Type":"application/json", ...corsHeaders(origin, env)}
  });
}

function cleanText(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validCPF(cpf) {
  cpf = String(cpf).replace(/\D/g,"");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i=0;i<9;i++) sum += Number(cpf[i]) * (10-i);
  let d1 = (sum*10)%11; if (d1===10) d1=0;
  if (d1 !== Number(cpf[9])) return false;
  sum = 0;
  for (let i=0;i<10;i++) sum += Number(cpf[i]) * (11-i);
  let d2 = (sum*10)%11; if (d2===10) d2=0;
  return d2 === Number(cpf[10]);
}

async function laranjinha(path, options, env) {
  const headers = new Headers(options?.headers || {});
  headers.set("X-API-Key", env.LARANJINHA_SECRET_KEY);
  headers.set("Content-Type", "application/json");
  return fetch(`${LARANJINHA_URL}${path}`, {...options, headers});
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, {status:204, headers:corsHeaders(origin, env)});
    }

    const url = new URL(request.url);

    try {
      if (request.method === "POST" && url.pathname === "/create-charge") {
        const body = await request.json();
        const product = PRODUCTS[body.product];
        const name = cleanText(body.name, 100);
        const email = cleanText(body.email, 150).toLowerCase();
        const document = String(body.document || "").replace(/\D/g,"");

        if (!product) return json({ok:false,error:"Produto inválido."},400,origin,env);
        if (name.length < 2) return json({ok:false,error:"Informe seu nome."},400,origin,env);
        if (!validEmail(email)) return json({ok:false,error:"E-mail inválido."},400,origin,env);
        if (!validCPF(document)) return json({ok:false,error:"CPF inválido."},400,origin,env);

        const orderId = crypto.randomUUID();

        const payload = {
          amount_cents: product.amount_cents,
          description: `Pedido ${orderId} - ${product.name}`,
          payer: {name, email, document},
          metadata: {order_id: orderId, product_id: body.product}
        };

        const response = await laranjinha("/charges", {
          method:"POST",
          body:JSON.stringify(payload)
        }, env);

        const result = await response.json();

        if (!response.ok || !result.charge) {
          return json({ok:false,error:result?.error || "Erro ao criar cobrança."},502,origin,env);
        }

        return json({ok:true, charge: {
          id: result.charge.id,
          status: result.charge.status,
          amount_cents: result.charge.amount_cents,
          qr_code: result.charge.qr_code,
          qr_code_image: result.charge.qr_code_image,
          expires_at: result.charge.expires_at
        }},201,origin,env);
      }

      if (request.method === "GET" && url.pathname.startsWith("/charge/")) {
        const id = decodeURIComponent(url.pathname.split("/").pop() || "");
        if (!/^[0-9a-fA-F-]{20,}$/.test(id)) {
          return json({ok:false,error:"Cobrança inválida."},400,origin,env);
        }

        const response = await laranjinha(`/charges/${encodeURIComponent(id)}`, {
          method:"GET"
        }, env);

        const result = await response.json();
        if (!response.ok || !result.charge) {
          return json({ok:false,error:result?.error || "Cobrança não encontrada."},response.status,origin,env);
        }

        return json({ok:true, charge:{
          id:result.charge.id,
          status:result.charge.status,
          amount_cents:result.charge.amount_cents,
          expires_at:result.charge.expires_at
        }},200,origin,env);
      }

      return json({ok:false,error:"Rota não encontrada."},404,origin,env);
    } catch (error) {
      return json({ok:false,error:"Erro interno."},500,origin,env);
    }
  }
};