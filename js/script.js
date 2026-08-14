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

function desenharTituloSecao(ctx, texto){
  garantirEspaco(ctx, 26);
  var altura = 20;
  desenharRetangulo(ctx, 0, ctx.y, PAGE_W, altura, { preenchimento: COR_TEAL });
  desenharTexto(ctx, texto, MARGEM, ctx.y + 4, { tamanho: 10.5, negrito: true, cor: COR_BRANCO });
  ctx.y += altura + 10;
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

var ALTURA_LABEL = 11;
var ALTURA_LINHA_VALOR = 12.5;
var PADDING_CAIXA = 5;
var ALTURA_MIN_CAIXA = 18;
var ESPACO_ENTRE_LINHAS = 8;

function calcularAlturaCampo(ctx, campo, largura){
  if(campo.tipo === 'radio'){
    return ALTURA_LABEL + 4 + 14;
  }
  var valor = valorDoCampo(campo.nome);
  var larguraTexto = largura - (PADDING_CAIXA * 2);

  if(campo.multilinha){
    var linhasMulti = quebrarTexto(ctx, valor || ' ', ctx.fontRegular, 10, larguraTexto);
    var minLinhas = campo.minLinhas || 6;
    var nLinhas = Math.max(linhasMulti.length, minLinhas);
    var alturaCaixaMulti = (nLinhas * ALTURA_LINHA_VALOR) + (PADDING_CAIXA * 2);
    return ALTURA_LABEL + 4 + alturaCaixaMulti;
  }

  var linhas = quebrarTexto(ctx, valor || ' ', ctx.fontRegular, 10, larguraTexto);
  var alturaCaixa = Math.max(ALTURA_MIN_CAIXA, (linhas.length * ALTURA_LINHA_VALOR) + (PADDING_CAIXA * 2));
  return ALTURA_LABEL + 4 + alturaCaixa;
}

function desenharCampo(ctx, campo, x, topoY, largura, alturaLinha){
  // Rótulo
  desenharTexto(ctx, campo.rotulo, x, topoY, { tamanho: 8, negrito: true, cor: COR_LABEL });

  var topoCaixa = topoY + ALTURA_LABEL + 4;
  var alturaCaixa = alturaLinha - ALTURA_LABEL - 4;

  if(campo.tipo === 'radio'){
    var valorSelecionado = valorDoRadio(campo.nome);
    desenharOpcaoRadio(ctx, x, topoCaixa + 1, 'Sim', valorSelecionado === 'Sim');
    desenharOpcaoRadio(ctx, x + 70, topoCaixa + 1, 'Não', valorSelecionado === 'Não');
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
    desenharTexto(ctx, '—', x + PADDING_CAIXA, topoCaixa + PADDING_CAIXA, {
      tamanho: 10, cor: COR_PLACEHOLDER
    });
  }else{
    var linhas = quebrarTexto(ctx, valor, ctx.fontRegular, 10, larguraTexto);
    for(var i = 0; i < linhas.length; i++){
      desenharTexto(ctx, linhas[i], x + PADDING_CAIXA, topoCaixa + PADDING_CAIXA + (i * ALTURA_LINHA_VALOR), {
        tamanho: 10, cor: COR_TEXTO
      });
    }
  }
}

// Desenha um botão de opção redondo (radio button de verdade), com um ponto
// preenchido no centro quando selecionado - igual ao <input type="radio">.
function desenharOpcaoRadio(ctx, x, topoY, texto, marcado){
  var diametro = 9;
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
    var raioInterno = raio - 2.5;
    ctx.page.drawEllipse({
      x: centroX,
      y: centroYpdf,
      xScale: raioInterno,
      yScale: raioInterno,
      color: COR_TEAL
    });
  }

  desenharTexto(ctx, texto, x + diametro + 5, topoY - 1, { tamanho: 9.5, cor: COR_TEXTO });
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
    var linhasMedidas = quebrarTexto(ctx, valorMedido || ' ', ctx.fontRegular, 10, larguras[i] - PADDING_CAIXA * 2);
    var alturaMedida = Math.max(ALTURA_MIN_CAIXA, (linhasMedidas.length * ALTURA_LINHA_VALOR) + PADDING_CAIXA * 2);
    alturaMax = Math.max(alturaMax, alturaMedida);
  }

  var alturaTotal = ALTURA_LABEL + 6 + ALTURA_LABEL + 4 + alturaMax + ESPACO_ENTRE_LINHAS;
  garantirEspaco(ctx, alturaTotal);

  desenharTexto(ctx, 'ENDEREÇO:', MARGEM, ctx.y, { tamanho: 8, negrito: true, cor: COR_LABEL });
  var topoColunas = ctx.y + ALTURA_LABEL + 6;
  var topoCaixas = topoColunas + ALTURA_LABEL + 4;

  var x = MARGEM;
  for(var j = 0; j < campos.length; j++){
    desenharTexto(ctx, campos[j].rotulo, x, topoColunas, { tamanho: 7.5, negrito: true, cor: COR_LABEL });
    desenharRetangulo(ctx, x, topoCaixas, larguras[j], alturaMax, {
      preenchimento: COR_BRANCO, borda: COR_BORDA, espessuraBorda: 1
    });
    var valorCampo = valorDoCampo(campos[j].nome);
    if(valorCampo === ''){
      desenharTexto(ctx, '—', x + PADDING_CAIXA, topoCaixas + PADDING_CAIXA, { tamanho: 10, cor: COR_PLACEHOLDER });
    }else{
      var linhasCampo = quebrarTexto(ctx, valorCampo, ctx.fontRegular, 10, larguras[j] - PADDING_CAIXA * 2);
      for(var k = 0; k < linhasCampo.length; k++){
        desenharTexto(ctx, linhasCampo[k], x + PADDING_CAIXA, topoCaixas + PADDING_CAIXA + (k * ALTURA_LINHA_VALOR), { tamanho: 10, cor: COR_TEXTO });
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
