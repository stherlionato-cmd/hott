const products = {
  content: { name: "5 fotos + 3 vídeos", price: 10 },
  preview: { name: "Prévia de 1 min", price: 5 },
  call: { name: "Chamada", price: 15 }
};

document.querySelectorAll(".product").forEach(btn => {
  btn.addEventListener("click", () => {
    const product = btn.dataset.product;
    const url = new URL("checkout.html", location.href);
    url.searchParams.set("product", product);
    location.href = url.toString();
  });
});