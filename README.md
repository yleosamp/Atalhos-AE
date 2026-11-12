# Atalhos AE

Painel dockável e responsivo para Adobe After Effects 2026/2027. Versão pública **1.0.1**, com pacotes Windows e macOS, sem Node, Homebrew ou ferramentas de desenvolvimento para o usuário. Ele troca automaticamente entre uma fileira horizontal e uma coluna vertical conforme o espaço onde estiver encaixado.

[Baixar no Yleo Tools](https://tools.yleoeditor.com/#atalhos-ae) · [Releases e instaladores](https://github.com/yleosamp/Atalhos-AE/releases/latest)

## Botoes

1. **Camera 50mm** - cria uma camera 50 mm, um nulo 3D centralizado e liga a camera ao nulo.
2. **NULL / Nulo** - cria um nulo 2D centralizado. Se houver um nulo selecionado, o **NOVO vira PAI, e o ANTIGO fica ligado ao NOVO**. Mantém o modo 2D/3D e insere o controlador entre o nulo antigo e seu pai anterior, sem reescrever os valores/keyframes antigos. O novo fica selecionado, então novos cliques criam controladores acima da cadeia. Se vários nulos estiverem selecionados, usa o mais acima na timeline; outras camadas não são alteradas.
3. **Adjustment Layer** - cria uma camada de ajuste do tamanho da composicao.
4. **Copiar easing** - guarda velocidade, influencia e interpolacao dos keyframes selecionados.
5. **Colar easing** - aplica o easing guardado aos keyframes selecionados.
6. **Texto dinamico** - aplica movimento independente por caractere a camadas de texto selecionadas. Os controles de forca, velocidade, rotacao, escala e seed ficam em Effect Controls.
7. **Texto holograma** - transforma o texto selecionado em duas camadas sincronizadas no estilo MrBeast. A camada superior recebe Venetian Blinds e Deep Glow 2; a camada principal continua sendo a unica que voce precisa editar.
8. **Flicker de texto** - cria uma camada de fill e outra de stroke sincronizadas e anima um Range Selector aleatorio por 20 frames a partir do playhead. Em um holograma existente, aplica ou remove o flicker nas duas camadas sem criar copias extras. O slider `Flicker - Velocidade` fica somente na camada principal: `1,00` reproduz o video de referencia, `2,00` dobra a velocidade e `0,50` deixa o efeito duas vezes mais lento.
9. **Texto 3D experimental** - transforma o texto selecionado em uma pre-composicao com Advanced 3D, bevel convexo, extrusao verde escura, contorno e Deep Glow 2. O texto continua editavel ao abrir a pre-composicao com duplo clique. O glow fica na camada externa 2D para evitar incompatibilidade entre o plugin e a geometria extrudada.

Os botoes de texto holograma e 3D experimental requerem o plugin **Deep Glow 2** instalado. O preset de holograma usa Bardow ExtraBold em 36 px, tracking -29, preenchimento principal `#C0E9FF`, camada de glow `#008C97`, Venetian Blinds em 66%/90 graus/5 px e Deep Glow com raio 117 e exposicao 0,99.

Para criar o holograma ja com flicker em um unico clique, segure **Shift** ao clicar no botao de holograma. O botao de flicker tambem funciona como liga/desliga quando o texto ja possui a animacao.

Se varios keyframes forem copiados, o painel preserva a sequencia. Ao colar em uma selecao maior, a sequencia e repetida. Isso permite copiar, por exemplo, o easing de entrada e saida de um par de keyframes e reaplica-lo em varios pares.

## Instalar no Windows

1. Baixe **Atalhos-AE-1.0.1-Windows.zip** e extraia o ZIP inteiro.
2. Salve seu trabalho, feche o After Effects e dê dois cliques em `INSTALAR.bat`. Confirme a autorização do Windows se solicitada.
3. Aguarde o instalador, que localiza a instalação do After. Abra o After novamente.
4. Use **Janela > Atalhos AE** e encaixe o painel onde quiser.

Se preferir instalar pelo terminal, abra o PowerShell nesta pasta e execute:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install.ps1
   ```

O instalador procura instalações reais do After, sem exigir que o usuário já tenha criado as pastas de preferências. Para escolher uma versão específica:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -AfterEffectsVersion 26.0
```

## Instalar no macOS

1. Baixe **Atalhos-AE-1.0.1-macOS.zip** e extraia tudo.
2. Salve seu trabalho e feche o After.
3. Botão direito em **INSTALAR.command > Abrir**; siga a escolha de instalação se solicitada. Confirme a autorização de cópia para a pasta do After quando necessária.
4. Abra o After > **Janela > Atalhos AE**. O comando de NULL também fica em **Arquivo > Scripts**.

O instalador comunitário não é assinado/notarizado pela Apple e pode exigir uma autorização para **esse arquivo** em Privacidade e Segurança > Abrir Mesmo Assim. Não desative Gatekeeper/SIP. Não é um CCX e não precisa do Creative Cloud para instalar o painel. Use uma versão do After compatível com seu Mac; After 2027 no Mac exige Apple Silicon, enquanto um Intel/Hackintosh precisa de uma versão anterior compatível.

Os instaladores não fecham o After à força, não editam projetos nem atribuem N automaticamente. Fazem backup dos arquivos próprios substituídos. Não instalam Deep Glow/fontes comerciais e não modificam o `PresetEffects.xml` global: se o controle Airrack agrupado não estiver registrado, o texto dinâmico usa seus cinco sliders nativos e continua funcionando. Instalações anteriores com o controle agrupado continuam reconhecidas.

## Instalar manualmente

Copie `Atalhos AE.jsx` e a pasta `Atalhos AE-assets` para:

```text
%APPDATA%\Adobe\After Effects\<versao>\Scripts\ScriptUI Panels\
```

Mantenha o arquivo e a pasta de icones lado a lado. Reinicie o After Effects depois da copia.

## Tecla N para criar NULL na timeline

O botão e o comando de teclado usam a mesma ação (`Atalhos AE-assets/null-action.jsxinc`). O instalador também copia **`zz Atalhos AE - NULL.jsx`** para a pasta **Scripts** da instalação do After, junto com a subpasta do helper. Esse comando roda sem abrir outra janela e sem precisar do painel aberto.

Uma vez após instalar/reiniciar:

1. Abra **Editar > Atalhos do teclado** (no Mac, use o editor de atalhos do After).
2. Busque **`zz Atalhos AE - NULL`**, em **Aplicativo > Arquivo > Scripts**, e atribua **N**.
3. Remova o **N** do comando original **Definir fim da área de trabalho**, inclusive se aparecer na categoria da timeline. Atalhos de painel podem ter prioridade sobre os do aplicativo.
4. Salve seu conjunto personalizado. Na timeline, N sem seleção de nulo cria um nulo independente; com um nulo selecionado cria um **novo pai** para ele. O vínculo do comando N não muda ao atualizar da versão 1.0.0.

O controlador novo é neutro (posição igual à âncora, escala 100 e rotação zero), preservando a transformação local e a animação comum do antigo. Seu pivô fica no pivô atual do nulo selecionado, mas o quadrado visual do nulo pode aparecer na origem do pai anterior. Expressões que dependem de `parent`/`index` podem mudar de significado pela própria mudança da hierarquia; não há promessa de preservação universal dessas expressões.

Não há tentativa de capturar N globalmente pelo ScriptUI nem alteração automática dos seus atalhos. A atribuição precisa ser feita no editor nativo. Enquanto estiver digitando/renomeando um texto, N continua sendo texto. O prefixo `zz` evita inserir o comando antes dos scripts existentes. O AE pode limitar os scripts atribuíveis aos primeiros 20; se já houver muitos, será necessário organizar os scripts de menu. Confira seus atalhos se instalar/remover scripts que alterem a ordem dessa lista.

### Instalação manual do comando (Windows ou Mac)

Além do painel, copie `zz Atalhos AE - NULL.jsx` para **Scripts**, não para **ScriptUI Panels**. Ao lado dele, crie `Atalhos AE-assets` contendo `null-action.jsxinc`:

- Windows: `C:\Program Files\Adobe\Adobe After Effects <ano>\Support Files\Scripts\`.
- macOS: `/Applications/Adobe After Effects <ano>/Scripts/`.

O painel também precisa do helper na sua própria pasta `Atalhos AE-assets`. Reinicie o After para o comando aparecer no menu antes de configurar N.

Teste por código, sem controlar a timeline real: `node --test tools/test-ae-null.cjs`. Esses testes usam contratos simulados do AE, não uma validação visual dentro do aplicativo.

## Estrutura para novos atalhos

Cada botao fica registrado no array `ACTIONS` no final de `Atalhos AE.jsx`. Para adicionar novos atalhos, basta criar uma funcao, adicionar o icone e registrar uma nova entrada no array; o layout responsivo acomoda o novo botao automaticamente.

## Validação, licença e English quick setup

O comportamento de NULL, Undo e do wrapper de teclado é verificado por testes de contrato simulados. Os instaladores e os ZIPs também são testados em diretórios isolados; isso não substitui a conferência dos efeitos no After real, especialmente no Mac e com versões diferentes de plugins comerciais. Faça backup do projeto e revise o primeiro resultado. O painel não envia projetos nem dados a servidores e não inclui telemetria ou checagem de licença própria.

MIT para o código/ícones deste painel; fontes e efeitos de terceiros não são incluídos e mantêm suas próprias licenças. Ferramenta independente, sem vínculo com Adobe ou fabricantes de efeitos.

**English:** download the Windows/macOS ZIP, extract it, save/close After Effects, and run **INSTALAR.bat** or right-click **INSTALAR.command > Open**. Then open **Window > Atalhos AE**. No extra runtimes or developer tools. Assign **N** once in AE Keyboard Shortcuts to **zz Atalhos AE - NULL**, removing its original work-area assignment. Only the hologram/experimental 3D buttons require your own Deep Glow 2 installation. Unsigned Mac installers may require per-file Open Anyway. Native Mac effects remain unverified; do not disable system security.

Developers: `node --test tools/test-ae-null.cjs tools/test-ae-install.cjs`; `node tools/build-ae.cjs` generates allowlisted ZIPs and SHA-256 checksums without npm dependencies.
