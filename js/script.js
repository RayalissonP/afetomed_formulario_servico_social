function limparFormulario(){
  if(confirm("Tem certeza que deseja limpar todos os campos do formulário?")){
    document.getElementById('formAvaliacao').reset();
    sincronizarRodape();
  }
}

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
