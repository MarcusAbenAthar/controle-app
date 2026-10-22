const SUPABASE_URL = 'https://ectrvieffyfkbsttliwj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_aS4pis5Cve9JBPe7Nv-r1g_4XFZW8qe';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const el = (id) => document.getElementById(id);

const state = {
  usuarioAtual: null,
  cacheDias: [],
  modoAuth: 'login',
  activeView: 'lancamentos',
  activeReport: 'semanal',
  reportMonth: 'all',
  reportYear: 'all',
  chartInstances: {},
  modoEdicao: false,
  registroEmEdicaoId: null,
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
  setActiveView('lancamentos');
  carregarDados();
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function toNumber(value) {
  return Number(value || 0);
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

  el('m_bruto_km').textContent = formatCurrency(brutoKm);
  el('m_liquido').textContent = formatCurrency(liquido);
  el('m_liquido_km').textContent = formatCurrency(liquidoKm);
  el('m_gasto').textContent = formatCurrency(gasto);

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

  if (state.modoEdicao) {
    let request = supabaseClient
      .from('controle_dias')
      .update({
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
      })
      .eq('user_id', state.usuarioAtual.id);

    request = state.registroEmEdicaoId
      ? request.eq('id', state.registroEmEdicaoId)
      : request.eq('data', dataVal);

    const { data: atualizados, error } = await request.select('*');

    if (error) {
      alert('Erro ao atualizar os dados: ' + traduzirErro(error.message));
      return;
    }

    if (!atualizados?.length) {
      alert('O lançamento não foi encontrado ou não pode ser atualizado. Atualize o histórico e tente novamente.');
      await carregarDados();
      return;
    }
  } else {
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
  }

  ['bruto', 'km', 'comb', 'alim', 'outros', 'bonus'].forEach((campo) => {
    el(campo).value = '';
  });

  state.modoEdicao = false;
  state.registroEmEdicaoId = null;
  el('btn-salvar').textContent = 'Salvar dia';
  el('btn-cancelar-edicao').classList.add('hidden');
  calc();
  carregarDados();
}

async function carregarDados() {
  const { data, error } = await supabaseClient
    .from('controle_dias')
    .select('*')
    .eq('user_id', state.usuarioAtual.id)
    .order('data', { ascending: false });

  if (error) {
    console.error('Erro ao carregar dados:', error);
    return;
  }

  state.cacheDias = data || [];
  renderTabela();
  renderDashboard();
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

    const dataCell = document.createElement('td');
    dataCell.innerHTML = `${dataFmt.slice(0, 5)}<br><span class="small">${dia.km}km</span>`;
    tr.appendChild(dataCell);

    [
      { value: `R$ ${Number(dia.bruto).toFixed(0)}` },
      { value: `R$ ${Number(dia.liquido).toFixed(0)}`, className: 'text-green' },
      { value: `R$ ${Number(dia.liquido_km).toFixed(2)}` },
    ].forEach(({ value, className }) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      if (className) cell.classList.add(className);
      tr.appendChild(cell);
    });

    const actionsCell = document.createElement('td');
    actionsCell.classList.add('history-actions');
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'history-action edit';
    editButton.dataset.action = 'edit';
    editButton.textContent = 'Editar';
    editButton.setAttribute('aria-label', `Editar lançamento de ${dataFmt}`);
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'history-action delete';
    deleteButton.dataset.action = 'delete';
    deleteButton.textContent = 'Excluir';
    deleteButton.setAttribute('aria-label', `Excluir lançamento de ${dataFmt}`);
    [editButton, deleteButton].forEach((button) => {
      button.dataset.date = dia.data;
      if (dia.id !== undefined && dia.id !== null) button.dataset.recordId = dia.id;
      actionsCell.appendChild(button);
    });
    tr.appendChild(actionsCell);

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

function normalizarDias(dias) {
  return (dias || []).map((dia) => ({
    ...dia,
    bruto: toNumber(dia.bruto),
    bonus: toNumber(dia.bonus),
    comb: toNumber(dia.comb),
    alim: toNumber(dia.alim),
    outros: toNumber(dia.outros),
    km: toNumber(dia.km),
    liquido: toNumber(dia.liquido),
    gasto: toNumber(dia.gasto),
    liquido_km: toNumber(dia.liquido_km),
    bruto_km: toNumber(dia.bruto_km),
    data: dia.data || new Date().toISOString().slice(0, 10),
  }));
}

function popularFormularioDoDia(dia) {
  el('data').value = dia.data;
  el('bruto').value = dia.bruto || 0;
  el('km').value = dia.km || 0;
  el('comb').value = dia.comb || 0;
  el('alim').value = dia.alim || 0;
  el('outros').value = dia.outros || 0;
  el('bonus').value = dia.bonus || 0;
  calc();
}

function prepararModoEdicao(dataSelecionada, registroSelecionado = null) {
  const registro = registroSelecionado || state.cacheDias.find((dia) => dia.data === dataSelecionada);
  const btnSalvar = el('btn-salvar');

  if (registro) {
    state.modoEdicao = true;
    state.registroEmEdicaoId = registro.id ?? null;
    btnSalvar.textContent = 'Atualizar dia';
    el('btn-cancelar-edicao').classList.remove('hidden');
    popularFormularioDoDia(registro);
    return;
  }

  if (state.modoEdicao) {
    ['bruto', 'km', 'comb', 'alim', 'outros', 'bonus'].forEach((campo) => {
      el(campo).value = '';
    });
    calc();
  }
  state.modoEdicao = false;
  state.registroEmEdicaoId = null;
  btnSalvar.textContent = 'Salvar dia';
  el('btn-cancelar-edicao').classList.add('hidden');
}

function cancelarEdicao() {
  state.modoEdicao = false;
  state.registroEmEdicaoId = null;
  ['bruto', 'km', 'comb', 'alim', 'outros', 'bonus'].forEach((campo) => {
    el(campo).value = '';
  });
  setupDate();
  el('btn-salvar').textContent = 'Salvar dia';
  el('btn-cancelar-edicao').classList.add('hidden');
  calc();
}

async function excluirDia(registro) {
  const dataFmt = registro.data.split('-').reverse().join('/');
  if (!window.confirm(`Excluir permanentemente o lançamento de ${dataFmt}?`)) return;

  let request = supabaseClient
    .from('controle_dias')
    .delete()
    .eq('user_id', state.usuarioAtual.id);

  request = registro.id !== undefined && registro.id !== null
    ? request.eq('id', registro.id)
    : request.eq('data', registro.data);

  const { data: excluidos, error } = await request.select('*');
  if (error) {
    alert('Erro ao excluir o lançamento: ' + traduzirErro(error.message));
    return;
  }

  if (!excluidos?.length) {
    alert('O lançamento não foi encontrado ou não pode ser excluído. Atualize o histórico e tente novamente.');
    await carregarDados();
    return;
  }

  if (state.modoEdicao && (registro.id != null
    ? String(state.registroEmEdicaoId) === String(registro.id)
    : el('data').value === registro.data)) {
    cancelarEdicao();
  }
  await carregarDados();
}

function tratarSelecaoData() {
  const dataSelecionada = el('data').value;
  if (!dataSelecionada) return;
  prepararModoEdicao(dataSelecionada);
}

function getStartOfWeek(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

function getLabelPeriodo(dataKey, periodo) {
  if (periodo === 'semanal') {
    const date = new Date(`${dataKey}T00:00:00`);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  if (periodo === 'mensal') {
    const [year, month] = dataKey.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  }

  return dataKey;
}

function agruparPorPeriodo(dias, periodo) {
  const agrupado = new Map();

  dias.forEach((dia) => {
    let key = '';

    if (periodo === 'semanal') {
      const inicio = getStartOfWeek(dia.data);
      key = inicio.toISOString().slice(0, 10);
    } else if (periodo === 'mensal') {
      key = dia.data.slice(0, 7);
    } else {
      key = dia.data.slice(0, 4);
    }

    if (!agrupado.has(key)) {
      agrupado.set(key, {
        periodo: key,
        label: getLabelPeriodo(key, periodo),
        bruto: 0,
        bonus: 0,
        comb: 0,
        alim: 0,
        outros: 0,
        km: 0,
        liquido: 0,
        totalGasto: 0,
      });
    }

    const atual = agrupado.get(key);
    atual.bruto += dia.bruto;
    atual.bonus += dia.bonus;
    atual.comb += dia.comb;
    atual.alim += dia.alim;
    atual.outros += dia.outros;
    atual.km += dia.km;
    atual.liquido += dia.liquido;
    atual.totalGasto += dia.gasto;
    agrupado.set(key, atual);
  });

  return Array.from(agrupado.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));
}

function calcularKpis(periodos) {
  const totalFaturamento = periodos.reduce((sum, item) => sum + item.bruto + item.bonus, 0);
  const totalLiquido = periodos.reduce((sum, item) => sum + item.liquido, 0);
  const totalKm = periodos.reduce((sum, item) => sum + item.km, 0);
  const totalGasto = periodos.reduce((sum, item) => sum + item.comb + item.alim + item.outros, 0);
  const margem = totalFaturamento > 0 ? (totalLiquido / totalFaturamento) * 100 : 0;
  const eficiencia = totalKm > 0 ? totalLiquido / totalKm : 0;

  return {
    faturamento: totalFaturamento,
    liquido: totalLiquido,
    km: totalKm,
    gasto: totalGasto,
    margem,
    eficiencia,
  };
}

function getComparacao(periodos, periodoAtual) {
  if (periodos.length < 2) {
    return 'Sem comparação anterior disponível.';
  }

  const atual = periodos[periodos.length - 1];
  const anterior = periodos[periodos.length - 2];
  const atualLiquido = atual.liquido;
  const anteriorLiquido = anterior.liquido || 0;

  if (anteriorLiquido === 0) {
    return 'Primeiro período em análise.';
  }

  const delta = ((atualLiquido - anteriorLiquido) / anteriorLiquido) * 100;
  const sinal = delta >= 0 ? 'mais' : 'menos';
  return `Você lucrou ${Math.abs(delta).toFixed(1)}% ${sinal} que no período anterior.`;
}

function getFilteredDias(dias) {
  return dias.filter((dia) => {
    const mes = dia.data.slice(5, 7);
    const ano = dia.data.slice(0, 4);

    const matchMonth = state.reportMonth === 'all' || mes === state.reportMonth;
    const matchYear = state.reportYear === 'all' || ano === state.reportYear;

    return matchMonth && matchYear;
  });
}

function populateReportFilters(dias) {
  const meses = Array.from(new Set(dias.map((dia) => dia.data.slice(5, 7)))).sort();
  const anos = Array.from(new Set(dias.map((dia) => dia.data.slice(0, 4)))).sort();

  const monthSelect = el('report-month-filter');
  const yearSelect = el('report-year-filter');

  const monthOptions = ['<option value="all">Todos</option>']
    .concat(meses.map((mes) => `<option value="${mes}">${Number(mes)} </option>`));

  const yearOptions = ['<option value="all">Todos</option>']
    .concat(anos.map((ano) => `<option value="${ano}">${ano}</option>`));

  monthSelect.innerHTML = monthOptions.join('');
  yearSelect.innerHTML = yearOptions.join('');

  if (meses.includes(state.reportMonth)) {
    monthSelect.value = state.reportMonth;
  } else {
    monthSelect.value = 'all';
    state.reportMonth = 'all';
  }

  if (anos.includes(state.reportYear)) {
    yearSelect.value = state.reportYear;
  } else {
    yearSelect.value = 'all';
    state.reportYear = 'all';
  }
}

function clearDashboardState(message = 'Nenhum dado para relatório.') {
  Object.values(state.chartInstances).forEach((chart) => chart.destroy());
  state.chartInstances = {};
  el('report-kpis').innerHTML = '';
  el('report-table-body').innerHTML = '';
  el('report-summary').textContent = message;
}

function renderDashboard() {
  const dias = normalizarDias(state.cacheDias);
  if (!dias.length) {
    clearDashboardState('Nenhum dado para relatório.');
    return;
  }

  populateReportFilters(dias);

  const dadosFiltrados = getFilteredDias(dias);
  if (!dadosFiltrados.length) {
    clearDashboardState('Nenhum dado para o filtro atual.');
    return;
  }

  const dados = agruparPorPeriodo(dadosFiltrados, state.activeReport);
  const kpis = calcularKpis(dados);

  el('report-kpis').innerHTML = `
    <div class="kpi-card">
      <span class="label">Faturamento bruto</span>
      <span class="value">${formatCurrency(kpis.faturamento)}</span>
      <span class="trend">Total do período</span>
    </div>
    <div class="kpi-card">
      <span class="label">Lucro líquido</span>
      <span class="value">${formatCurrency(kpis.liquido)}</span>
      <span class="trend">${getComparacao(dados, state.activeReport)}</span>
    </div>
    <div class="kpi-card">
      <span class="label">Eficiência por KM</span>
      <span class="value">${formatCurrency(kpis.eficiencia)}</span>
      <span class="trend">Lucro ÷ KM</span>
    </div>
    <div class="kpi-card">
      <span class="label">Custo operacional</span>
      <span class="value">${formatCurrency(kpis.gasto)}</span>
      <span class="trend">Combustível + Alimentação + Outros</span>
    </div>
    <div class="kpi-card">
      <span class="label">Quilometragem</span>
      <span class="value">${Number(kpis.km).toLocaleString('pt-BR')} km</span>
      <span class="trend">Total rodado</span>
    </div>
    <div class="kpi-card">
      <span class="label">Margem</span>
      <span class="value">${formatPercent(kpis.margem)}</span>
      <span class="trend">Lucro ÷ faturamento</span>
    </div>
  `;

  const trendLabels = dados.map((item) => item.label);
  const lucroSeries = dados.map((item) => item.liquido);
  const rkmSeries = dados.map((item) => (item.km > 0 ? item.liquido / item.km : 0));

  renderChart('chart-lucro', {
    type: 'bar',
    labels: trendLabels,
    datasets: [{
      label: 'Lucro líquido',
      data: lucroSeries,
      backgroundColor: lucroSeries.map((valor) => valor >= 0 ? '#4ade80' : '#fbbf24'),
      borderRadius: 6,
    }],
    title: 'Lucro líquido por período',
  });

  renderChart('chart-lucro-linha', {
    type: 'line',
    labels: trendLabels,
    datasets: [{
      label: 'Lucro líquido',
      data: lucroSeries,
      borderColor: '#2d7dff',
      backgroundColor: 'rgba(45, 125, 255, 0.14)',
      tension: 0.35,
      fill: true,
      pointBackgroundColor: '#2d7dff',
    }],
    title: 'Evolução do lucro líquido',
  });

  renderChart('chart-rkm', {
    type: 'line',
    labels: trendLabels,
    datasets: [{
      label: 'R$/km líquido',
      data: rkmSeries,
      borderColor: '#60a5fa',
      backgroundColor: 'rgba(96, 165, 250, 0.2)',
      tension: 0.35,
      fill: false,
      pointBackgroundColor: '#60a5fa',
    }],
    title: 'Evolução do R$/km líquido',
  });

  renderChart('chart-custos', {
    type: 'doughnut',
    labels: ['Combustível', 'Alimentação', 'Outros'],
    datasets: [{
      data: [
        dados.reduce((sum, item) => sum + item.comb, 0),
        dados.reduce((sum, item) => sum + item.alim, 0),
        dados.reduce((sum, item) => sum + item.outros, 0),
      ],
      backgroundColor: ['#60a5fa', '#fbbf24', '#fb923c'],
    }],
    title: 'Composição dos custos',
  });

  const tabela = dados.map((item) => `
    <tr>
      <td>${item.label}</td>
      <td>${formatCurrency(item.bruto + item.bonus)}</td>
      <td>${formatCurrency(item.liquido)}</td>
      <td>${formatCurrency(item.km > 0 ? item.liquido / item.km : 0)}</td>
    </tr>
  `).join('');

  el('report-table-body').innerHTML = tabela;
  el('report-summary').textContent = getComparacao(dados, state.activeReport);
}

function renderChart(canvasId, config) {
  const canvas = el(canvasId);
  if (!canvas) return;

  if (state.chartInstances[canvasId]) {
    state.chartInstances[canvasId].destroy();
  }

  state.chartInstances[canvasId] = new Chart(canvas, {
    type: config.type,
    data: {
      labels: config.labels,
      datasets: config.datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#e8e8e8',
          },
        },
        title: {
          display: !!config.title,
          text: config.title,
          color: '#e8e8e8',
          font: { size: 14 },
        },
      },
      scales: config.type === 'bar' || config.type === 'line'
        ? {
            x: {
              ticks: { color: '#9aa0a6' },
              grid: { color: 'rgba(255,255,255,0.05)' },
            },
            y: {
              ticks: { color: '#9aa0a6' },
              grid: { color: 'rgba(255,255,255,0.05)' },
            },
          }
        : undefined,
    },
  });
}

function setActiveView(viewName) {
  state.activeView = viewName;
  const lancamentosView = el('view-lancamentos');
  const relatoriosView = el('view-relatorios');
  const tabLancamentos = el('tab-lancamentos');
  const tabRelatorios = el('tab-relatorios');

  if (viewName === 'lancamentos') {
    lancamentosView.classList.remove('hidden');
    relatoriosView.classList.add('hidden');
    tabLancamentos.classList.add('active');
    tabRelatorios.classList.remove('active');
  } else {
    lancamentosView.classList.add('hidden');
    relatoriosView.classList.remove('hidden');
    tabLancamentos.classList.remove('active');
    tabRelatorios.classList.add('active');
  }
}

function setActiveReport(periodo) {
  state.activeReport = periodo;
  document.querySelectorAll('.report-periods button').forEach((button) => {
    button.classList.toggle('active', button.dataset.period === periodo);
  });
  renderDashboard();
}

function handleReportFilterChange() {
  state.reportMonth = el('report-month-filter').value;
  state.reportYear = el('report-year-filter').value;
  renderDashboard();
}

function setupEventListeners() {
  const campos = ['bruto', 'km', 'comb', 'alim', 'outros', 'bonus'];

  campos.forEach((campo) => {
    el(campo).addEventListener('input', calc);
  });

  el('data').addEventListener('change', tratarSelecaoData);

  el('tab-login').addEventListener('click', () => {
    state.modoAuth = 'login';
    updateAuthMode();
  });

  el('tab-signup').addEventListener('click', () => {
    state.modoAuth = 'signup';
    updateAuthMode();
  });

  el('tab-lancamentos').addEventListener('click', () => setActiveView('lancamentos'));
  el('tab-relatorios').addEventListener('click', () => setActiveView('relatorios'));
  document.querySelectorAll('.report-periods button').forEach((button) => {
    button.addEventListener('click', () => setActiveReport(button.dataset.period));
  });

  el('report-month-filter').addEventListener('change', handleReportFilterChange);
  el('report-year-filter').addEventListener('change', handleReportFilterChange);

  el('btn-auth-submit').addEventListener('click', executarAuth);
  el('btn-salvar').addEventListener('click', salvar);
  el('btn-cancelar-edicao').addEventListener('click', cancelarEdicao);
  el('tbody').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const registro = state.cacheDias.find((dia) => (
      button.dataset.recordId !== undefined
        ? String(dia.id) === button.dataset.recordId
        : dia.data === button.dataset.date
    ));
    if (!registro) return;

    if (button.dataset.action === 'edit') {
      el('data').value = registro.data;
      prepararModoEdicao(registro.data, registro);
      el('bruto').focus();
    } else if (button.dataset.action === 'delete') {
      excluirDia(registro);
    }
  });
  el('btn-exportar').addEventListener('click', exportar);
  el('btn-logout').addEventListener('click', fazerLogout);
}

function init() {
  setupDate();
  setupEventListeners();
  updateAuthMode();
  setActiveView('lancamentos');
  calc();
  checarSessao();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service Worker não foi registrado:', error);
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
