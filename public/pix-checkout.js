(function () {
  "use strict";

  const STYLE = `
  .pix-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
  .pix-modal{background:#fff;border-radius:14px;max-width:440px;width:100%;max-height:95vh;overflow-y:auto;padding:24px;position:relative;color:#111}
  .pix-close{position:absolute;top:10px;right:14px;background:none;border:0;font-size:26px;cursor:pointer;color:#888;line-height:1}
  .pix-modal h3{margin:0 0 4px;font-size:20px;font-weight:700}
  .pix-modal p.sub{margin:0 0 18px;color:#666;font-size:14px}
  .pix-field{display:block;margin-bottom:12px}
  .pix-field label{display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px}
  .pix-field input{width:100%;padding:11px 12px;border:1px solid #d0d0d0;border-radius:8px;font-size:15px;box-sizing:border-box}
  .pix-field input:focus{outline:none;border-color:#ec4899}
  .pix-btn{display:block;width:100%;padding:13px;background:#ec4899;color:#fff;border:0;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;margin-top:8px}
  .pix-btn:disabled{opacity:.6;cursor:not-allowed}
  .pix-err{color:#dc2626;font-size:13px;margin:8px 0;text-align:center}
  .pix-qr{text-align:center}
  .pix-qr img{width:240px;height:240px;border:1px solid #eee;border-radius:8px;margin:8px auto}
  .pix-amount{font-size:22px;font-weight:700;color:#ec4899;text-align:center;margin:4px 0 2px}
  .pix-plan{text-align:center;color:#666;font-size:14px;margin-bottom:14px}
  .pix-copy{display:flex;gap:6px;margin:10px 0}
  .pix-copy input{flex:1;padding:9px;border:1px solid #ddd;border-radius:6px;font-size:11px;font-family:monospace;background:#f7f7f7}
  .pix-copy button{padding:9px 14px;background:#111;color:#fff;border:0;border-radius:6px;font-weight:600;cursor:pointer;white-space:nowrap}
  .pix-status{text-align:center;padding:10px;border-radius:8px;background:#fef3c7;color:#92400e;font-size:13px;margin-top:10px;font-weight:600}
  .pix-status.ok{background:#d1fae5;color:#065f46}
  .pix-status.err{background:#fee2e2;color:#991b1b}
  .pix-spin{display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:pix-spin .8s linear infinite;vertical-align:middle;margin-right:6px}
  @keyframes pix-spin{to{transform:rotate(360deg)}}
  .pix-steps{font-size:12px;color:#666;background:#f7f7f7;border-radius:8px;padding:10px;margin-top:12px;line-height:1.5}
  `;

  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.appendChild(style);

  function fmt(v) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function maskCpf(v) {
    return v.replace(/\D/g, "").slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  function maskPhone(v) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
  }

  function openModal(plan, amount) {
    const overlay = document.createElement("div");
    overlay.className = "pix-overlay";
    overlay.innerHTML = `
      <div class="pix-modal" role="dialog">
        <button class="pix-close" aria-label="Fechar">&times;</button>
        <div class="pix-content"></div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    const close = () => {
      overlay.remove();
      document.body.style.overflow = "";
      if (overlay._poll) clearInterval(overlay._poll);
    };
    overlay.querySelector(".pix-close").onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    renderForm(overlay, plan, amount);
  }

  function renderForm(overlay, plan, amount) {
    const c = overlay.querySelector(".pix-content");
    c.innerHTML = `
      <h3>Pagamento via PIX</h3>
      <p class="sub">Preencha seus dados para gerar o QR Code</p>
      <div class="pix-amount">${fmt(amount)}</div>
      <div class="pix-plan">Plano: <strong>${plan}</strong></div>
      <form class="pix-form">
        <label class="pix-field"><label>Nome completo</label><input name="name" required autocomplete="name" placeholder="Seu nome"></label>
        <label class="pix-field"><label>CPF</label><input name="cpf" required inputmode="numeric" placeholder="000.000.000-00"></label>
        <label class="pix-field"><label>E-mail</label><input name="email" type="email" required autocomplete="email" placeholder="voce@email.com"></label>
        <label class="pix-field"><label>Telefone</label><input name="phone" required inputmode="numeric" placeholder="(11) 99999-9999"></label>
        <div class="pix-err" style="display:none"></div>
        <button class="pix-btn" type="submit">Gerar PIX</button>
      </form>`;
    const form = c.querySelector("form");
    const err = c.querySelector(".pix-err");
    form.cpf.addEventListener("input", (e) => { e.target.value = maskCpf(e.target.value); });
    form.phone.addEventListener("input", (e) => { e.target.value = maskPhone(e.target.value); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.style.display = "none";
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.innerHTML = '<span class="pix-spin"></span> Gerando...';
      try {
        const res = await fetch("/api/pix/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            description: `Assinatura ${plan}`,
            client: {
              name: form.name.value.trim(),
              cpf: form.cpf.value,
              email: form.email.value.trim(),
              phone: form.phone.value,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Erro ao gerar PIX");
        renderQr(overlay, plan, amount, data);
      } catch (e2) {
        err.textContent = e2.message;
        err.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Gerar PIX";
      }
    });
  }

  function renderQr(overlay, plan, amount, data) {
    const c = overlay.querySelector(".pix-content");
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.pix_code)}`;
    c.innerHTML = `
      <h3>Pague com PIX</h3>
      <p class="sub">Escaneie o QR Code ou use o copia-e-cola</p>
      <div class="pix-amount">${fmt(amount)}</div>
      <div class="pix-plan">Plano: <strong>${plan}</strong></div>
      <div class="pix-qr"><img src="${qrUrl}" alt="QR Code PIX"></div>
      <div class="pix-copy">
        <input readonly value="${data.pix_code.replace(/"/g, "&quot;")}">
        <button type="button">Copiar</button>
      </div>
      <div class="pix-status"><span class="pix-spin"></span> Aguardando pagamento...</div>
      <div class="pix-steps">
        1. Abra o app do seu banco<br>
        2. Escolha pagar com PIX → Copia e Cola ou QR Code<br>
        3. Confirme o pagamento — a confirmação aqui é automática
      </div>`;
    const copyBtn = c.querySelector(".pix-copy button");
    const copyInput = c.querySelector(".pix-copy input");
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(data.pix_code);
        copyBtn.textContent = "Copiado!";
        setTimeout(() => (copyBtn.textContent = "Copiar"), 2000);
      } catch {
        copyInput.select();
        document.execCommand("copy");
      }
    };

    const statusEl = c.querySelector(".pix-status");
    let stops = 0;
    overlay._poll = setInterval(async () => {
      stops++;
      if (stops > 240) { clearInterval(overlay._poll); return; } // ~20min
      try {
        const r = await fetch(`/api/pix/status/${encodeURIComponent(data.identifier)}`);
        const j = await r.json();
        if (j.status === "completed") {
          clearInterval(overlay._poll);
          statusEl.className = "pix-status ok";
          statusEl.innerHTML = "✓ Pagamento confirmado! Liberando acesso...";
        } else if (j.status === "failed" || j.status === "refunded") {
          clearInterval(overlay._poll);
          statusEl.className = "pix-status err";
          statusEl.textContent = "Pagamento não concluído. Tente novamente.";
        }
      } catch (e) { /* keep polling */ }
    }, 5000);
  }

  window.abrirModalPix = function (plan, amount) {
    openModal(String(plan), Number(amount));
  };
})();
