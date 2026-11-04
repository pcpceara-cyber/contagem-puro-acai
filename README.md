# Contagem de estoque · Puro Açaí

App de celular para o conferente ler o código de barras, ver foto e descrição do produto e lançar a quantidade em estoque. As quantidades vão direto para a planilha **teste de contagem**.

```
GitHub Pages (index.html)  ⇄  Apps Script (apps-script/Code.gs)  ⇄  Planilha "teste de contagem"
     tela + câmera               lê catálogo e grava contagem          Página1 · Contagem · Resumo
```

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | O app (tela, câmera, busca, lista). |
| `logo-branca.png`, `icon-*.png`, `apple-touch-icon.png` | Logo no topo e ícone na tela inicial do celular. |
| `manifest.webmanifest` | Permite "Adicionar à tela inicial" como app. |
| `apps-script/Code.gs` | Código que fica **dentro da planilha** (não roda no GitHub). |

## 1. Apps Script (na planilha)

1. Abra a planilha **teste de contagem** › Extensões › Apps Script.
2. Apague o que houver em `Código.gs` e cole `apps-script/Code.gs`. Se existir um arquivo `Index` da versão anterior, pode apagar.
3. Opcional: no topo do código, defina um PIN da equipe, por exemplo `const PIN = '4827';`. Vazio = sem PIN.
4. Selecione a função `configurar` e clique em **Executar**. Autorize. Isso cria as abas **Contagem** e **Resumo**.
5. **Implantar › Nova implantação › App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie a URL que termina em `/exec`.

> Sempre que alterar o `Code.gs`: Implantar › Gerenciar implantações › editar (lápis) › Versão: **Nova versão**. Assim a URL continua a mesma.

Teste rápido: abra `SUA_URL/exec?action=ping` no navegador. Deve aparecer `{"ok":true}`.

## 2. GitHub Pages

1. Crie um repositório no GitHub (ex.: `contagem-puro-acai`). No plano gratuito, ele precisa ser **público** para o Pages funcionar. Nenhum dado da planilha fica no repositório.
2. Envie os arquivos deste pacote (Add file › Upload files), mantendo a pasta `apps-script/`.
3. Settings › Pages › Source: **Deploy from a branch** › Branch `main`, pasta `/ (root)` › Save.
4. Em 1 a 2 minutos o app fica em `https://SEU_USUARIO.github.io/contagem-puro-acai/`.

### URL do Apps Script no app
- **Opção A (recomendada):** edite `index.html` no GitHub e cole a URL em `const API_URL = "";`. Todos os aparelhos já abrem configurados.
- **Opção B:** deixe vazio. Na primeira vez, o app pede a URL e guarda no aparelho.

## 3. No celular

1. Abra o endereço do GitHub Pages no **Chrome (Android)** ou **Safari (iPhone)**.
2. Preencha nome, local e, se houver, o PIN.
3. Toque em **Câmera ao vivo** e permita o uso da câmera.
4. Opcional: menu do navegador › **Adicionar à tela inicial**.

## Roteiro de teste

1. Leia `618341419902` (Açaí Premium 5LT) e salve **10**. Confira as abas Contagem e Resumo.
2. Leia de novo, escolha **Somar**, digite **5**. O Resumo deve mostrar **15**.
3. Digite `0618341419902`. Deve abrir o mesmo produto.
4. Digite um código que não existe. Deve aparecer "Código não está na planilha".
5. **Buscar por nome**: "sorbet".
6. Dois celulares salvando o mesmo produto ao mesmo tempo: as duas linhas devem entrar em Contagem.
7. Câmera ao vivo, lanterna (aparece só onde o aparelho permite) e Foto do código.

## Recomeçar a contagem

No editor do Apps Script, rode `novaContagem`. As abas atuais são renomeadas com a data e são criadas abas vazias. Nada é apagado.

## Limitações conhecidas

- Com acesso "Qualquer pessoa", quem tiver a URL do Apps Script pode gravar na planilha. O PIN reduz esse risco, mas não é uma senha forte.
- Fotos: o app tenta a miniatura pública do Drive. Se falhar, o Apps Script busca a imagem com a conta de quem implantou. Essa conta precisa ter acesso às fotos.
- Câmera ao vivo: usa o leitor nativo do navegador quando existe (Chrome Android) e a biblioteca ZXing nos outros (iPhone).
