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

// Gera e baixa o formulário preenchido em PDF, sem precisar passar pela caixa de diálogo de impressão
async function baixarPDF(){
  var folhas = document.querySelectorAll('.sheet');
  var toolbar = document.querySelector('.toolbar');
  var botao = document.getElementById('btnBaixarPDF');
  var textoOriginalBotao = botao.textContent;

  botao.textContent = 'Gerando PDF...';
  botao.disabled = true;
  toolbar.style.visibility = 'hidden';

  try{
    var jsPDFClasse = window.jspdf.jsPDF;
    var pdf = new jsPDFClasse('p', 'mm', 'a4');
    var larguraPagina = 210;
    var alturaPagina = 297;

    for(var i = 0; i < folhas.length; i++){
      var canvas = await html2canvas(folhas[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      var imagem = canvas.toDataURL('image/jpeg', 0.98);
      var alturaImagem = (canvas.height * larguraPagina) / canvas.width;

      if(i > 0) pdf.addPage();
      pdf.addImage(imagem, 'JPEG', 0, 0, larguraPagina, Math.min(alturaImagem, alturaPagina));
    }

    pdf.save(montarNomeArquivoPDF());
  }catch(erro){
    console.error('Falha ao gerar PDF:', erro);
    alert('Não foi possível gerar o PDF. Tente novamente ou use o botão Imprimir.');
  }finally{
    toolbar.style.visibility = 'visible';
    botao.textContent = textoOriginalBotao;
    botao.disabled = false;
  }
}
