const SUPABASE_URL = 'https://ectrvieffyfkbsttliwj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_aS4pis5Cve9JBPe7Nv-r1g_4XFZW8qe';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const el = (id) => document.getElementById(id);

const state = {
  usuarioAtual: null,
  cacheDias: [],
  modoAuth: 'login',
};

function setupDate() {
  const hoje = new Date();
  const dataInput = el('data');
  dataInput.valueAsDate = hoje;
}

function updateAuthMode() {
  const loginTab = el('tab-login');
  const signupTab = el('tab-signup');
  const title = el('auth-title');
  const sub = el('auth-sub');
  const btn = el('btn-auth-submit');
  const msg = el('auth-msg');

  msg.textContent = '';

  if (state.modoAuth === 'login') {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    title.textContent = '🔐 Entrar no Sistema';
    sub.textContent = 'Informe seu e-mail e senha para acessar seus dados na nuvem.';
    btn.textContent = 'Entrar';
    btn.classList.remove('signup');
    btn.classList.add('auth-btn');
  } else {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    title.textContent = '📝 Criar Nova Conta';
    sub.textContent = 'Crie sua conta para guardar seus ganhos e relatórios na nuvem.';
    btn.textContent = 'Criar Conta';
    btn.classList.remove('auth-btn');
    btn.classList.add('signup');
  }
}

function mostrarAuth() {
  el('auth-screen').classList.remove('hidden');
  el('app-screen').classList.add('hidden');
}

function mostrarApp() {
  el('auth-screen').classList.add('hidden');
  el('app-screen').classList.remove('hidden');
  carregarDados();
}

function traduzirErro(mensagemOriginal) {
  if (!mensagemOriginal) {
    return 'Ocorreu um erro inesperado. Tente novamente.';
  }

  const msg = mensagemOriginal.toLowerCase();

  if (msg.includes('invalid login credentials')) return 'E-mail ou palavra-passe incorretos.';
  if (msg.includes('user already registered')) return 'Este e-mail já está registado. Alterne para a aba "Entrar".';
  if (msg.includes('password should be at least')) return 'A palavra-passe deve ter pelo menos 6 caracteres.';
  if (msg.includes('email not confirmed')) return 'E-mail ainda não confirmado. Verifique a sua caixa de entrada.';
  if (msg.includes('rate limit exceeded') || msg.includes('too many requests')) return 'Muitas tentativas. Aguarde alguns instantes.';
  if (msg.includes('invalid email')) return 'Por favor, insira um endereço de e-mail válido.';

  return 'Erro: ' + mensagemOriginal;
}

async function checarSessao() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    state.usuarioAtual = session.user;
    mostrarApp();
  } else {
    mostrarAuth();
  }
}

async function executarAuth() {
  const email = el('email').value.trim();
  const password = el('password').value;
  const msg = el('auth-msg');

  if (!email || !password) {
    msg.style.color = '#ff8a8a';
    msg.textContent = 'Por favor, preencha o e-mail e a palavra-passe.';
    return;
  }

  msg.style.color = '#60a5fa';
  msg.textContent = 'A carregar...';

  if (state.modoAuth === 'login') {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      msg.style.color = '#ff8a8a';
      msg.textContent = traduzirErro(error.message);
      return;
    }

    state.usuarioAtual = data.user;
    mostrarApp();
    return;
  }

  const { error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    msg.style.color = '#ff8a8a';
    msg.textContent = traduzirErro(error.message);
    return;
  }

  msg.style.color = '#4ade80';
  msg.textContent = 'Conta criada com sucesso! Já pode entrar com os seus dados.';
  state.modoAuth = 'login';
  updateAuthMode();
}

async function fazerLogout() {
  await supabaseClient.auth.signOut();
  state.usuarioAtual = null;
  mostrarAuth();
}

function calc() {
  const bruto = Number.parseFloat(el('bruto').value) || 0;
  const km = Number.parseFloat(el('km').value) || 0;
  const comb = Number.parseFloat(el('comb').value) || 0;
  const alim = Number.parseFloat(el('alim').value) || 0;
  const outros = Number.parseFloat(el('outros').value) || 0;
  const bonus = Number.parseFloat(el('bonus').value) || 0;

  const totalBruto = bruto + bonus;
  const gasto = comb + alim + outros;
  const liquido = totalBruto - gasto;
  const brutoKm = km > 0 ? totalBruto / km : 0;
  const liquidoKm = km > 0 ? liquido / km : 0;

  el('m_bruto_km').textContent = brutoKm.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  el('m_liquido').textContent = liquido.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  el('m_liquido_km').textContent = liquidoKm.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  el('m_gasto').textContent = gasto.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return {
    bruto: totalBruto,
    km,
    comb,
    alim,
    outros,
    bonus,
    gasto,
    liquido,
    brutoKm,
    liquidoKm,
  };
}

async function salvar() {
  const dados = calc();

  if (!dados.bruto) {
    alert('Informe o valor bruto.');
    return;
  }

  const dataVal = el('data').value || new Date().toISOString().slice(0, 10);

  const { error } = await supabaseClient
    .from('controle_dias')
    .insert([
      {
        user_id: state.usuarioAtual.id,
        data: dataVal,
        bruto: dados.bruto,
        km: dados.km,
        comb: dados.comb,
        alim: dados.alim,
        outros: dados.outros,
        bonus: dados.bonus,
        gasto: dados.gasto,
        liquido: dados.liquido,
        bruto_km: dados.brutoKm,
        liquido_km: dados.liquidoKm,
      },
    ]);

  if (error) {
    alert('Erro ao guardar os dados: ' + traduzirErro(error.message));
    return;
  }

  ['bruto', 'km', 'comb', 'alim', 'outros', 'bonus'].forEach((campo) => {
    el(campo).value = '';
  });

  calc();
  carregarDados();
}

async function carregarDados() {
  const { data, error } = await supabaseClient
    .from('controle_dias')
    .select('*')
    .order('data', { ascending: false });

  if (error) {
    console.error('Erro ao carregar dados:', error);
    return;
  }

  state.cacheDias = data || [];
  renderTabela();
}

function renderTabela() {
  const tbody = el('tbody');
  tbody.innerHTML = '';

  let totalLiquido = 0;
  let totalKm = 0;

  state.cacheDias.forEach((dia) => {
    totalLiquido += Number(dia.liquido);
    totalKm += Number(dia.km);

    const tr = document.createElement('tr');
    const dataFmt = dia.data.split('-').reverse().join('/');

    tr.innerHTML = `
      <td>${dataFmt.slice(0, 5)}<br><span class="small">${dia.km}km</span></td>
      <td>R$ ${Number(dia.bruto).toFixed(0)}</td>
      <td class="text-green">R$ ${Number(dia.liquido).toFixed(0)}</td>
      <td>R$ ${Number(dia.liquido_km).toFixed(2)}</td>
    `;

    tbody.appendChild(tr);
  });

  el('totalAcum').textContent = state.cacheDias.length
    ? `Total líq R$ ${totalLiquido.toFixed(0)} em ${totalKm}km`
    : '';
}

function exportar() {
  if (!state.cacheDias.length) {
    alert('Nenhum dado para exportar.');
    return;
  }

  let texto = '*Controle Diário*\n\n';

  state.cacheDias.forEach((dia) => {
    texto += `📅 ${dia.data} - Bruto R$${dia.bruto} | Comb R$${dia.comb} | Alim R$${dia.alim} | Outros R$${dia.outros} | Gasto R$${dia.gasto} | Líq R$${Number(dia.liquido).toFixed(2)} | ${dia.km}km | R$/km R$${Number(dia.liquido_km).toFixed(2)}\n`;
  });

  const totalLiq = state.cacheDias.reduce((acumulado, dia) => acumulado + Number(dia.liquido), 0);
  texto += `\n💰 Total líquido: R$ ${totalLiq.toFixed(2)}`;

  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}

function setupEventListeners() {
  const campos = ['bruto', 'km', 'comb', 'alim', 'outros', 'bonus'];

  campos.forEach((campo) => {
    el(campo).addEventListener('input', calc);
  });

  el('tab-login').addEventListener('click', () => {
    state.modoAuth = 'login';
    updateAuthMode();
  });

  el('tab-signup').addEventListener('click', () => {
    state.modoAuth = 'signup';
    updateAuthMode();
  });

  el('btn-auth-submit').addEventListener('click', executarAuth);
  el('btn-salvar').addEventListener('click', salvar);
  el('btn-exportar').addEventListener('click', exportar);
  el('btn-logout').addEventListener('click', fazerLogout);
}

function init() {
  setupDate();
  setupEventListeners();
  updateAuthMode();
  calc();
  checarSessao();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service Worker não foi registrado:', error);
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
