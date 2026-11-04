/**
 * Ponte entre o app de contagem (GitHub Pages) e a planilha "teste de contagem".
 *
 * Aba Página1  : catálogo vindo do IMPORTRANGE (somente leitura; este script nunca escreve nela)
 * Aba Contagem : histórico — uma linha por quantidade salva
 * Aba Resumo   : uma linha por produto com a última quantidade contada
 *
 * Implantar como App da Web: Executar como "Eu", Quem pode acessar "Qualquer pessoa".
 */

const ABA_CATALOGO = 'Página1';
const ABA_LOG = 'Contagem';
const ABA_RESUMO = 'Resumo';
const FUSO = 'America/Fortaleza';

// PIN da equipe. Deixe '' (vazio) para não exigir PIN.
const PIN = '';

const CAB_LOG = ['Data/Hora', 'Conferente', 'Local', 'Código de Barras', 'Produto', 'Descrição', 'Quantidade lida', 'Modo', 'Quantidade final', 'Aparelho'];
const CAB_RESUMO = ['Chave', 'Código de Barras', 'Produto', 'Descrição', 'Quantidade', 'Última leitura', 'Conferente', 'Local'];

/* ---------- rotas ---------- */

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'ping') return json_({ ok: true });
    checarPin_(p.pin);
    if (p.action === 'dados') return json_({ ok: true, dados: getDados_() });
    if (p.action === 'foto') return json_({ ok: true, foto: getFoto_(p.id) });
    return json_({ ok: false, erro: 'Ação desconhecida.' });
  } catch (err) {
    return json_({ ok: false, erro: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checarPin_(body.pin);
    if (body.action === 'salvar') return json_({ ok: true, resultado: salvarContagem_(body.registro || {}) });
    return json_({ ok: false, erro: 'Ação desconhecida.' });
  } catch (err) {
    return json_({ ok: false, erro: err.message });
  }
}

/* ---------- utilidades para rodar pelo editor ---------- */

/** Rode uma vez pelo editor (Executar) para criar as abas e autorizar o script. */
function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(ABA_CATALOGO)) {
    throw new Error('Não encontrei a aba "' + ABA_CATALOGO + '". Ajuste ABA_CATALOGO no topo do código.');
  }
  prepararAba_(ss, ABA_LOG, CAB_LOG);
  prepararAba_(ss, ABA_RESUMO, CAB_RESUMO);
  // toca no Drive uma vez para o Google pedir essa autorização também (fotos)
  DriveApp.getRootFolder();
  return 'Abas prontas: ' + ABA_LOG + ' e ' + ABA_RESUMO;
}

/** Começa um inventário novo: guarda as abas atuais com a data e cria abas vazias. */
function novaContagem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sufixo = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd HH-mm');
  [ABA_LOG, ABA_RESUMO].forEach(function (nome) {
    const sh = ss.getSheetByName(nome);
    if (sh) sh.setName(nome + ' ' + sufixo);
  });
  configurar();
}

/* ---------- lógica ---------- */

function getDados_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cat = ss.getSheetByName(ABA_CATALOGO);
  if (!cat) throw new Error('Aba "' + ABA_CATALOGO + '" não encontrada.');
  const valores = cat.getDataRange().getDisplayValues();
  const cab = valores[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const col = function (nome) { return cab.indexOf(nome.toLowerCase()); };
  const cEan = col('Código de Barras'), cCod = col('Produto'), cDesc = col('Descrição'), cSt = col('Status'), cFoto = col('Foto');
  if (cEan < 0 || cCod < 0 || cDesc < 0) {
    throw new Error('O cabeçalho da aba ' + ABA_CATALOGO + ' mudou. Preciso das colunas "Código de Barras", "Produto" e "Descrição".');
  }

  const produtos = [];
  for (let i = 1; i < valores.length; i++) {
    const r = valores[i];
    const cod = String(r[cCod] || '').trim();
    const desc = String(r[cDesc] || '').replace(/\s+/g, ' ').trim();
    if (!cod && !desc) continue;
    const foto = cFoto >= 0 ? String(r[cFoto] || '') : '';
    const m = foto.match(/\/d\/([^/?]+)/) || foto.match(/[?&]id=([^&]+)/);
    produtos.push({
      k: cod + '|' + desc,
      ean: String(r[cEan] || '').trim(),
      cod: cod,
      desc: desc,
      st: cSt >= 0 ? String(r[cSt] || '').trim() : '',
      img: m ? m[1] : ''
    });
  }

  const contagem = {};
  const res = ss.getSheetByName(ABA_RESUMO);
  if (res && res.getLastRow() > 1) {
    res.getRange(2, 1, res.getLastRow() - 1, CAB_RESUMO.length).getValues().forEach(function (r) {
      if (!r[0]) return;
      const dt = r[5] instanceof Date ? Utilities.formatDate(r[5], FUSO, 'HH:mm') : String(r[5]).slice(11, 16);
      contagem[r[0]] = { qtd: Number(r[4]) || 0, hora: dt, conferente: String(r[6] || ''), local: String(r[7] || '') };
    });
  }
  return { produtos: produtos, contagem: contagem };
}

function salvarContagem_(reg) {
  const qtdLida = Number(reg.qtd);
  if (!reg.k) throw new Error('Produto não informado.');
  if (!isFinite(qtdLida) || qtdLida < 0) throw new Error('Quantidade inválida.');
  if (!String(reg.conferente || '').trim()) throw new Error('Informe o nome do conferente.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const log = prepararAba_(ss, ABA_LOG, CAB_LOG);
    const res = prepararAba_(ss, ABA_RESUMO, CAB_RESUMO);
    const agora = new Date();
    const hora = Utilities.formatDate(agora, FUSO, 'dd/MM/yyyy HH:mm:ss');

    let linha = -1, anterior = 0;
    if (res.getLastRow() > 1) {
      const chaves = res.getRange(2, 1, res.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < chaves.length; i++) {
        if (String(chaves[i][0]) === reg.k) { linha = i + 2; break; }
      }
      if (linha > 0) anterior = Number(res.getRange(linha, 5).getValue()) || 0;
    }
    const final = reg.somar && linha > 0 ? anterior + qtdLida : qtdLida;

    log.appendRow([hora, reg.conferente, reg.local || '', "'" + (reg.ean || ''), reg.cod || '', reg.desc || '',
      qtdLida, reg.somar ? 'Somou' : 'Substituiu', final, String(reg.aparelho || '').slice(0, 120)]);

    const dados = [reg.k, "'" + (reg.ean || ''), reg.cod || '', reg.desc || '', final, hora, reg.conferente, reg.local || ''];
    if (linha > 0) res.getRange(linha, 1, 1, dados.length).setValues([dados]);
    else res.appendRow(dados);

    return { qtd: final, hora: Utilities.formatDate(agora, FUSO, 'HH:mm') };
  } finally {
    lock.releaseLock();
  }
}

function getFoto_(id) {
  if (!id || !/^[\w-]{10,}$/.test(id)) return '';
  const cache = CacheService.getScriptCache();
  const salvo = cache.get('foto_' + id);
  if (salvo) return salvo;
  try {
    let blob = DriveApp.getFileById(id).getBlob();
    // reduz fotos grandes para não pesar no celular
    try {
      const thumb = DriveApp.getFileById(id).getThumbnail();
      if (thumb && thumb.getBytes().length > 0 && blob.getBytes().length > 300000) blob = thumb;
    } catch (e) {}
    const uri = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    if (uri.length < 95000) cache.put('foto_' + id, uri, 21600);
    return uri;
  } catch (e) {
    return '';
  }
}

function checarPin_(pin) {
  if (PIN && String(pin || '') !== PIN) throw new Error('PIN_INVALIDO');
}

function prepararAba_(ss, nome, cabecalho) {
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
