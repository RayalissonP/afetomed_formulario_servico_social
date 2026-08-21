// ============================================================================
// AFETOMED - Formulário de Avaliação Social
// Geração de PDF 100% com TEXTO REAL usando pdf-lib (sem html2canvas / jsPDF).
// O PDF é desenhado do zero (cabeçalho, títulos de seção, campos, respostas),
// lendo os valores diretamente dos campos do formulário em tela.
// ============================================================================

// Mantém o rodapé da página 2 sempre igual ao da página 1
function sincronizarRodape(){
  var origem = document.getElementById('endereco_instituto');
  var espelho = document.getElementById('endereco_instituto_espelho');
  if(!origem || !espelho) return;

  var texto = origem.value.trim() !== '' ? origem.value : origem.placeholder;
  espelho.textContent = texto;
}

function iniciarSincronizacaoRodape(){
  var origem = document.getElementById('endereco_instituto');
  if(!origem) return;
  origem.addEventListener('input', sincronizarRodape);
  sincronizarRodape();
}

iniciarSincronizacaoRodape();

// ---------------------------------------------------------------------------
// Campo de assinatura: upload de imagem + arraste livre dentro da caixa
// (suporta várias caixas no formulário, uma por página, cada uma independente)
// ---------------------------------------------------------------------------

function iniciarCamposAssinatura(){
  var caixas = document.querySelectorAll('.stamp-box');
  caixas.forEach(function(caixa){
    iniciarCampoAssinatura(caixa);
  });
}

function iniciarCampoAssinatura(caixa){
  var placeholder = caixa.querySelector('.stamp-placeholder');
  var botaoEnviar = caixa.querySelector('.btn-enviar-assinatura');
  var input = caixa.querySelector('.input-assinatura');
  if(!placeholder || !botaoEnviar || !input) return;

  botaoEnviar.addEventListener('click', function(){
    input.click();
  });

  input.addEventListener('change', function(){
    var arquivo = input.files && input.files[0];
    if(!arquivo) return;

    if(!/^image\/(png|jpeg)$/.test(arquivo.type)){
      alert('Envie a assinatura em formato PNG ou JPG.');
      input.value = '';
      return;
    }

    var leitor = new FileReader();
    leitor.onload = function(){
      inserirImagemAssinatura(caixa, placeholder, leitor.result, arquivo.type);
    };
    leitor.readAsDataURL(arquivo);
    input.value = '';
  });

  tornarCaixaRedimensionavel(caixa);
}

// Permite aumentar a altura da própria caixa de assinatura arrastando a
// alça na borda inferior. A altura padrão (já existente) é sempre o
// tamanho mínimo - o usuário só consegue aumentar, nunca deixar menor
// que o padrão original.
function tornarCaixaRedimensionavel(caixa){
  var alca = document.createElement('div');
  alca.className = 'stamp-box-resize-handle';
  alca.title = 'Arraste para aumentar a altura da caixa';
  caixa.appendChild(alca);

  var alturaMinima = null; // capturada na primeira interação (tamanho padrão atual)
  var redimensionando = false;
  var alturaInicialPx = 0;
  var pontoInicialY = 0;

  function iniciar(evento){
    redimensionando = true;
    if(alturaMinima === null){
      alturaMinima = caixa.getBoundingClientRect().height;
    }
    alturaInicialPx = caixa.getBoundingClientRect().height;
    pontoInicialY = evento.touches ? evento.touches[0].clientY : evento.clientY;
    evento.preventDefault();
    evento.stopPropagation();
  }

  function mover(evento){
    if(!redimensionando) return;
    var pontoY = evento.touches ? evento.touches[0].clientY : evento.clientY;
    var delta = pontoY - pontoInicialY;
    var alturaMaxima = 400; // teto generoso para evitar caixas absurdamente grandes

    var novaAltura = alturaInicialPx + delta;
    novaAltura = Math.max(alturaMinima, Math.min(novaAltura, alturaMaxima));

    caixa.style.height = novaAltura + 'px';
    caixa.dataset.alturaPersonalizada = '1';
    reposicionarConteudoDaCaixa(caixa);
    evento.preventDefault();
  }

  function soltar(){
    redimensionando = false;
  }

  alca.addEventListener('mousedown', iniciar);
  window.addEventListener('mousemove', mover);
  window.addEventListener('mouseup', soltar);

  alca.addEventListener('touchstart', iniciar, { passive: false });
  window.addEventListener('touchmove', mover, { passive: false });
  window.addEventListener('touchend', soltar);
}

// Depois de redimensionar a caixa, garante que a assinatura (se houver)
// continue totalmente dentro dos novos limites, e reposiciona a alça de
// redimensionar a imagem de acordo
function reposicionarConteudoDaCaixa(caixa){
  var img = caixa.querySelector('.stamp-img');
  if(!img) return;
  var alcaImagem = caixa.querySelector('.stamp-resize-handle');

  var caixaRect = caixa.getBoundingClientRect();
  var imgRect = img.getBoundingClientRect();

  var imgLeftPx = imgRect.left - caixaRect.left;
  var imgTopPx = imgRect.top - caixaRect.top;

  var novoTopPx = Math.max(0, Math.min(imgTopPx, caixaRect.height - imgRect.height));
  var novoLeftPx = Math.max(0, Math.min(imgLeftPx, caixaRect.width - imgRect.width));

  img.style.top = ((novoTopPx / caixaRect.height) * 100) + '%';
  img.style.left = ((novoLeftPx / caixaRect.width) * 100) + '%';

  if(alcaImagem) atualizarAlcaRedimensionamento(img, alcaImagem, caixa);
}

function inserirImagemAssinatura(caixa, placeholder, dataUrl, mime){
  // Remove uma assinatura anterior nesta mesma caixa, se existir
  var imgAntiga = caixa.querySelector('.stamp-img');
  if(imgAntiga) imgAntiga.remove();
  var botaoRemoverAntigo = caixa.querySelector('.stamp-remove-btn');
  if(botaoRemoverAntigo) botaoRemoverAntigo.remove();
  var alcaAntiga = caixa.querySelector('.stamp-resize-handle');
  if(alcaAntiga) alcaAntiga.remove();

  var img = document.createElement('img');
  img.className = 'stamp-img';
  img.draggable = false;
  img.dataset.mime = mime;
  img.dataset.dataUrl = dataUrl;

  var alca = document.createElement('div');
  alca.className = 'stamp-resize-handle';
  alca.title = 'Arraste para redimensionar';

  img.addEventListener('load', function(){
    var caixaRect = caixa.getBoundingClientRect();
    // Largura inicial proporcional à caixa, mantendo a proporção da imagem.
    // A largura é definida em % (da caixa) e a altura fica "auto" via
    // aspect-ratio: assim a assinatura nunca fica achatada nem esticada,
    // mesmo que a caixa mude de tamanho (ex.: layout compacto de impressão).
    var larguraInicialPx = Math.min(caixaRect.width * 0.32, img.naturalWidth);
    var alturaInicialPx = larguraInicialPx * (img.naturalHeight / img.naturalWidth);
    // Trava extra: mesmo para imagens de proporção incomum (muito altas),
    // o tamanho inicial nunca ultrapassa a própria altura da caixa
    if(alturaInicialPx > caixaRect.height * 0.85){
      var fatorAjuste = (caixaRect.height * 0.85) / alturaInicialPx;
      larguraInicialPx *= fatorAjuste;
      alturaInicialPx *= fatorAjuste;
    }
    img.style.width = ((larguraInicialPx / caixaRect.width) * 100) + '%';
    img.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
    img.style.height = 'auto';
    img.style.left = (((caixaRect.width - larguraInicialPx) / 2 / caixaRect.width) * 100) + '%';
    img.style.top = (((caixaRect.height - alturaInicialPx) / 2 / caixaRect.height) * 100) + '%';
    atualizarAlcaRedimensionamento(img, alca, caixa);
  });

  img.src = dataUrl;
  caixa.appendChild(img);
  placeholder.style.display = 'none';

  var botaoRemover = document.createElement('button');
  botaoRemover.type = 'button';
  botaoRemover.className = 'stamp-remove-btn';
  botaoRemover.title = 'Remover assinatura';
  botaoRemover.textContent = '×';
  botaoRemover.addEventListener('click', function(){
    img.remove();
    botaoRemover.remove();
    alca.remove();
    placeholder.style.display = '';
  });
  caixa.appendChild(botaoRemover);
  caixa.appendChild(alca);

  tornarArrastavel(img, alca, caixa);
  tornarRedimensionavel(img, alca, caixa);
}

// Reposiciona a alcinha de redimensionar no canto inferior direito da
// imagem, sempre que ela é movida ou tem o tamanho alterado
function atualizarAlcaRedimensionamento(img, alca, caixa){
  var caixaRect = caixa.getBoundingClientRect();
  var imgRect = img.getBoundingClientRect();
  var direitaPct = ((imgRect.right - caixaRect.left) / caixaRect.width) * 100;
  var baixoPct = ((imgRect.bottom - caixaRect.top) / caixaRect.height) * 100;
  alca.style.left = direitaPct + '%';
  alca.style.top = baixoPct + '%';
}

// Permite arrastar a imagem livremente dentro dos limites da caixa.
// A posição é sempre salva em % (da caixa), nunca em pixels fixos, para
// continuar válida e sem "vazar" mesmo se a caixa mudar de tamanho.
function tornarArrastavel(img, alca, caixa){
  var arrastando = false;
  var offsetX = 0;
  var offsetY = 0;

  function iniciar(evento){
    arrastando = true;
    var pontoX = evento.touches ? evento.touches[0].clientX : evento.clientX;
    var pontoY = evento.touches ? evento.touches[0].clientY : evento.clientY;
    var imgRect = img.getBoundingClientRect();
    offsetX = pontoX - imgRect.left;
    offsetY = pontoY - imgRect.top;
    evento.preventDefault();
  }

  function mover(evento){
    if(!arrastando) return;
    var pontoX = evento.touches ? evento.touches[0].clientX : evento.clientX;
    var pontoY = evento.touches ? evento.touches[0].clientY : evento.clientY;
    var caixaRect = caixa.getBoundingClientRect();
    var imgRect = img.getBoundingClientRect();

    var novoLeft = pontoX - offsetX - caixaRect.left;
    var novoTop = pontoY - offsetY - caixaRect.top;

    // Mantém a assinatura sempre dentro dos limites visíveis da caixa
    novoLeft = Math.max(0, Math.min(novoLeft, caixaRect.width - imgRect.width));
    novoTop = Math.max(0, Math.min(novoTop, caixaRect.height - imgRect.height));

    img.style.left = ((novoLeft / caixaRect.width) * 100) + '%';
    img.style.top = ((novoTop / caixaRect.height) * 100) + '%';
    atualizarAlcaRedimensionamento(img, alca, caixa);
    evento.preventDefault();
  }

  function soltar(){
    arrastando = false;
  }

  img.addEventListener('mousedown', iniciar);
  window.addEventListener('mousemove', mover);
  window.addEventListener('mouseup', soltar);

  img.addEventListener('touchstart', iniciar, { passive: false });
  window.addEventListener('touchmove', mover, { passive: false });
  window.addEventListener('touchend', soltar);
}

// Permite redimensionar a imagem arrastando a alcinha no canto inferior
// direito. A proporção original é sempre preservada (a largura é ajustada
// em % e a altura acompanha automaticamente via aspect-ratio), e o
// tamanho nunca ultrapassa os limites da caixa.
function tornarRedimensionavel(img, alca, caixa){
  var redimensionando = false;
  var larguraInicialPx = 0;
  var pontoInicialX = 0;
  var proporcao = 1;

  function iniciar(evento){
    redimensionando = true;
    var imgRect = img.getBoundingClientRect();
    larguraInicialPx = imgRect.width;
    proporcao = img.naturalWidth / img.naturalHeight;
    pontoInicialX = evento.touches ? evento.touches[0].clientX : evento.clientX;
    evento.preventDefault();
    evento.stopPropagation();
  }

  function mover(evento){
    if(!redimensionando) return;
    var pontoX = evento.touches ? evento.touches[0].clientX : evento.clientX;
    var delta = pontoX - pontoInicialX;

    var caixaRect = caixa.getBoundingClientRect();
    var imgRect = img.getBoundingClientRect();
    var imgLeftPx = imgRect.left - caixaRect.left;
    var imgTopPx = imgRect.top - caixaRect.top;

    var larguraMinima = 28;
    var larguraMaxPelaLargura = caixaRect.width - imgLeftPx; // não passa da borda direita
    var alturaMaxPelaCaixa = caixaRect.height - imgTopPx; // não passa da borda inferior
    var larguraMaxPelaAltura = alturaMaxPelaCaixa * proporcao;

    var novaLargura = larguraInicialPx + delta;
    novaLargura = Math.max(larguraMinima, Math.min(novaLargura, larguraMaxPelaLargura, larguraMaxPelaAltura));

    img.style.width = ((novaLargura / caixaRect.width) * 100) + '%';
    atualizarAlcaRedimensionamento(img, alca, caixa);
    evento.preventDefault();
  }

  function soltar(){
    redimensionando = false;
  }

  alca.addEventListener('mousedown', iniciar);
  window.addEventListener('mousemove', mover);
  window.addEventListener('mouseup', soltar);

  alca.addEventListener('touchstart', iniciar, { passive: false });
  window.addEventListener('touchmove', mover, { passive: false });
  window.addEventListener('touchend', soltar);
}

iniciarCamposAssinatura();

// Monta um nome de arquivo seguro a partir do nome do paciente digitado no formulário
function montarNomeArquivoPDF(){
  var campoNome = document.getElementById('nome_paciente');
  var nome = campoNome && campoNome.value ? campoNome.value.trim() : '';

  if(nome === ''){
    return 'AFETOMED Avaliação Social.pdf';
  }

  var nomeLimpo = nome
    .replace(/[\\/:*?"<>|]/g, '') // remove caracteres inválidos em nomes de arquivo
    .trim()
    .replace(/\s+/g, ' '); // normaliza espaços múltiplos

  return 'AFETOMED Avaliação Social - Paciente ' + nomeLimpo + '.pdf';
}

// ---------------------------------------------------------------------------
// Utilidades de leitura do formulário
// ---------------------------------------------------------------------------

function valorDoCampo(nome){
  var el = document.querySelector('[name="' + nome + '"]');
  if(!el) return '';
  return (el.value || '').trim();
}

function valorDoRadio(nome){
  var el = document.querySelector('input[name="' + nome + '"]:checked');
  return el ? el.value : '';
}

function valorDoRodape(){
  var origem = document.getElementById('endereco_instituto');
  if(!origem) return '';
  return origem.value.trim() !== '' ? origem.value.trim() : origem.placeholder;
}

// Converte uma string base64 (sem prefixo data:) em Uint8Array
function base64ParaBytes(base64){
  var binario = atob(base64);
  var bytes = new Uint8Array(binario.length);
  for(var i = 0; i < binario.length; i++){
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Motor de desenho do PDF (coordenadas medidas de cima para baixo, em pontos)
// ---------------------------------------------------------------------------

var PAGE_W = 595.28;  // A4 retrato, em pontos
var PAGE_H = 841.89;
var MARGEM = 36;
var LARGURA_CONTEUDO = PAGE_W - (MARGEM * 2);
var GAP_COLUNAS = 14;
var LARGURA_COLUNA = (LARGURA_CONTEUDO - GAP_COLUNAS) / 2;

var COR_TEAL = null;       // definidas em criarContexto(), quando PDFLib já está disponível
var COR_TEXTO = null;
var COR_LABEL = null;
var COR_BORDA = null;
var COR_BRANCO = null;
var COR_RODAPE = null;
var COR_PLACEHOLDER = null;

function criarContexto(pdfDoc, fonteRegular, fonteNegrito, logoImagem){
  var rgb = window.PDFLib.rgb;
  COR_TEAL = rgb(0x0c/255, 0x68/255, 0x69/255);
  COR_TEXTO = rgb(0x2b/255, 0x2b/255, 0x2b/255);
  COR_LABEL = COR_TEAL;
  COR_BORDA = rgb(0xb9/255, 0xb9/255, 0xb9/255);
  COR_BRANCO = rgb(1, 1, 1);
  COR_RODAPE = rgb(0x6b/255, 0x7b/255, 0x87/255);
  COR_PLACEHOLDER = rgb(0x9a/255, 0x9a/255, 0x9a/255);

  return {
    pdfDoc: pdfDoc,
    fontRegular: fonteRegular,
    fontBold: fonteNegrito,
    logoImagem: logoImagem,
    page: null,
    y: 0 // distância do topo da página até o próximo ponto livre para desenhar
  };
}

// Converte uma distância-do-topo em coordenada Y do pdf-lib (origem embaixo)
function yPdf(topoY){
  return PAGE_H - topoY;
}

function desenharTexto(ctx, texto, x, topoY, opcoes){
  opcoes = opcoes || {};
  var tamanho = opcoes.tamanho || 10;
  var fonte = opcoes.negrito ? ctx.fontBold : ctx.fontRegular;
  var cor = opcoes.cor || COR_TEXTO;
  ctx.page.drawText(texto, {
    x: x,
    y: yPdf(topoY + tamanho),
    size: tamanho,
    font: fonte,
    color: cor
  });
}

function desenharRetangulo(ctx, x, topoY, largura, altura, opcoes){
  opcoes = opcoes || {};
  var params = {
    x: x,
    y: yPdf(topoY + altura),
    width: largura,
    height: altura
  };
  if(opcoes.preenchimento) params.color = opcoes.preenchimento;
  if(opcoes.borda){
    params.borderColor = opcoes.borda;
    params.borderWidth = opcoes.espessuraBorda || 1;
    if(opcoes.tracejado){
      params.borderDashArray = [3, 2];
    }
  }
  ctx.page.drawRectangle(params);
}

// Quebra um texto em várias linhas para caber em uma largura máxima
function quebrarTexto(ctx, texto, fonte, tamanho, larguraMaxima){
  texto = (texto || '').toString();
  if(texto === '') return [''];

  var palavras = texto.split(/\s+/);
  var linhas = [];
  var linhaAtual = '';

  for(var i = 0; i < palavras.length; i++){
    var palavra = palavras[i];
    var candidata = linhaAtual === '' ? palavra : (linhaAtual + ' ' + palavra);

    if(fonte.widthOfTextAtSize(candidata, tamanho) <= larguraMaxima){
      linhaAtual = candidata;
    }else{
      if(linhaAtual !== '') linhas.push(linhaAtual);

      // Palavra isolada maior que a largura disponível: quebra por caractere
      if(fonte.widthOfTextAtSize(palavra, tamanho) > larguraMaxima){
        var parcial = '';
        for(var c = 0; c < palavra.length; c++){
          var testeParcial = parcial + palavra[c];
          if(fonte.widthOfTextAtSize(testeParcial, tamanho) > larguraMaxima && parcial !== ''){
            linhas.push(parcial);
            parcial = palavra[c];
          }else{
            parcial = testeParcial;
          }
        }
        linhaAtual = parcial;
      }else{
        linhaAtual = palavra;
      }
    }
  }
  if(linhaAtual !== '') linhas.push(linhaAtual);
  return linhas.length ? linhas : [''];
}

// Cria uma nova página, desenha o cabeçalho padrão (logo + título) e
// posiciona o cursor "y" logo abaixo dele
function novaPagina(ctx){
  ctx.page = ctx.pdfDoc.addPage([PAGE_W, PAGE_H]);

  var alturaTopbar = 62;
  desenharRetangulo(ctx, 0, 0, PAGE_W, alturaTopbar, { preenchimento: COR_TEAL });

  // Logo (caixa branca simulando o círculo/quadrado branco do cabeçalho)
  var logoTam = 42;
  var logoX = MARGEM;
  var logoY = (alturaTopbar - logoTam) / 2;
  desenharRetangulo(ctx, logoX, logoY, logoTam, logoTam, { preenchimento: COR_BRANCO });

  if(ctx.logoImagem){
    var escala = Math.min(
      (logoTam - 8) / ctx.logoImagem.width,
      (logoTam - 8) / ctx.logoImagem.height
    );
    var imgLargura = ctx.logoImagem.width * escala;
    var imgAltura = ctx.logoImagem.height * escala;
    ctx.page.drawImage(ctx.logoImagem, {
      x: logoX + (logoTam - imgLargura) / 2,
      y: yPdf(logoY + (logoTam + imgAltura) / 2),
      width: imgLargura,
      height: imgAltura
    });
  }

  desenharTexto(ctx, 'AFETOMED - SAÚDE DOMICILIAR', logoX + logoTam + 14, logoY + 6, {
    tamanho: 15, negrito: true, cor: COR_BRANCO
  });
  desenharTexto(ctx, 'Formulário de Avaliação Social', logoX + logoTam + 14, logoY + 24, {
    tamanho: 9, cor: COR_BRANCO
  });

  ctx.y = alturaTopbar + 16;
}

function garantirEspaco(ctx, alturaNecessaria){
  var limiteInferior = PAGE_H - MARGEM;
  if(ctx.y + alturaNecessaria > limiteInferior){
    novaPagina(ctx);
  }
}

function desenharTituloSecao(ctx, texto, alturaConteudoSeguinte){
  // Reserva também o espaço do conteúdo logo abaixo (quando informado),
  // para o título nunca ficar "órfão" no fim de uma página
  garantirEspaco(ctx, 26 + (alturaConteudoSeguinte || 0));
  var altura = 20;
  desenharRetangulo(ctx, 0, ctx.y, PAGE_W, altura, { preenchimento: COR_TEAL });
  desenharTexto(ctx, texto, MARGEM, ctx.y + 4, { tamanho: 10.5, negrito: true, cor: COR_BRANCO });
  ctx.y += altura + 5;
}

// Desenha rodapé fixo perto do final da página atual (um pouco mais colado
// à borda inferior da folha, para não ficar espremido contra o último campo)
function desenharRodape(ctx, texto){
  var topoY = PAGE_H - MARGEM + 6;
  topoY = Math.max(topoY, ctx.y + 14); // nunca sobrepõe o conteúdo, se ele for até mais longe
  centralizarTexto(ctx, 'AFETOMED - Saúde Domiciliar', topoY, { tamanho: 8.5, cor: COR_RODAPE });
  centralizarTexto(ctx, texto, topoY + 12, { tamanho: 8, cor: COR_RODAPE });
}

function centralizarTexto(ctx, texto, topoY, opcoes){
  opcoes = opcoes || {};
  var tamanho = opcoes.tamanho || 10;
  var fonte = opcoes.negrito ? ctx.fontBold : ctx.fontRegular;
  var largura = fonte.widthOfTextAtSize(texto, tamanho);
  var x = (PAGE_W - largura) / 2;
  desenharTexto(ctx, texto, x, topoY, opcoes);
}

// ---------------------------------------------------------------------------
// Desenho de campos (label + caixa de valor, ou grupo Sim/Não)
// ---------------------------------------------------------------------------

var ALTURA_LABEL = 9;          // rótulo (~10px = 7.5pt no CSS de impressão, +ajuste de linha)
var GAP_LABEL_CAIXA = 3;       // equivalente ao margin-bottom:3px do rótulo no @media print
var ALTURA_LINHA_VALOR = 11;   // altura de cada linha de texto dentro da caixa
var PADDING_CAIXA = 4;         // equivalente ao padding:4px 6px do input no @media print
var ALTURA_MIN_CAIXA = 15;     // altura mínima de uma caixa de 1 linha
var ESPACO_ENTRE_LINHAS = 7;   // espaço entre uma linha de campos e a próxima
var TAM_FONTE_LABEL = 7.5;
var TAM_FONTE_VALOR = 9;

function calcularAlturaCampo(ctx, campo, largura){
  if(campo.tipo === 'radio'){
    return ALTURA_LABEL + GAP_LABEL_CAIXA + 12;
  }
  var valor = valorDoCampo(campo.nome);
  var larguraTexto = largura - (PADDING_CAIXA * 2);

  if(campo.multilinha){
    var linhasMulti = quebrarTexto(ctx, valor || ' ', ctx.fontRegular, TAM_FONTE_VALOR, larguraTexto);
    var minLinhas = campo.minLinhas || 6;
    var nLinhas = Math.max(linhasMulti.length, minLinhas);
    var alturaCaixaMulti = (nLinhas * ALTURA_LINHA_VALOR) + (PADDING_CAIXA * 2);
    return ALTURA_LABEL + GAP_LABEL_CAIXA + alturaCaixaMulti;
  }

  var linhas = quebrarTexto(ctx, valor || ' ', ctx.fontRegular, TAM_FONTE_VALOR, larguraTexto);
  var alturaCaixa = Math.max(ALTURA_MIN_CAIXA, (linhas.length * ALTURA_LINHA_VALOR) + (PADDING_CAIXA * 2));
  return ALTURA_LABEL + GAP_LABEL_CAIXA + alturaCaixa;
}

function desenharCampo(ctx, campo, x, topoY, largura, alturaLinha){
  // Rótulo
  desenharTexto(ctx, campo.rotulo, x, topoY, { tamanho: TAM_FONTE_LABEL, negrito: true, cor: COR_LABEL });

  var topoCaixa = topoY + ALTURA_LABEL + GAP_LABEL_CAIXA;
  var alturaCaixa = alturaLinha - ALTURA_LABEL - GAP_LABEL_CAIXA;

  if(campo.tipo === 'radio'){
    var valorSelecionado = valorDoRadio(campo.nome);
    desenharOpcaoRadio(ctx, x, topoCaixa + 1, 'Sim', valorSelecionado === 'Sim');
    desenharOpcaoRadio(ctx, x + 62, topoCaixa + 1, 'Não', valorSelecionado === 'Não');
    return;
  }

  // Caixa com borda
  desenharRetangulo(ctx, x, topoCaixa, largura, alturaCaixa, {
    preenchimento: COR_BRANCO,
    borda: COR_BORDA,
    espessuraBorda: 1
  });

  var valor = valorDoCampo(campo.nome);
  var larguraTexto = largura - (PADDING_CAIXA * 2);
  if(valor === ''){
    desenharTexto(ctx, '—', x + PADDING_CAIXA, topoCaixa + PADDING_CAIXA - 1, {
      tamanho: TAM_FONTE_VALOR, cor: COR_PLACEHOLDER
    });
  }else{
    var linhas = quebrarTexto(ctx, valor, ctx.fontRegular, TAM_FONTE_VALOR, larguraTexto);
    for(var i = 0; i < linhas.length; i++){
      desenharTexto(ctx, linhas[i], x + PADDING_CAIXA, topoCaixa + PADDING_CAIXA - 1 + (i * ALTURA_LINHA_VALOR), {
        tamanho: TAM_FONTE_VALOR, cor: COR_TEXTO
      });
    }
  }
}

// Desenha um botão de opção redondo (radio button de verdade), com um ponto
// preenchido no centro quando selecionado - igual ao <input type="radio">.
function desenharOpcaoRadio(ctx, x, topoY, texto, marcado){
  var diametro = 8;
  var raio = diametro / 2;
  var centroX = x + raio;
  var centroYpdf = yPdf(topoY + raio);

  ctx.page.drawEllipse({
    x: centroX,
    y: centroYpdf,
    xScale: raio,
    yScale: raio,
    color: COR_BRANCO,
    borderColor: COR_BORDA,
    borderWidth: 1
  });

  if(marcado){
    var raioInterno = raio - 2.2;
    ctx.page.drawEllipse({
      x: centroX,
      y: centroYpdf,
      xScale: raioInterno,
      yScale: raioInterno,
      color: COR_TEAL
    });
  }

  desenharTexto(ctx, texto, x + diametro + 4, topoY - 1, { tamanho: TAM_FONTE_VALOR, cor: COR_TEXTO });
}

// Desenha uma lista de campos organizados em grade de 2 colunas.
// Campos com "largo: true" ocupam a linha inteira sozinhos.
function desenharGrade(ctx, campos){
  var i = 0;
  while(i < campos.length){
    var campo = campos[i];

    if(campo.largo){
      var altura = calcularAlturaCampo(ctx, campo, LARGURA_CONTEUDO);
      garantirEspaco(ctx, altura + ESPACO_ENTRE_LINHAS);
      desenharCampo(ctx, campo, MARGEM, ctx.y, LARGURA_CONTEUDO, altura);
      ctx.y += altura + ESPACO_ENTRE_LINHAS;
      i += 1;
      continue;
    }

    var campoEsquerda = campo;
    var campoDireita = campos[i + 1] && !campos[i + 1].largo ? campos[i + 1] : null;

    var alturaEsquerda = calcularAlturaCampo(ctx, campoEsquerda, LARGURA_COLUNA);
    var alturaDireita = campoDireita ? calcularAlturaCampo(ctx, campoDireita, LARGURA_COLUNA) : 0;
    var alturaLinha = Math.max(alturaEsquerda, alturaDireita);

    garantirEspaco(ctx, alturaLinha + ESPACO_ENTRE_LINHAS);

    desenharCampo(ctx, campoEsquerda, MARGEM, ctx.y, LARGURA_COLUNA, alturaLinha);
    if(campoDireita){
      desenharCampo(ctx, campoDireita, MARGEM + LARGURA_COLUNA + GAP_COLUNAS, ctx.y, LARGURA_COLUNA, alturaLinha);
    }

    ctx.y += alturaLinha + ESPACO_ENTRE_LINHAS;
    i += campoDireita ? 2 : 1;
  }
}

// ---------------------------------------------------------------------------
// Campo de assinatura (imagem enviada pelo usuário, posicionada livremente)
// ---------------------------------------------------------------------------

var PADDING_ASSINATURA = 5;
var ALTURA_TETO_ASSINATURA = 220; // pt - teto de segurança absoluto (evita algo absurdo)
var ALTURA_PADRAO_ASSINATURA = 34; // pt - usado só se a caixa não for encontrada no DOM

// Lê o estado atual (em pixels) de uma caixa de assinatura no DOM: o
// tamanho da própria caixa (que o usuário pode ter aumentado arrastando a
// alça inferior) e, se houver, a posição/tamanho da imagem dentro dela.
// idAssinatura identifica qual caixa ler (atributo data-assinatura-id).
function obterEstadoCaixaAssinatura(idAssinatura){
  var caixa = document.querySelector('.stamp-box[data-assinatura-id="' + idAssinatura + '"]');
  if(!caixa) return null;

  var caixaRect = caixa.getBoundingClientRect();
  if(caixaRect.width === 0) return null;

  var estado = {
    caixaLarguraPx: caixaRect.width,
    caixaAlturaPx: caixaRect.height,
    // Só true se o usuário arrastou a alça de redimensionar a caixa.
    // Sem isso, a altura "natural" da caixa vazia (que inclui o texto e o
    // botão do placeholder) não deve ditar o tamanho no PDF.
    alturaPersonalizada: caixa.dataset.alturaPersonalizada === '1',
    temImagem: false
  };

  var img = caixa.querySelector('.stamp-img');
  if(img && img.dataset.dataUrl){
    var imgRect = img.getBoundingClientRect();
    estado.temImagem = true;
    estado.dataUrl = img.dataset.dataUrl;
    estado.mime = img.dataset.mime;
    estado.imgLeftPx = imgRect.left - caixaRect.left;
    estado.imgTopPx = imgRect.top - caixaRect.top;
    estado.imgLarguraPx = imgRect.width;
    estado.imgAlturaPx = imgRect.height;
  }

  return estado;
}

// Calcula, em pontos do PDF, a altura da caixa e a posição/tamanho da
// imagem dentro dela - sempre com a mesma escala nos dois eixos (preserva
// a proporção original, sem esticar nem achatar a assinatura). A altura
// da caixa no PDF acompanha a altura que o usuário deixou na tela quando
// há imagem ou quando ele redimensionou manualmente a caixa; caso
// contrário usa um tamanho padrão compacto (a caixa vazia com o
// placeholder de texto/botão fica mais alta que o necessário no PDF).
function calcularLayoutAssinatura(assinatura){
  if(!assinatura){
    return { temImagem: false, alturaCaixa: ALTURA_PADRAO_ASSINATURA };
  }

  var escala = LARGURA_CONTEUDO / assinatura.caixaLarguraPx;

  if(!assinatura.temImagem){
    var alturaVazia = assinatura.alturaPersonalizada
      ? Math.min(assinatura.caixaAlturaPx * escala, ALTURA_TETO_ASSINATURA)
      : ALTURA_PADRAO_ASSINATURA;
    return { temImagem: false, alturaCaixa: alturaVazia };
  }

  var alturaCaixa = Math.min(assinatura.caixaAlturaPx * escala, ALTURA_TETO_ASSINATURA);
  var offsetX = assinatura.imgLeftPx * escala;
  var offsetY = assinatura.imgTopPx * escala;
  var largura = assinatura.imgLarguraPx * escala;
  var altura = assinatura.imgAlturaPx * escala;

  // Segurança: a imagem já fica sempre dentro da caixa na tela, mas se o
  // teto de segurança acima cortou a altura da caixa, reduz a imagem na
  // mesma proporção para continuar cabendo
  if((offsetY + altura + PADDING_ASSINATURA) > alturaCaixa){
    var fator = alturaCaixa / (offsetY + altura + PADDING_ASSINATURA);
    offsetX *= fator;
    offsetY *= fator;
    largura *= fator;
    altura *= fator;
  }

  return {
    temImagem: true,
    alturaCaixa: alturaCaixa,
    offsetX: offsetX,
    offsetY: offsetY,
    largura: largura,
    altura: altura
  };
}

function desenharSecaoAssinatura(ctx, tituloSecao, rotuloCampo, assinatura){
  var layout = calcularLayoutAssinatura(assinatura);
  var alturaConteudo = ALTURA_LABEL + GAP_LABEL_CAIXA + layout.alturaCaixa + ESPACO_ENTRE_LINHAS;
  desenharTituloSecao(ctx, tituloSecao, alturaConteudo);

  desenharTexto(ctx, rotuloCampo, MARGEM, ctx.y, {
    tamanho: TAM_FONTE_LABEL, negrito: true, cor: COR_LABEL
  });
  var topoCaixa = ctx.y + ALTURA_LABEL + GAP_LABEL_CAIXA;

  desenharRetangulo(ctx, MARGEM, topoCaixa, LARGURA_CONTEUDO, layout.alturaCaixa, {
    preenchimento: COR_BRANCO,
    borda: COR_BORDA,
    espessuraBorda: 1,
    tracejado: true
  });

  if(layout.temImagem && assinatura.imagemEmbed){
    ctx.page.drawImage(assinatura.imagemEmbed, {
      x: MARGEM + layout.offsetX,
      y: yPdf(topoCaixa + layout.offsetY + layout.altura),
      width: layout.largura,
      height: layout.altura
    });
  }else{
    centralizarTexto(ctx, 'Assinatura não enviada', topoCaixa + (layout.alturaCaixa / 2) - 4, {
      tamanho: 9, cor: COR_PLACEHOLDER
    });
  }

  ctx.y = topoCaixa + layout.alturaCaixa + ESPACO_ENTRE_LINHAS;
}

// Lê o estado de uma caixa específica do DOM e, se houver imagem, já a
// embute no pdfDoc, pronta para ser desenhada. Retorna null apenas se a
// caixa em si não existir no DOM.
async function prepararAssinaturaParaPDF(pdfDoc, idAssinatura){
  var estado = obterEstadoCaixaAssinatura(idAssinatura);
  if(!estado) return null;
  if(!estado.temImagem) return estado;

  try{
    var bytes = base64ParaBytes(estado.dataUrl.split(',')[1]);
    estado.imagemEmbed = estado.mime === 'image/png'
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
    return estado;
  }catch(erro){
    console.warn('Não foi possível incluir a assinatura (' + idAssinatura + ') no PDF:', erro);
    estado.temImagem = false;
    return estado;
  }
}

// Linha especial de endereço (4 colunas de larguras diferentes)
function desenharLinhaEndereco(ctx){
  var proporcoes = [1.1, 0.8, 1.1, 0.6];
  var somaProp = proporcoes.reduce(function(a, b){ return a + b; }, 0);
  var gapTotal = GAP_COLUNAS * (proporcoes.length - 1);
  var larguraUtil = LARGURA_CONTEUDO - gapTotal;

  var larguras = proporcoes.map(function(p){ return (p / somaProp) * larguraUtil; });
  var campos = [
    { rotulo: 'Município', nome: 'municipio' },
    { rotulo: 'Bairro', nome: 'bairro' },
    { rotulo: 'Logradouro', nome: 'logradouro' },
    { rotulo: 'Número', nome: 'numero' }
  ];

  // Mede a altura das caixas antes de desenhar qualquer coisa, para poder
  // garantir espaço (e quebrar página, se preciso) sem deixar rótulos órfãos
  var alturaMax = 0;
  for(var i = 0; i < campos.length; i++){
    var valorMedido = valorDoCampo(campos[i].nome);
    var linhasMedidas = quebrarTexto(ctx, valorMedido || ' ', ctx.fontRegular, TAM_FONTE_VALOR, larguras[i] - PADDING_CAIXA * 2);
    var alturaMedida = Math.max(ALTURA_MIN_CAIXA, (linhasMedidas.length * ALTURA_LINHA_VALOR) + PADDING_CAIXA * 2);
    alturaMax = Math.max(alturaMax, alturaMedida);
  }

  var alturaTotal = ALTURA_LABEL + GAP_LABEL_CAIXA + ALTURA_LABEL + GAP_LABEL_CAIXA + alturaMax + ESPACO_ENTRE_LINHAS;
  garantirEspaco(ctx, alturaTotal);

  desenharTexto(ctx, 'ENDEREÇO:', MARGEM, ctx.y, { tamanho: TAM_FONTE_LABEL, negrito: true, cor: COR_LABEL });
  var topoColunas = ctx.y + ALTURA_LABEL + GAP_LABEL_CAIXA;
  var topoCaixas = topoColunas + ALTURA_LABEL + GAP_LABEL_CAIXA;

  var x = MARGEM;
  for(var j = 0; j < campos.length; j++){
    desenharTexto(ctx, campos[j].rotulo, x, topoColunas, { tamanho: TAM_FONTE_LABEL, negrito: true, cor: COR_LABEL });
    desenharRetangulo(ctx, x, topoCaixas, larguras[j], alturaMax, {
      preenchimento: COR_BRANCO, borda: COR_BORDA, espessuraBorda: 1
    });
    var valorCampo = valorDoCampo(campos[j].nome);
    if(valorCampo === ''){
      desenharTexto(ctx, '—', x + PADDING_CAIXA, topoCaixas + PADDING_CAIXA - 1, { tamanho: TAM_FONTE_VALOR, cor: COR_PLACEHOLDER });
    }else{
      var linhasCampo = quebrarTexto(ctx, valorCampo, ctx.fontRegular, TAM_FONTE_VALOR, larguras[j] - PADDING_CAIXA * 2);
      for(var k = 0; k < linhasCampo.length; k++){
        desenharTexto(ctx, linhasCampo[k], x + PADDING_CAIXA, topoCaixas + PADDING_CAIXA - 1 + (k * ALTURA_LINHA_VALOR), { tamanho: TAM_FONTE_VALOR, cor: COR_TEXTO });
      }
    }
    x += larguras[j] + GAP_COLUNAS;
  }

  ctx.y = topoCaixas + alturaMax + ESPACO_ENTRE_LINHAS;
}

// ---------------------------------------------------------------------------
// Definição do conteúdo do formulário (página 1 e página 2)
// ---------------------------------------------------------------------------

function montarPagina1(ctx){
  novaPagina(ctx);

  desenharTituloSecao(ctx, 'INFORMAÇÕES BÁSICAS DO PACIENTE');
  desenharGrade(ctx, [
    { tipo: 'text', rotulo: 'Nome Completo', nome: 'nome_paciente', largo: true },
    { tipo: 'text', rotulo: 'CPF', nome: 'cpf_paciente' },
    { tipo: 'text', rotulo: 'CNS (Cartão Nacional de Saúde)', nome: 'cns_paciente' },
    { tipo: 'text', rotulo: 'Estado Civil', nome: 'estado_civil', largo: true }
  ]);
  desenharLinhaEndereco(ctx);

  desenharTituloSecao(ctx, 'INFORMAÇÕES DO CUIDADOR');
  desenharGrade(ctx, [
    { tipo: 'radio', rotulo: 'Possui Cuidador?', nome: 'possui_cuidador' },
    { tipo: 'text', rotulo: 'Nome do Cuidador', nome: 'nome_cuidador' },
    { tipo: 'text', rotulo: 'Parentesco', nome: 'parentesco_cuidador' },
    { tipo: 'text', rotulo: 'Telefone', nome: 'telefone_cuidador' },
    { tipo: 'radio', rotulo: 'Cuidador Presente?', nome: 'cuidador_presente' },
    { tipo: 'radio', rotulo: 'Cuidador Ativo?', nome: 'cuidador_ativo' }
  ]);

  desenharTituloSecao(ctx, 'QUESTIONÁRIO DA RESIDÊNCIA');
  desenharGrade(ctx, [
    { tipo: 'text', rotulo: 'Quantidade de Pessoas', nome: 'qtd_pessoas' },
    { tipo: 'text', rotulo: 'Quantidade de Rendas', nome: 'qtd_rendas' },
    { tipo: 'radio', rotulo: 'Domicílio em Área de Risco?', nome: 'area_risco' },
    { tipo: 'radio', rotulo: 'Apto a Receber?', nome: 'apto_receber' }
  ]);

  desenharTituloSecao(ctx, 'INFRAESTRUTURA DO DOMICÍLIO');
  desenharGrade(ctx, [
    { tipo: 'text', rotulo: 'Condições da Habitação', nome: 'condicoes_habitacao' },
    { tipo: 'text', rotulo: 'Higiene do Domicílio', nome: 'higiene_domicilio' },
    { tipo: 'radio', rotulo: 'Água Potável?', nome: 'agua_potavel' },
    { tipo: 'radio', rotulo: 'Saneamento Interno?', nome: 'saneamento_interno' },
    { tipo: 'radio', rotulo: 'Rede de Esgoto?', nome: 'rede_esgoto' },
    { tipo: 'radio', rotulo: 'Energia Elétrica', nome: 'energia_eletrica' }
  ]);

  desenharTituloSecao(ctx, 'ACESSIBILIDADE');
  desenharGrade(ctx, [
    { tipo: 'radio', rotulo: 'Acesso Cadeira de Rodas?', nome: 'acesso_cadeira' },
    { tipo: 'radio', rotulo: 'Cômodos Acessíveis?', nome: 'comodos_acessiveis' },
    { tipo: 'radio', rotulo: 'Possui Animais?', nome: 'possui_animais' },
    { tipo: 'text', rotulo: 'Quais Animais?', nome: 'quais_animais' }
  ]);

  desenharSecaoAssinatura(ctx, 'ASSINATURA', 'Assinatura do Paciente/Responsável', ctx.assinaturaPagina1);

  desenharRodape(ctx, valorDoRodape());
}

function montarPagina2(ctx){
  novaPagina(ctx);

  desenharTituloSecao(ctx, 'RECURSOS DE SAÚDE');
  desenharGrade(ctx, [
    { tipo: 'radio', rotulo: 'Recursos Próximos?', nome: 'recursos_proximos' },
    { tipo: 'text', rotulo: 'Qual Recurso?', nome: 'qual_recurso' },
    { tipo: 'radio', rotulo: 'Assistido por UBS?', nome: 'assistido_ubs' },
    { tipo: 'text', rotulo: 'Serviço Móvel Emergencial', nome: 'servico_movel' },
    { tipo: 'radio', rotulo: 'Hospital Geral?', nome: 'hospital_geral' },
    { tipo: 'radio', rotulo: 'Hospital com UTI?', nome: 'hospital_uti' }
  ]);

  desenharTituloSecao(ctx, 'INFORMAÇÕES DE RENDA');
  desenharGrade(ctx, [
    { tipo: 'text', rotulo: 'Renda Principal', nome: 'renda_principal' },
    { tipo: 'text', rotulo: 'Qtd. Salários Mínimos', nome: 'qtd_salarios' },
    { tipo: 'radio', rotulo: 'Recebe Auxílio?', nome: 'recebe_auxilio' },
    { tipo: 'text', rotulo: 'Qual Auxílio?', nome: 'qual_auxilio' },
    { tipo: 'radio', rotulo: 'Família em Home Care?', nome: 'familia_home_care', largo: true }
  ]);

  desenharTituloSecao(ctx, 'PARECER SOCIAL');
  desenharGrade(ctx, [
    { tipo: 'text', rotulo: 'Parecer', nome: 'parecer_social', largo: true, multilinha: true, minLinhas: 7 }
  ]);

  desenharTituloSecao(ctx, 'PROFISSIONAL RESPONSÁVEL');
  desenharGrade(ctx, [
    { tipo: 'text', rotulo: 'Nome do Profissional', nome: 'nome_profissional' },
    { tipo: 'text', rotulo: 'CRESS/CRM', nome: 'cress_crm' },
    { tipo: 'text', rotulo: 'Telefone', nome: 'telefone_profissional' },
    { tipo: 'text', rotulo: 'Data da Avaliação', nome: 'data_avaliacao' }
  ]);

  desenharSecaoAssinatura(ctx, 'ASSINATURA', 'Assinatura do Profissional Responsável', ctx.assinaturaPagina2);

  desenharRodape(ctx, valorDoRodape());
}

// ---------------------------------------------------------------------------
// Função principal: monta o PDF com pdf-lib e dispara o download
// ---------------------------------------------------------------------------

async function baixarPDF(){
  var botao = document.getElementById('btnBaixarPDF');
  var textoOriginalBotao = botao.textContent;

  botao.textContent = 'Gerando PDF...';
  botao.disabled = true;

  try{
    if(!window.PDFLib){
      throw new Error('Biblioteca pdf-lib não carregou (verifique js/vendor/pdf-lib.min.js).');
    }
    if(!window.fontkit){
      throw new Error('Biblioteca fontkit não carregou (verifique js/vendor/fontkit.umd.min.js).');
    }
    if(!window.AFETOMED_FONTS){
      throw new Error('Fontes embutidas não carregaram (verifique js/vendor/fonts-embedded.js).');
    }

    var pdfDoc = await window.PDFLib.PDFDocument.create();
    pdfDoc.registerFontkit(window.fontkit);

    var fontRegular = await pdfDoc.embedFont(base64ParaBytes(window.AFETOMED_FONTS.regular), { subset: true });
    var fontBold = await pdfDoc.embedFont(base64ParaBytes(window.AFETOMED_FONTS.bold), { subset: true });

    // A logo é embutida em base64 (js/vendor/logo-embedded.js) e usada
    // diretamente pelo pdf-lib, sem passar por <canvas>/DOM. Isso evita o
    // erro de "canvas contaminado" que o Chrome lança quando a página é
    // aberta direto do disco (file://) em vez de por um servidor http.
    var logoImagem = null;
    if(window.AFETOMED_LOGO_PNG_BASE64){
      try{
        logoImagem = await pdfDoc.embedPng(base64ParaBytes(window.AFETOMED_LOGO_PNG_BASE64));
      }catch(erroLogo){
        console.warn('Não foi possível incluir a logo no PDF:', erroLogo);
      }
    }

    var ctx = criarContexto(pdfDoc, fontRegular, fontBold, logoImagem);

    // Embute a imagem da assinatura (se o usuário enviou uma), preservando
    // a posição em que ela foi arrastada dentro da caixa
    // Embute as imagens de assinatura (pagina1 = paciente/responsável,
    // pagina2 = profissional), preservando a posição em que cada uma foi
    // arrastada dentro da sua respectiva caixa
    ctx.assinaturaPagina1 = await prepararAssinaturaParaPDF(pdfDoc, 'pagina1');
    ctx.assinaturaPagina2 = await prepararAssinaturaParaPDF(pdfDoc, 'pagina2');

    montarPagina1(ctx);
    montarPagina2(ctx);

    var pdfBytes = await pdfDoc.save();
    var blob = new Blob([pdfBytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);

    var link = document.createElement('a');
    link.href = url;
    link.download = montarNomeArquivoPDF();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);

  }catch(erro){
    console.error('Falha ao gerar PDF:', erro);
    alert('Não foi possível gerar o PDF. Tente novamente ou use o botão Imprimir.\n\nDetalhe técnico: ' + (erro && erro.message ? erro.message : erro));
  }finally{
    botao.textContent = textoOriginalBotao;
    botao.disabled = false;
  }
}
