import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const ADMIN_USER = "guilherme10";
const ADMIN_PASS = "14774113";
const STORAGE_KEY = "privacy_admin_models_v1";
const SALES_KEY = "privacy_admin_sales_v1";
const SESSION_KEY = "privacy_admin_session";

type Plan = { label: string; price: string };
type Model = {
  id: string;
  name: string;
  slug: string;
  bio: string;
  avatar: string; // dataURL
  banner: string; // dataURL
  plans: [Plan, Plan, Plan];
  syncpayKey: string;
};
type Sale = {
  id: string;
  modelId: string;
  date: string;
  buyer: string;
  plan: string;
  amount: number;
  status: "pago" | "pendente" | "expirado";
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function loadModels(): Model[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveModels(m: Model[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
}
function loadSales(): Sale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SALES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(SESSION_KEY) === "1");
    setHydrated(true);
  }, []);

  if (!hydrated) return null;
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;
  return <Dashboard onLogout={() => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false); }} />;
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onSuccess();
    } else setErr("Credenciais inválidas");
  }

  return (
    <div style={styles.loginWrap}>
      <form onSubmit={submit} style={styles.loginCard}>
        <h1 style={{ margin: 0, fontSize: 24, color: "#fff" }}>Painel Admin</h1>
        <p style={{ color: "#9aa", marginTop: 4, marginBottom: 20, fontSize: 14 }}>Acesso restrito</p>
        <label style={styles.label}>Usuário</label>
        <input style={styles.input} value={u} onChange={(e) => setU(e.target.value)} autoFocus />
        <label style={styles.label}>Senha</label>
        <input style={styles.input} type="password" value={p} onChange={(e) => setP(e.target.value)} />
        {err && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 10 }}>{err}</div>}
        <button type="submit" style={styles.primaryBtn}>Entrar</button>
      </form>
    </div>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [models, setModels] = useState<Model[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [editing, setEditing] = useState<Model | null>(null);
  const [tab, setTab] = useState<"models" | "sales">("models");

  useEffect(() => {
    setModels(loadModels());
    setSales(loadSales());
  }, []);

  function persist(next: Model[]) {
    setModels(next);
    saveModels(next);
  }

  function newModel() {
    const m: Model = {
      id: uid(),
      name: "Nova modelo",
      slug: "nova-modelo",
      bio: "",
      avatar: "",
      banner: "",
      plans: [
        { label: "1 mês", price: "29,90" },
        { label: "3 meses", price: "69,90" },
        { label: "12 meses", price: "199,90" },
      ],
      syncpayKey: "",
    };
    setEditing(m);
  }

  function saveModel(m: Model) {
    const exists = models.find((x) => x.id === m.id);
    const next = exists ? models.map((x) => (x.id === m.id ? m : x)) : [...models, m];
    persist(next);
    setEditing(null);
  }

  function deleteModel(id: string) {
    if (!confirm("Excluir esta modelo?")) return;
    persist(models.filter((m) => m.id !== id));
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/m/${slug}`;
    navigator.clipboard.writeText(url);
    alert("Link copiado: " + url);
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <h1 style={{ margin: 0, fontSize: 20, color: "#fff" }}>🔐 Painel Admin</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setTab("models")} style={tab === "models" ? styles.tabActive : styles.tab}>Modelos</button>
          <button onClick={() => setTab("sales")} style={tab === "sales" ? styles.tabActive : styles.tab}>Relatório</button>
          <button onClick={onLogout} style={styles.logoutBtn}>Sair</button>
        </div>
      </header>

      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        {editing ? (
          <ModelForm
            model={editing}
            onCancel={() => setEditing(null)}
            onSave={saveModel}
            onDelete={() => { deleteModel(editing.id); setEditing(null); }}
          />
        ) : tab === "models" ? (
          <ModelsList
            models={models}
            onAdd={newModel}
            onEdit={(m) => setEditing(m)}
            onCopy={copyLink}
          />
        ) : (
          <SalesReport sales={sales} models={models} />
        )}
      </main>
    </div>
  );
}

function ModelsList({
  models, onAdd, onEdit, onCopy,
}: {
  models: Model[];
  onAdd: () => void;
  onEdit: (m: Model) => void;
  onCopy: (slug: string) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ color: "#fff", margin: 0 }}>Modelos ({models.length})</h2>
        <button onClick={onAdd} style={styles.primaryBtn}>+ Adicionar nova modelo</button>
      </div>
      {models.length === 0 && (
        <div style={styles.empty}>Nenhuma modelo cadastrada. Clique em "Adicionar nova modelo" para começar.</div>
      )}
      <div style={styles.grid}>
        {models.map((m) => (
          <div key={m.id} style={styles.card}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {m.avatar ? (
                <img src={m.avatar} alt={m.name} style={styles.avatar} />
              ) : (
                <div style={{ ...styles.avatar, background: "#333", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
                  {m.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>{m.name}</div>
                <div style={{ color: "#7ab", fontSize: 13 }}>@{m.slug}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => onEdit(m)} style={{ ...styles.secondaryBtn, flex: 1 }}>Editar</button>
              <button onClick={() => onCopy(m.slug)} style={{ ...styles.secondaryBtn, flex: 1 }}>Copiar link</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelForm({
  model, onCancel, onSave, onDelete,
}: {
  model: Model;
  onCancel: () => void;
  onSave: (m: Model) => void;
  onDelete: () => void;
}) {
  const [m, setM] = useState<Model>(model);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof Model>(k: K, v: Model[K]) {
    setM((prev) => ({ ...prev, [k]: v }));
  }

  async function onPic(e: React.ChangeEvent<HTMLInputElement>, field: "avatar" | "banner") {
    const f = e.target.files?.[0];
    if (!f) return;
    const data = await fileToDataUrl(f);
    set(field, data);
  }

  function updatePlan(idx: number, field: "label" | "price", value: string) {
    const plans = m.plans.map((p, i) => (i === idx ? { ...p, [field]: value } : p)) as Model["plans"];
    set("plans", plans);
  }

  function slugify(s: string) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ color: "#fff", margin: 0 }}>Editar modelo</h2>
        <button onClick={onCancel} style={styles.secondaryBtn}>← Voltar</button>
      </div>

      <div style={styles.formCard}>
        {/* Banner */}
        <label style={styles.label}>Foto de banner (4:1)</label>
        <div
          onClick={() => bannerRef.current?.click()}
          style={{
            ...styles.bannerPreview,
            background: m.banner ? `url(${m.banner}) center/cover` : "#222",
          }}
        >
          {!m.banner && <span style={{ color: "#888" }}>Clique para enviar banner</span>}
        </div>
        <input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => onPic(e, "banner")} />

        {/* Avatar */}
        <label style={{ ...styles.label, marginTop: 16 }}>Foto de perfil</label>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            onClick={() => avatarRef.current?.click()}
            style={{
              width: 96, height: 96, borderRadius: "50%", cursor: "pointer",
              background: m.avatar ? `url(${m.avatar}) center/cover` : "#222",
              border: "2px dashed #444", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#888", fontSize: 12,
            }}
          >
            {!m.avatar && "Enviar"}
          </div>
          <button type="button" onClick={() => avatarRef.current?.click()} style={styles.secondaryBtn}>Escolher foto</button>
          <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => onPic(e, "avatar")} />
        </div>

        <label style={{ ...styles.label, marginTop: 16 }}>Nome</label>
        <input style={styles.input} value={m.name} onChange={(e) => { set("name", e.target.value); if (!model.slug) set("slug", slugify(e.target.value)); }} />

        <label style={styles.label}>Username (@slug da URL)</label>
        <input style={styles.input} value={m.slug} onChange={(e) => set("slug", slugify(e.target.value))} placeholder="ex: ana-bela" />
        <div style={{ color: "#7ab", fontSize: 12, marginTop: 4 }}>URL: /m/{m.slug || "..."}</div>

        <label style={{ ...styles.label, marginTop: 12 }}>Bio</label>
        <textarea style={{ ...styles.input, minHeight: 100, resize: "vertical", fontFamily: "inherit" }} value={m.bio} onChange={(e) => set("bio", e.target.value)} />

        <label style={{ ...styles.label, marginTop: 16 }}>Planos</label>
        <div style={{ display: "grid", gap: 10 }}>
          {m.plans.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10 }}>
              <input style={styles.input} placeholder={`Plano ${i + 1} (ex: 1 mês)`} value={p.label} onChange={(e) => updatePlan(i, "label", e.target.value)} />
              <input style={styles.input} placeholder="R$ 0,00" value={p.price} onChange={(e) => updatePlan(i, "price", e.target.value)} />
            </div>
          ))}
        </div>

        <label style={{ ...styles.label, marginTop: 16 }}>Chave API SyncPay desta modelo</label>
        <input style={styles.input} value={m.syncpayKey} onChange={(e) => set("syncpayKey", e.target.value)} placeholder="client_id:client_secret" />

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <button type="button" onClick={onDelete} style={styles.dangerBtn}>Excluir modelo</button>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onCancel} style={styles.secondaryBtn}>Cancelar</button>
            <button type="button" onClick={() => onSave(m)} style={styles.primaryBtn}>Salvar alterações</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SalesReport({ sales, models }: { sales: Sale[]; models: Model[] }) {
  const [modelId, setModelId] = useState<string>("all");
  const filtered = useMemo(() => modelId === "all" ? sales : sales.filter((s) => s.modelId === modelId), [sales, modelId]);
  const total = filtered.filter((s) => s.status === "pago").reduce((sum, s) => sum + s.amount, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ color: "#fff", margin: 0 }}>Relatório de vendas</h2>
        <select style={styles.input as React.CSSProperties} value={modelId} onChange={(e) => setModelId(e.target.value)}>
          <option value="all">Todas as modelos</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div style={styles.formCard}>
        <div style={{ display: "flex", gap: 24, marginBottom: 16, color: "#fff" }}>
          <div><div style={{ color: "#7ab", fontSize: 12 }}>Total recebido</div><div style={{ fontSize: 22, fontWeight: 700 }}>R$ {total.toFixed(2).replace(".", ",")}</div></div>
          <div><div style={{ color: "#7ab", fontSize: 12 }}>Vendas</div><div style={{ fontSize: 22, fontWeight: 700 }}>{filtered.length}</div></div>
        </div>

        {filtered.length === 0 ? (
          <div style={styles.empty}>Nenhuma venda registrada ainda.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Data</th>
                  <th style={styles.th}>Comprador</th>
                  <th style={styles.th}>Plano</th>
                  <th style={styles.th}>Valor</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td style={styles.td}>{new Date(s.date).toLocaleString("pt-BR")}</td>
                    <td style={styles.td}>{s.buyer}</td>
                    <td style={styles.td}>{s.plan}</td>
                    <td style={styles.td}>R$ {s.amount.toFixed(2).replace(".", ",")}</td>
                    <td style={styles.td}><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Sale["status"] }) {
  const map = {
    pago: { bg: "#0a3", label: "Pago" },
    pendente: { bg: "#b80", label: "Pendente" },
    expirado: { bg: "#a22", label: "Expirado" },
  } as const;
  const s = map[status];
  return <span style={{ background: s.bg, color: "#fff", padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{s.label}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  loginWrap: { minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, -apple-system, sans-serif" },
  loginCard: { width: "100%", maxWidth: 380, background: "#15151c", padding: 32, borderRadius: 16, border: "1px solid #2a2a35", display: "flex", flexDirection: "column" },
  shell: { minHeight: "100vh", background: "#0a0a0f", fontFamily: "system-ui, -apple-system, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", background: "#15151c", borderBottom: "1px solid #2a2a35" },
  tab: { background: "transparent", color: "#aab", border: "1px solid #2a2a35", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  tabActive: { background: "#e91e63", color: "#fff", border: "1px solid #e91e63", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  logoutBtn: { background: "transparent", color: "#aab", border: "1px solid #2a2a35", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  label: { display: "block", color: "#aab", fontSize: 13, marginTop: 8, marginBottom: 6, fontWeight: 500 },
  input: { width: "100%", background: "#0a0a0f", color: "#fff", border: "1px solid #2a2a35", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" },
  primaryBtn: { background: "#e91e63", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, marginTop: 12 },
  secondaryBtn: { background: "#2a2a35", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 },
  dangerBtn: { background: "transparent", color: "#ff6b6b", border: "1px solid #ff6b6b", padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 },
  card: { background: "#15151c", border: "1px solid #2a2a35", borderRadius: 12, padding: 16 },
  avatar: { width: 56, height: 56, borderRadius: "50%", objectFit: "cover" },
  empty: { color: "#777", textAlign: "center", padding: 40, background: "#15151c", border: "1px dashed #2a2a35", borderRadius: 12 },
  formCard: { background: "#15151c", border: "1px solid #2a2a35", borderRadius: 12, padding: 24 },
  bannerPreview: { width: "100%", aspectRatio: "4/1", borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #444" },
  table: { width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: 14 },
  th: { textAlign: "left", padding: "10px 12px", background: "#0a0a0f", color: "#7ab", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  td: { padding: "12px", borderTop: "1px solid #2a2a35" },
};
