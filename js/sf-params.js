/**
 * Repasse de parametros de anuncio: presell -> produto -> checkout -> webhook.
 *
 * Problema que isto resolve: cada pagina montava o rastreamento a partir de uma
 * whitelist fixa (utm_source/medium/campaign/content/term, ttclid, src, sck) e
 * concatenava `destino + location.search` na mao. Duas perdas:
 *   1. parametro fora da whitelist (utm_id, sf_bc, qualquer um do gestor) sumia;
 *   2. se o destino ja tinha "?" (loja com presell_redirect_url proprio), a
 *      concatenacao gerava "?a=1?utm_campaign=..." e TUDO depois do 2o "?" virava
 *      valor do parametro anterior — a campanha chegava vazia no webhook.
 *
 * Agora: qualquer parametro que chegar na URL e guardado na sessao e viaja ate o
 * checkout. A URL de entrada (landing) tambem e guardada, pra ir no payload.
 */
(function (w) {
  'use strict';
  var CHAVE_PARAMS = 'sf_params';
  var CHAVE_LANDING = 'sf_landing';

  // Parametros de FLUXO INTERNO da loja: nunca sao guardados nem herdados.
  // Herdar `rlt`/`ds` daria desconto de roleta num pedido que nao ganhou nada;
  // herdar `next`/`queue` re-injetaria a esteira de upsell numa compra nova.
  var NAO_HERDA = ['pp', 'rlt', 'nod', 'ds', 'next', 'queue', 'code', 'codigo',
    'token', 'order', 'name', 'email', 'phone', 'document', 'slug', 'p',
    'preview', 'pg_debug', 'cart'];

  var MAX_CHAVES = 40;
  var MAX_VALOR = 300;

  function chaveValida(k) {
    return !!k && k.length <= 60 && /^[A-Za-z0-9_.\-]+$/.test(k) && NAO_HERDA.indexOf(k.toLowerCase()) === -1;
  }

  function paramsDaUrl(search) {
    var out = {};
    try {
      var q = new URLSearchParams(String(search || '').replace(/^\?/, ''));
      q.forEach(function (v, k) {
        if (!chaveValida(k)) return;
        v = String(v == null ? '' : v);
        if (!v) return;
        out[k] = v.slice(0, MAX_VALOR);
      });
    } catch (e) {}
    return out;
  }

  function lerSessao() {
    try { return JSON.parse(w.sessionStorage.getItem(CHAVE_PARAMS) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function gravarSessao(obj) {
    try { w.sessionStorage.setItem(CHAVE_PARAMS, JSON.stringify(obj)); } catch (e) {}
  }

  // Chamado no carregamento de cada pagina. Parametro que chega na URL VENCE o
  // guardado (o clique mais recente e a verdade); o guardado sobrevive quando a
  // pagina seguinte vem sem query nenhuma.
  function sfParamsCapturar() {
    var atual = paramsDaUrl(w.location && w.location.search);
    var acc = lerSessao();
    Object.keys(atual).forEach(function (k) { acc[k] = atual[k]; });
    var chaves = Object.keys(acc);
    if (chaves.length > MAX_CHAVES) {
      var corte = {};
      chaves.slice(0, MAX_CHAVES).forEach(function (k) { corte[k] = acc[k]; });
      acc = corte;
    }
    gravarSessao(acc);
    // URL de entrada: primeira pagina desta sessao. Nunca sobrescrita — e ela que
    // identifica de qual criativo/conta o comprador veio.
    try {
      if (!w.sessionStorage.getItem(CHAVE_LANDING)) {
        w.sessionStorage.setItem(CHAVE_LANDING, String(w.location.href).slice(0, 900));
      }
    } catch (e) {}
    return acc;
  }

  function sfParamsTodos() { return sfParamsCapturar(); }

  function sfLandingUrl() {
    try { return w.sessionStorage.getItem(CHAVE_LANDING) || String(w.location.href).slice(0, 900); }
    catch (e) { return String(w.location.href).slice(0, 900); }
  }

  /**
   * Monta a URL de destino com os parametros herdados.
   * Precedencia (do mais fraco pro mais forte): herdados -> os que ja estavam na
   * propria URL de destino -> `extra`. Assim um destino que ja traz ?rlt=X&nod=1
   * nunca e atropelado pelo que veio do anuncio.
   *
   * @param {string} url     destino (com ou sem query propria)
   * @param {string} [extra] query extra ("a=1&b=2") que tem prioridade maxima
   * @param {string[]} [drop] chaves a nao herdar nesta chamada
   */
  function sfUrl(url, extra, drop) {
    url = String(url == null ? '' : url);
    try {
      var partes = url.split('#');
      var semHash = partes[0];
      var hash = partes.length > 1 ? ('#' + partes.slice(1).join('#')) : '';
      var basePartes = semHash.split('?');
      var base = basePartes[0];

      var q = new URLSearchParams();
      var herdados = sfParamsCapturar();
      var bloq = (drop || []).map(function (x) { return String(x).toLowerCase(); });
      Object.keys(herdados).forEach(function (k) {
        if (bloq.indexOf(k.toLowerCase()) === -1) q.set(k, herdados[k]);
      });
      // a query do proprio destino vence a herdada
      new URLSearchParams(basePartes.slice(1).join('?')).forEach(function (v, k) { q.set(k, v); });
      // e o `extra` vence todo mundo
      if (extra) new URLSearchParams(String(extra).replace(/^[?&]/, '')).forEach(function (v, k) { q.set(k, v); });

      var s = q.toString();
      return base + (s ? ('?' + s) : '') + hash;
    } catch (e) {
      // Fallback burro, mas que nunca deixa o comprador sem destino.
      var sep = url.indexOf('?') > -1 ? '&' : '?';
      var cur = '';
      try { cur = String(w.location.search || '').replace(/^\?/, ''); } catch (e2) {}
      return url + (cur ? (sep + cur) : '') + (extra ? ((cur ? '&' : sep) + extra) : '');
    }
  }

  /**
   * Objeto de rastreamento enviado ao POST do pedido. Vai TUDO que chegou na URL
   * (inclusive parametro proprio do gestor de trafego) mais a URL de entrada.
   */
  function sfTracking() {
    var t = {};
    var todos = sfParamsCapturar();
    Object.keys(todos).forEach(function (k) { t[k] = todos[k]; });
    // Campos canonicos sempre presentes (mesmo vazios): quem consome o webhook
    // espera a chave existindo.
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'src', 'sck', 'ttclid']
      .forEach(function (k) { if (t[k] == null) t[k] = ''; });
    if (!t.ttclid && todos.ttclickid) t.ttclid = todos.ttclickid;
    try {
      var cookie = String(w.document.cookie || '').match(/(?:^|;\s*)_ttp=([^;]*)/);
      if (!t.ttp && cookie) t.ttp = decodeURIComponent(cookie[1]);
    } catch (e) {}
    t.landing_url = sfLandingUrl();
    return t;
  }

  w.sfParamsTodos = sfParamsTodos;
  w.sfLandingUrl = sfLandingUrl;
  w.sfTracking = sfTracking;
  w.__sfq = sfUrl;
  sfParamsCapturar();
})(window);
