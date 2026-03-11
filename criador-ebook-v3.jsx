import { useState } from "react";

const API_URL = "https://api.anthropic.com/v1/messages";

const TONS = [
  { value: "motivacional", label: "🔥 Motivacional" },
  { value: "didático", label: "📚 Didático" },
  { value: "técnico", label: "⚙️ Técnico" },
  { value: "inspirador", label: "✨ Inspirador" },
  { value: "prático", label: "🎯 Prático" },
  { value: "conversacional", label: "💬 Conversacional" },
];

const PUBLICOS = [
  "Adultos 25–45 anos",
  "Profissionais de saúde",
  "Empreendedores",
  "Estudantes",
  "Idosos 50–75 anos",
  "Público geral",
  "Personalizado...",
];

function Spinner({ size = 20 }) {
  return (
    <div style={{
      display: "inline-block", width: size, height: size,
      border: `${size > 30 ? 4 : 3}px solid rgba(255,255,255,0.15)`,
      borderTop: `${size > 30 ? 4 : 3}px solid #f0c040`,
      borderRadius: "50%", animation: "spin 0.8s linear infinite",
      verticalAlign: "middle", flexShrink: 0,
    }} />
  );
}

async function chamarIAComBusca(prompt, sistema) {
  const resp = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: sistema,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await resp.json();
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
}

// ── Monta o texto completo do e-book como string ──────────────────────────
function ebookParaTexto(ebook) {
  let txt = `${ebook.titulo}\n`;
  if (ebook.subtitulo) txt += `${ebook.subtitulo}\n`;
  txt += `\nPúblico: ${ebook.meta.publico} | Tom: ${ebook.meta.tom} | Gerado em: ${ebook.meta.geradoEm}\n`;
  txt += `\n${"─".repeat(60)}\nINTRODUÇÃO\n${"─".repeat(60)}\n${ebook.intro}\n`;
  ebook.capitulos.forEach((cap, i) => {
    txt += `\n${"─".repeat(60)}\nCAPÍTULO ${i + 1}: ${cap.titulo}\n${"─".repeat(60)}\n${cap.conteudo}\n`;
  });
  txt += `\n${"─".repeat(60)}\nCONCLUSÃO\n${"─".repeat(60)}\n${ebook.conclusao}\n`;
  return txt;
}

// ── Monta outline para o Gamma ────────────────────────────────────────────
function ebookParaOutlineGamma(ebook) {
  const pages = [
    { title: "Introdução", description: ebook.intro.slice(0, 300).replace(/\n/g, " ") + "..." },
    ...ebook.capitulos.map((cap, i) => ({
      title: `Capítulo ${i + 1}: ${cap.titulo}`,
      description: cap.conteudo.slice(0, 300).replace(/\n/g, " ") + "...",
    })),
    { title: "Conclusão", description: ebook.conclusao.slice(0, 300).replace(/\n/g, " ") + "..." },
  ];
  return pages;
}

export default function CriadorEbook() {
  const [aba, setAba] = useState(0);
  const [config, setConfig] = useState({
    titulo: "", tema: "", publico: "Adultos 25–45 anos", publicoCustom: "",
    tom: "motivacional", capitulos: 5, subtitulo: "", descricaoExtra: "",
  });
  const [ebook, setEbook] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState({ texto: "", etapa: 0, total: 0 });
  const [editando, setEditando] = useState(null);
  const [textoEditavel, setTextoEditavel] = useState("");
  const [erro, setErro] = useState("");

  // Export states
  const [exportStatus, setExportStatus] = useState(null); // null | 'loading' | 'done' | 'error'
  const [exportMsg, setExportMsg] = useState("");
  const [exportLink, setExportLink] = useState("");
  const [exportDestino, setExportDestino] = useState(null); // 'gamma' | 'canva' | 'txt' | 'md'
  const [copied, setCopied] = useState(false);

  const publicoFinal = config.publico === "Personalizado..." ? config.publicoCustom : config.publico;

  const sistemaBase = `Você é um escritor profissional de e-books científicos em português brasileiro.
Escreva de forma ${config.tom}, clara e acessível para ${publicoFinal}.
REGRAS OBRIGATÓRIAS:
1. Baseie TODO o conteúdo em evidências científicas — cite artigos, pesquisas, diretrizes de organizações como OMS, ACSM, AHA, SBD, Ministério da Saúde, etc.
2. Ao citar, use o formato: (Autor/Organização, Ano) ou [Fonte: Nome da Organização, Ano].
3. No final de cada seção, inclua um bloco "📚 Referências:" com as fontes usadas, numeradas.
4. Não invente dados. Se não tiver certeza, pesquise antes de afirmar.
5. Escreva em parágrafos corridos e naturais, sem # ou ** em excesso.`;

  async function gerarEbook() {
    if (!config.titulo.trim() || !config.tema.trim()) {
      setErro("Preencha pelo menos o título e o tema do e-book."); return;
    }
    setErro(""); setGerando(true); setAba(1);
    const totalEtapas = 2 + config.capitulos;
    try {
      setProgresso({ texto: "🔎 Pesquisando fontes científicas para a introdução...", etapa: 1, total: totalEtapas });
      const intro = await chamarIAComBusca(
        `Pesquise fontes científicas e escreva uma introdução completa (3 parágrafos) para o e-book "${config.titulo}" sobre "${config.tema}". Público: ${publicoFinal}. Tom: ${config.tom}. ${config.descricaoExtra ? "Contexto: " + config.descricaoExtra : ""} Cite organizações como OMS, ACSM, AHA. Inclua "📚 Referências:" ao final.`,
        sistemaBase
      );
      setProgresso({ texto: "📑 Estruturando capítulos...", etapa: 1, total: totalEtapas });
      const titulosRaw = await chamarIAComBusca(
        `Sugira exatamente ${config.capitulos} títulos de capítulos para e-book sobre "${config.tema}" para ${publicoFinal}. APENAS os títulos, um por linha, sem numeração.`,
        "Você é especialista em estruturação de e-books. Retorne apenas os títulos, um por linha."
      );
      const titulosCapitulos = titulosRaw.split("\n")
        .map(t => t.replace(/^\d+[\.\)]\s*/, "").trim())
        .filter(t => t.length > 3).slice(0, config.capitulos);

      const caps = [];
      for (let i = 0; i < titulosCapitulos.length; i++) {
        setProgresso({ texto: `🔬 Pesquisando ciência: "${titulosCapitulos[i]}"...`, etapa: i + 2, total: totalEtapas });
        const conteudo = await chamarIAComBusca(
          `Pesquise e escreva o capítulo "${titulosCapitulos[i]}" para o e-book "${config.titulo}" sobre "${config.tema}". Público: ${publicoFinal}. Tom: ${config.tom}. 4 parágrafos com evidências científicas reais. Cite estudos e organizações. Inclua "📚 Referências:" ao final.`,
          sistemaBase
        );
        caps.push({ titulo: titulosCapitulos[i], conteudo });
      }
      setProgresso({ texto: "✍️ Escrevendo conclusão...", etapa: totalEtapas, total: totalEtapas });
      const conclusao = await chamarIAComBusca(
        `Escreva conclusão científica e motivadora para o e-book "${config.titulo}" sobre "${config.tema}". Público: ${publicoFinal}. Tom: ${config.tom}. 3 parágrafos. Cite ao menos 2 organizações. Inclua "📚 Referências:" ao final.`,
        sistemaBase
      );
      setEbook({
        titulo: config.titulo, subtitulo: config.subtitulo,
        intro, capitulos: caps, conclusao,
        meta: { publico: publicoFinal, tom: config.tom, geradoEm: new Date().toLocaleDateString("pt-BR") }
      });
      setProgresso({ texto: "", etapa: 0, total: 0 });
    } catch (e) { setErro("Erro ao gerar: " + (e.message || "Tente novamente.")); }
    setGerando(false);
  }

  function iniciarEdicao(tipo, index = null) {
    setEditando({ tipo, index });
    if (tipo === "intro") setTextoEditavel(ebook.intro);
    else if (tipo === "conclusao") setTextoEditavel(ebook.conclusao);
    else if (tipo === "capitulo") setTextoEditavel(ebook.capitulos[index].conteudo);
  }

  function salvarEdicao() {
    const novo = { ...ebook, capitulos: ebook.capitulos.map(c => ({ ...c })) };
    if (editando.tipo === "intro") novo.intro = textoEditavel;
    else if (editando.tipo === "conclusao") novo.conclusao = textoEditavel;
    else if (editando.tipo === "capitulo") novo.capitulos[editando.index].conteudo = textoEditavel;
    setEbook(novo); setEditando(null);
  }

  async function reescreverComIA(tipo, index = null) {
    const original = tipo === "intro" ? ebook.intro : tipo === "conclusao" ? ebook.conclusao : ebook.capitulos[index].conteudo;
    setGerando(true);
    setProgresso({ texto: "🔄 Reescrevendo com novas fontes científicas...", etapa: 1, total: 1 });
    try {
      const novo = await chamarIAComBusca(
        `Reescreva com embasamento científico mais sólido para o e-book "${ebook.titulo}". Tom: ${config.tom}. Público: ${publicoFinal}. Pesquise fontes recentes. Inclua "📚 Referências:" ao final.\n\nTexto original:\n${original}`,
        sistemaBase
      );
      const novoEbook = { ...ebook, capitulos: ebook.capitulos.map(c => ({ ...c })) };
      if (tipo === "intro") novoEbook.intro = novo;
      else if (tipo === "conclusao") novoEbook.conclusao = novo;
      else novoEbook.capitulos[index].conteudo = novo;
      setEbook(novoEbook);
    } catch (e) { setErro("Erro ao reescrever."); }
    setGerando(false); setProgresso({ texto: "", etapa: 0, total: 0 });
  }

  // ── EXPORT FUNCTIONS ──────────────────────────────────────────────────

  function exportarTexto(formato) {
    if (!ebook) return;
    const texto = ebookParaTexto(ebook);
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ebook.titulo}.${formato}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copiarTexto() {
    if (!ebook) return;
    navigator.clipboard.writeText(ebookParaTexto(ebook));
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }

  // Gamma: monta URL de criação com o conteúdo como documento
  function abrirNoGamma() {
    if (!ebook) return;
    setExportDestino("gamma");
    setExportStatus("info");
    setExportMsg("");
  }

  // Canva: abre o Canva Doc com instruções
  function abrirNoCanva() {
    if (!ebook) return;
    setExportDestino("canva");
    setExportStatus("info");
    setExportMsg("");
  }

  function copiarParaDestino() {
    if (!ebook) return;
    const texto = ebookParaTexto(ebook);
    navigator.clipboard.writeText(texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    if (exportDestino === "gamma") {
      setTimeout(() => window.open("https://gamma.app/create", "_blank"), 600);
    } else if (exportDestino === "canva") {
      setTimeout(() => window.open("https://www.canva.com/create/docs/", "_blank"), 600);
    }
  }

  const abas = ["⚙️ Configurar", "📖 Visualizar", "✏️ Editar", "🚀 Exportar"];
  const pct = progresso.total > 0 ? Math.round((progresso.etapa / progresso.total) * 100) : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #080c14 0%, #0f1923 50%, #0a1020 100%)",
      fontFamily: "'Georgia', serif", color: "#e0d8c8",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease both; }
        .btn-h:hover { filter: brightness(1.18); transform: translateY(-1px); }
        .btn-h { transition: all 0.2s; cursor: pointer; }
        .nav-h:hover { background: rgba(240,192,64,0.1) !important; }
        textarea:focus, input:focus, select:focus { outline: 2px solid rgba(240,192,64,0.6) !important; outline-offset: 2px; }
        .ref-bloco { background: rgba(240,192,64,0.05); border-left: 3px solid #f0c040; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-top: 14px; font-size: 13px; color: #999; line-height: 1.7; }
        .export-card:hover { border-color: rgba(240,192,64,0.5) !important; background: rgba(240,192,64,0.06) !important; transform: translateY(-2px); }
        .export-card { transition: all 0.2s; cursor: pointer; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "rgba(0,0,0,0.5)", borderBottom: "1px solid rgba(240,192,64,0.15)", padding: "20px 32px", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 28 }}>📗</div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#f0c040", textTransform: "uppercase", marginBottom: 2 }}>E-Book Studio</div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>Criador de E-Book com IA</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Badge color="#4ade80" bg="rgba(56,189,120,0.1)" border="rgba(56,189,120,0.3)">🔬 Ciência</Badge>
          <Badge color="#60a5fa" bg="rgba(96,165,250,0.1)" border="rgba(96,165,250,0.3)">🔎 Busca Web</Badge>
        </div>
      </div>

      {/* ABAS */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.3)", padding: "0 32px" }}>
        {abas.map((nome, i) => (
          <button key={i} className="nav-h" onClick={() => setAba(i)} style={{
            background: aba === i ? "rgba(240,192,64,0.12)" : "transparent",
            color: aba === i ? "#f0c040" : "#555",
            border: "none", borderBottom: aba === i ? "2px solid #f0c040" : "2px solid transparent",
            padding: "13px 22px", fontSize: 13, fontFamily: "inherit",
            cursor: "pointer", letterSpacing: 0.5, transition: "all 0.2s",
          }}>{nome}</button>
        ))}
      </div>

      <div style={{ maxWidth: 840, margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* ERRO */}
        {erro && (
          <div style={{ background: "rgba(220,60,60,0.1)", border: "1px solid rgba(220,60,60,0.3)", borderRadius: 8, padding: "12px 16px", marginBottom: 20, color: "#fc8181", fontSize: 14, display: "flex", gap: 10, alignItems: "center" }}>
            ⚠️ {erro}
            <button onClick={() => setErro("")} style={{ marginLeft: "auto", background: "none", border: "none", color: "#fc8181", cursor: "pointer", fontSize: 18 }}>×</button>
          </div>
        )}

        {/* ════ ABA 0 — CONFIGURAR ════ */}
        {aba === 0 && (
          <div className="fade-up">
            <SectionTitle>Configure seu E-Book</SectionTitle>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>O conteúdo será gerado com busca web e embasamento em fontes científicas verificáveis.</div>
            <div style={{ display: "grid", gap: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                <Campo label="Título *"><input value={config.titulo} onChange={e => setConfig({ ...config, titulo: e.target.value })} placeholder="Ex: Exercício e Saúde Mental" style={inp} /></Campo>
                <Campo label="Subtítulo"><input value={config.subtitulo} onChange={e => setConfig({ ...config, subtitulo: e.target.value })} placeholder="Ex: O que a ciência diz" style={inp} /></Campo>
              </div>
              <Campo label="Tema principal *">
                <textarea value={config.tema} onChange={e => setConfig({ ...config, tema: e.target.value })} placeholder="Descreva o tema. Quanto mais específico, mais precisas serão as fontes..." rows={3} style={{ ...inp, resize: "vertical" }} />
              </Campo>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                <Campo label="Público-alvo">
                  <select value={config.publico} onChange={e => setConfig({ ...config, publico: e.target.value })} style={inp}>
                    {PUBLICOS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Campo>
                <Campo label="Tom">
                  <select value={config.tom} onChange={e => setConfig({ ...config, tom: e.target.value })} style={inp}>
                    {TONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Campo>
              </div>
              {config.publico === "Personalizado..." && (
                <Campo label="Descreva o público"><input value={config.publicoCustom} onChange={e => setConfig({ ...config, publicoCustom: e.target.value })} placeholder="Ex: Fisioterapeutas que atendem idosos" style={inp} /></Campo>
              )}
              <Campo label={`Capítulos: ${config.capitulos}`}>
                <input type="range" min={3} max={10} value={config.capitulos} onChange={e => setConfig({ ...config, capitulos: Number(e.target.value) })} style={{ width: "100%", accentColor: "#f0c040", marginBottom: 4 }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#444" }}>
                  <span>3</span><span style={{ color: "#f0c040", fontWeight: "bold" }}>{config.capitulos} capítulos</span><span>10</span>
                </div>
              </Campo>
              <Campo label="Fontes ou contexto adicional">
                <textarea value={config.descricaoExtra} onChange={e => setConfig({ ...config, descricaoExtra: e.target.value })} placeholder="Ex: Incluir diretrizes da ACSM 2022, focar em adultos sedentários..." rows={3} style={{ ...inp, resize: "vertical" }} />
              </Campo>
            </div>
            <div style={{ marginTop: 20, background: "rgba(56,189,120,0.06)", border: "1px solid rgba(56,189,120,0.18)", borderRadius: 10, padding: "14px 18px", display: "flex", gap: 12 }}>
              <span style={{ fontSize: 20 }}>🔬</span>
              <div>
                <div style={{ color: "#4ade80", fontSize: 11, fontWeight: "bold", marginBottom: 4, letterSpacing: 1 }}>EMBASAMENTO CIENTÍFICO ATIVO</div>
                <div style={{ color: "#666", fontSize: 13, lineHeight: 1.6 }}>A IA pesquisa fontes reais (PubMed, OMS, ACSM, AHA, SBD, Ministério da Saúde…) antes de escrever cada seção. Referências incluídas em cada capítulo.</div>
              </div>
            </div>
            <button className="btn-h" onClick={gerarEbook} disabled={gerando} style={{
              marginTop: 24, width: "100%",
              background: config.titulo && config.tema ? "linear-gradient(135deg, #f0c040, #d97706)" : "rgba(255,255,255,0.04)",
              color: config.titulo && config.tema ? "#0a0a12" : "#333",
              border: "none", borderRadius: 10, padding: "16px",
              fontSize: 16, fontWeight: "bold", fontFamily: "inherit",
              cursor: config.titulo && config.tema ? "pointer" : "not-allowed",
            }}>
              {gerando ? <><Spinner /> Gerando...</> : "✨ Gerar E-Book Científico"}
            </button>
          </div>
        )}

        {/* ════ ABA 1 — VISUALIZAR ════ */}
        {aba === 1 && (
          <div className="fade-up">
            {gerando && (
              <div style={{ textAlign: "center", padding: "50px 20px" }}>
                <Spinner size={52} />
                <div style={{ color: "#f0c040", fontSize: 16, marginTop: 20, marginBottom: 8 }}>{progresso.texto}</div>
                <div style={{ color: "#444", fontSize: 13, marginBottom: 20 }}>Pesquisando fontes científicas e escrevendo com embasamento real...</div>
                {progresso.total > 0 && (
                  <div style={{ maxWidth: 400, margin: "0 auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#444", marginBottom: 6 }}>
                      <span>Progresso</span><span>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #f0c040, #d97706)", transition: "width 0.6s ease", borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#333", marginTop: 8 }}>Etapa {progresso.etapa} de {progresso.total}</div>
                  </div>
                )}
              </div>
            )}
            {!gerando && !ebook && (
              <div style={{ textAlign: "center", padding: "70px 20px", color: "#444" }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>📗</div>
                <div>Configure e gere seu e-book na aba <strong style={{ color: "#f0c040" }}>⚙️ Configurar</strong></div>
              </div>
            )}
            {!gerando && ebook && (
              <div>
                <div style={{ textAlign: "center", marginBottom: 32, padding: "30px 24px", background: "linear-gradient(135deg, rgba(240,192,64,0.07), rgba(217,119,6,0.03))", border: "1px solid rgba(240,192,64,0.18)", borderRadius: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📗</div>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#f0c040", marginBottom: 6, lineHeight: 1.3 }}>{ebook.titulo}</div>
                  {ebook.subtitulo && <div style={{ color: "#888", fontSize: 14, fontStyle: "italic", marginBottom: 14 }}>{ebook.subtitulo}</div>}
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <Badge color="#4ade80" bg="rgba(56,189,120,0.1)" border="rgba(56,189,120,0.3)">🔬 Embasamento Científico</Badge>
                    <Badge color="#93c5fd" bg="rgba(147,197,253,0.08)" border="rgba(147,197,253,0.3)">👥 {ebook.meta.publico}</Badge>
                    <Badge color="#c4b5fd" bg="rgba(196,181,253,0.08)" border="rgba(196,181,253,0.3)">📅 {ebook.meta.geradoEm}</Badge>
                  </div>
                </div>
                {/* Sumário */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "18px 22px", marginBottom: 28 }}>
                  <div style={{ fontSize: 10, letterSpacing: 3, color: "#f0c040", marginBottom: 12, textTransform: "uppercase" }}>Sumário</div>
                  {[{ n: "Intro", t: "Introdução" }, ...ebook.capitulos.map((c, i) => ({ n: i + 1, t: c.titulo })), { n: "★", t: "Conclusão" }].map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 14, fontSize: 13, marginBottom: 5 }}>
                      <span style={{ color: "#f0c040", minWidth: 36, fontWeight: "bold", fontSize: 12 }}>{item.n}</span>
                      <span style={{ color: "#888" }}>{item.t}</span>
                    </div>
                  ))}
                </div>
                <SecaoEbook badge="Introdução" titulo={null} conteudo={ebook.intro} onEditar={() => { setAba(2); iniciarEdicao("intro"); }} onReescrever={() => reescreverComIA("intro")} />
                {ebook.capitulos.map((cap, i) => (
                  <SecaoEbook key={i} badge={`Capítulo ${i + 1}`} titulo={cap.titulo} conteudo={cap.conteudo} onEditar={() => { setAba(2); iniciarEdicao("capitulo", i); }} onReescrever={() => reescreverComIA("capitulo", i)} />
                ))}
                <SecaoEbook badge="Conclusão" titulo={null} conteudo={ebook.conclusao} onEditar={() => { setAba(2); iniciarEdicao("conclusao"); }} onReescrever={() => reescreverComIA("conclusao")} />
              </div>
            )}
          </div>
        )}

        {/* ════ ABA 2 — EDITAR ════ */}
        {aba === 2 && (
          <div className="fade-up">
            <SectionTitle>Editar Conteúdo</SectionTitle>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>Ajuste manualmente qualquer seção do e-book.</div>
            {!ebook && <EmptyState icon="✏️" msg="Gere um e-book primeiro para editar." />}
            {ebook && !editando && (
              <div style={{ display: "grid", gap: 10 }}>
                <ItemEditavel label="Introdução" sub="Seção de abertura" onClick={() => iniciarEdicao("intro")} />
                {ebook.capitulos.map((cap, i) => (
                  <ItemEditavel key={i} label={`Capítulo ${i + 1}: ${cap.titulo}`} sub="Clique para editar" onClick={() => iniciarEdicao("capitulo", i)} />
                ))}
                <ItemEditavel label="Conclusão" sub="Seção final" onClick={() => iniciarEdicao("conclusao")} />
              </div>
            )}
            {ebook && editando && (
              <div className="fade-up">
                <div style={{ fontSize: 11, color: "#f0c040", marginBottom: 10, letterSpacing: 2, textTransform: "uppercase" }}>
                  Editando: {editando.tipo === "intro" ? "Introdução" : editando.tipo === "conclusao" ? "Conclusão" : `Capítulo ${editando.index + 1}`}
                </div>
                <div style={{ background: "rgba(56,189,120,0.06)", border: "1px solid rgba(56,189,120,0.18)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#4ade80" }}>
                  💡 As referências científicas estão incluídas no texto. Você pode editá-las livremente.
                </div>
                <textarea value={textoEditavel} onChange={e => setTextoEditavel(e.target.value)} rows={20} style={{ ...inp, width: "100%", resize: "vertical", lineHeight: 1.85, fontSize: 14 }} />
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button className="btn-h" onClick={salvarEdicao} style={{ background: "linear-gradient(135deg, #f0c040, #d97706)", color: "#0a0a12", border: "none", borderRadius: 8, padding: "12px 28px", fontWeight: "bold", fontFamily: "inherit", fontSize: 14 }}>💾 Salvar</button>
                  <button className="btn-h" onClick={() => setEditando(null)} style={{ background: "rgba(255,255,255,0.04)", color: "#777", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "12px 24px", fontFamily: "inherit", fontSize: 14 }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ ABA 3 — EXPORTAR ════ */}
        {aba === 3 && (
          <div className="fade-up">
            <SectionTitle>Exportar E-Book</SectionTitle>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 28 }}>Escolha como e onde publicar seu e-book finalizado.</div>

            {!ebook && <EmptyState icon="🚀" msg="Gere um e-book primeiro para exportar." />}

            {ebook && (
              <div>
                {/* Info do ebook */}
                <div style={{ background: "rgba(240,192,64,0.05)", border: "1px solid rgba(240,192,64,0.15)", borderRadius: 10, padding: "14px 18px", marginBottom: 28, display: "flex", gap: 14, alignItems: "center" }}>
                  <span style={{ fontSize: 28 }}>📗</span>
                  <div>
                    <div style={{ color: "#f0c040", fontWeight: "bold", fontSize: 15 }}>{ebook.titulo}</div>
                    {ebook.subtitulo && <div style={{ color: "#666", fontSize: 12, fontStyle: "italic" }}>{ebook.subtitulo}</div>}
                    <div style={{ color: "#555", fontSize: 12, marginTop: 4 }}>{ebook.capitulos.length} capítulos · {ebook.meta.publico} · {ebook.meta.geradoEm}</div>
                  </div>
                </div>

                {/* ── DESTINOS ── */}
                <div style={{ fontSize: 11, letterSpacing: 3, color: "#f0c040", marginBottom: 14, textTransform: "uppercase" }}>Publicar em plataforma</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>

                  {/* GAMMA */}
                  <div className="export-card" onClick={() => { setExportDestino("gamma"); setExportStatus("info"); }} style={{
                    background: exportDestino === "gamma" ? "rgba(240,192,64,0.06)" : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${exportDestino === "gamma" ? "rgba(240,192,64,0.45)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 12, padding: "20px 18px",
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>⚡</div>
                    <div style={{ fontWeight: "bold", color: "#e0d8c8", fontSize: 15, marginBottom: 6 }}>Gamma</div>
                    <div style={{ color: "#666", fontSize: 12, lineHeight: 1.6 }}>Documento web moderno com layout automático. Ideal para compartilhar como link.</div>
                    <div style={{ marginTop: 10 }}>
                      <Badge color="#a78bfa" bg="rgba(167,139,250,0.1)" border="rgba(167,139,250,0.3)">Link público</Badge>
                    </div>
                  </div>

                  {/* CANVA */}
                  <div className="export-card" onClick={() => { setExportDestino("canva"); setExportStatus("info"); }} style={{
                    background: exportDestino === "canva" ? "rgba(240,192,64,0.06)" : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${exportDestino === "canva" ? "rgba(240,192,64,0.45)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 12, padding: "20px 18px",
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>🎨</div>
                    <div style={{ fontWeight: "bold", color: "#e0d8c8", fontSize: 15, marginBottom: 6 }}>Canva Doc</div>
                    <div style={{ color: "#666", fontSize: 12, lineHeight: 1.6 }}>Documento visual totalmente personalizável. Perfeito para vender ou distribuir em PDF.</div>
                    <div style={{ marginTop: 10 }}>
                      <Badge color="#60a5fa" bg="rgba(96,165,250,0.1)" border="rgba(96,165,250,0.3)">PDF premium</Badge>
                    </div>
                  </div>
                </div>

                {/* Painel de instruções ao selecionar destino */}
                {exportDestino && exportStatus === "info" && (
                  <div className="fade-up" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "22px", marginBottom: 24 }}>
                    {exportDestino === "gamma" && (
                      <>
                        <div style={{ fontWeight: "bold", color: "#a78bfa", marginBottom: 12, fontSize: 15 }}>⚡ Exportar para o Gamma</div>
                        <div style={{ color: "#888", fontSize: 13, lineHeight: 1.8, marginBottom: 16 }}>
                          <strong style={{ color: "#ccc" }}>Como fazer:</strong><br />
                          1. Clique em <strong style={{ color: "#f0c040" }}>"Copiar e Abrir Gamma"</strong> abaixo<br />
                          2. O texto do e-book será copiado automaticamente<br />
                          3. No Gamma, clique em <strong style={{ color: "#f0c040" }}>"New" → "Import or use AI"</strong><br />
                          4. Cole o texto (Ctrl+V) e clique em <strong style={{ color: "#f0c040" }}>"Generate"</strong><br />
                          5. O Gamma criará o layout automaticamente ✨
                        </div>
                        <button className="btn-h" onClick={copiarParaDestino} style={{ background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff", border: "none", borderRadius: 8, padding: "13px 24px", fontWeight: "bold", fontFamily: "inherit", fontSize: 14, width: "100%" }}>
                          {copied ? "✓ Copiado! Abrindo Gamma..." : "⚡ Copiar e Abrir Gamma"}
                        </button>
                      </>
                    )}
                    {exportDestino === "canva" && (
                      <>
                        <div style={{ fontWeight: "bold", color: "#60a5fa", marginBottom: 12, fontSize: 15 }}>🎨 Exportar para o Canva</div>
                        <div style={{ color: "#888", fontSize: 13, lineHeight: 1.8, marginBottom: 16 }}>
                          <strong style={{ color: "#ccc" }}>Como fazer:</strong><br />
                          1. Clique em <strong style={{ color: "#f0c040" }}>"Copiar e Abrir Canva"</strong> abaixo<br />
                          2. O texto do e-book será copiado automaticamente<br />
                          3. No Canva, clique em <strong style={{ color: "#f0c040" }}>"Criar design" → "Doc"</strong><br />
                          4. Cole o conteúdo (Ctrl+V) na área de texto<br />
                          5. Aplique um tema, adicione imagens e exporte em PDF 🎨
                        </div>
                        <button className="btn-h" onClick={copiarParaDestino} style={{ background: "linear-gradient(135deg, #60a5fa, #2563eb)", color: "#fff", border: "none", borderRadius: 8, padding: "13px 24px", fontWeight: "bold", fontFamily: "inherit", fontSize: 14, width: "100%" }}>
                          {copied ? "✓ Copiado! Abrindo Canva..." : "🎨 Copiar e Abrir Canva"}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* ── DOWNLOAD DIRETO ── */}
                <div style={{ fontSize: 11, letterSpacing: 3, color: "#f0c040", marginBottom: 14, textTransform: "uppercase" }}>Download direto</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <BtnDownload icon="📄" label=".TXT" sub="Texto simples" onClick={() => exportarTexto("txt")} />
                  <BtnDownload icon="📝" label=".MD" sub="Markdown" onClick={() => exportarTexto("md")} />
                  <BtnDownload icon="📋" label="Copiar" sub="Área de transferência" onClick={copiarTexto} destaque={copied} label2={copied ? "✓ Copiado!" : "Copiar"} />
                </div>

                <div style={{ marginTop: 20, background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 10, padding: "14px 18px", fontSize: 12, color: "#666", lineHeight: 1.7 }}>
                  💡 <strong style={{ color: "#93c5fd" }}>Dica:</strong> Para gerar um PDF profissional, use o Canva ou o Gamma e exporte por lá. Ambos oferecem templates bonitos e exportação em PDF de alta qualidade.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SUB-COMPONENTES ──────────────────────────────────────────────────────

const inp = {
  width: "100%", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8,
  padding: "11px 14px", color: "#e0d8c8",
  fontFamily: "inherit", fontSize: 14, boxSizing: "border-box",
};

function SectionTitle({ children }) {
  return <div style={{ fontSize: 18, fontWeight: "bold", color: "#f0c040", marginBottom: 6 }}>{children}</div>;
}

function Badge({ color, bg, border, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: "3px 10px", fontSize: 11, color, letterSpacing: 0.5 }}>
      {children}
    </span>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, letterSpacing: 2, color: "#f0c040", marginBottom: 7, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

function EmptyState({ icon, msg }) {
  return (
    <div style={{ textAlign: "center", padding: "70px 20px", color: "#444" }}>
      <div style={{ fontSize: 52, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{msg}</div>
    </div>
  );
}

function SecaoEbook({ badge, titulo, conteudo, onEditar, onReescrever }) {
  const partes = conteudo.split(/📚\s*Referências:/i);
  const textoMain = partes[0].trim();
  const refs = partes[1] ? partes[1].trim() : null;
  return (
    <div style={{ marginBottom: 22, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 10, letterSpacing: 2, color: "#f0c040", textTransform: "uppercase" }}>{badge}</span>
          {titulo && <div style={{ fontSize: 16, fontWeight: "bold", color: "#e0d8c8", marginTop: 4 }}>{titulo}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: 14, flexShrink: 0 }}>
          <BtnMini onClick={onEditar} title="Editar">✏️</BtnMini>
          <BtnMini onClick={onReescrever} title="Reescrever com novas fontes">🔬</BtnMini>
        </div>
      </div>
      <div style={{ lineHeight: 1.9, color: "#b8b0a0", fontSize: 14, whiteSpace: "pre-wrap" }}>{textoMain}</div>
      {refs && (
        <div className="ref-bloco">
          <div style={{ color: "#f0c040", fontSize: 10, letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>📚 Referências</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{refs}</div>
        </div>
      )}
    </div>
  );
}

function BtnMini({ onClick, children, title }) {
  return (
    <button onClick={onClick} title={title} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 14, color: "#888", transition: "all 0.2s" }}>
      {children}
    </button>
  );
}

function ItemEditavel({ label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "14px 18px", color: "#ccc", fontFamily: "inherit", fontSize: 14, textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", transition: "all 0.2s" }}>
      <div>
        <div style={{ fontWeight: "bold", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: "#444" }}>{sub}</div>
      </div>
      <span style={{ color: "#f0c040", fontSize: 20, marginLeft: 12 }}>›</span>
    </button>
  );
}

function BtnDownload({ icon, label, sub, onClick, destaque, label2 }) {
  return (
    <button onClick={onClick} style={{
      background: destaque ? "rgba(240,192,64,0.1)" : "rgba(255,255,255,0.03)",
      border: `1.5px solid ${destaque ? "rgba(240,192,64,0.4)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 10, padding: "16px 12px", cursor: "pointer",
      fontFamily: "inherit", color: "#ccc", textAlign: "center",
      transition: "all 0.2s",
    }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontWeight: "bold", fontSize: 14, color: destaque ? "#f0c040" : "#ccc" }}>{label2 || label}</div>
      <div style={{ fontSize: 11, color: "#444", marginTop: 3 }}>{sub}</div>
    </button>
  );
}
