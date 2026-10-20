# Guia do projeto Alive

Referência rápida para continuar o trabalho em outro computador. Atualizado em 20/10/2026.

- **Repositório:** https://github.com/LordDeadVader/alive-site
- **Site publicado (GitHub Pages):** https://lorddeadvader.github.io/alive-site/
- **Publicar:** todo `git push` na branch `main` atualiza o site em cerca de 1 minuto.

> ⚠️ **Este repositório é público.** Nunca coloque senhas, propostas comerciais ou dados de clientes em arquivos versionados. Por isso a pasta `propostas/` está no `.gitignore` (veja [Materiais fora do git](#materiais-fora-do-git)).

---

## 1. Estrutura do site

| Arquivo | O que é |
|---|---|
| `index.html` | Site institucional: hero com logo, portfólio, serviços, vantagens, planos e contato |
| `login.html` | Login da área do cliente |
| `dashboard.html` | Painel de gestão de clientes, sites e cobranças |
| `css/style.css` | Todo o visual (design tokens no `:root`) |
| `js/main.js` | Parallax, animações de entrada, formulário e acesso oculto ao login |
| `js/fluid.js` | Efeito de fluido em WebGL no hero (reage ao mouse) |
| `js/auth.js` | Validação do login por hash SHA-256 |
| `js/dashboard.js` | Lógica do painel: clientes, vencimentos e cobrança PIX |
| `js/qrcode.min.js` | Biblioteca de QR Code (local, sem CDN) |
| `assets/` | Logo da Alive e prévia estática do site da PS Corretor |
| `marketing/render_ad.py` | Gerador do anúncio de 10s da Alive (veja a seção 6) |

### Rodar localmente

Na pasta do projeto:

```bash
python -m http.server 8791
```

Depois abra http://localhost:8791. Abrir o `index.html` direto do disco também funciona, mas o servidor local evita problemas de cache e de caminhos.

### Cache dos navegadores

O CSS e o JS são carregados com `?v=N` (exemplo: `css/style.css?v=4`). **Ao alterar um desses arquivos, aumente o número** nos `.html` que o usam. Se não aumentar, quem já visitou o site continua vendo a versão antiga.

---

## 2. Área do cliente (acesso oculto)

- Não existe botão visível. Para entrar, **clique 5 vezes seguidas na logo Alive do rodapé** (em até 2,5 s) e o site abre o `login.html`.
- Dá para abrir `login.html` direto também.
- Os usuários válidos são **DAVI** e **ADMIN**. O nome do usuário não diferencia maiúsculas de minúsculas. As senhas **não ficam neste arquivo**: só você sabe quais são.

### Trocar uma senha

O `js/auth.js` guarda só o hash SHA-256 de `USUARIO:senha`, com o usuário em maiúsculas. Para gerar um novo hash no PowerShell:

```powershell
$s=[Security.Cryptography.SHA256]::Create(); ($s.ComputeHash([Text.Encoding]::UTF8.GetBytes("DAVI:nova-senha")) | % { $_.ToString("x2") }) -join ""
```

Troque o hash correspondente em `AUTH_HASHES` dentro de `js/auth.js` e aumente o `?v=` do `auth.js` no `login.html`.

> O login roda no navegador (o site é estático). Ele impede o acesso casual, mas não é segurança de verdade. Para isso, o próximo passo seria um backend como Firebase ou Supabase.

---

## 3. Painel de gestão (`dashboard.html`)

### ⚠️ Os dados ficam no navegador

Os clientes ficam salvos no **localStorage** do navegador, na chave `alive_clientes_v2`. Na prática:

- **O que você cadastrar no computador do trabalho não aparece em casa, e o contrário também.**
- Limpar os dados do navegador apaga os clientes.

**Levar os dados de um computador para outro:** abra o painel, aperte F12 e vá na aba **Console**.

No computador de origem, copie os dados:

```js
copy(localStorage.getItem('alive_clientes_v2'))
```

No computador de destino, cole o texto copiado entre as aspas e recarregue a página:

```js
localStorage.setItem('alive_clientes_v2', 'COLE_AQUI'); location.reload()
```

### Clientes iniciais

Na primeira vez que o painel abre em um navegador, ele cadastra sozinho:

| Cliente | Contato | Plano | Implementação | Recorrência |
|---|---|---|---|---|
| PS Corretor | Paulo Souza | Essencial | R$ 320 (paga) | R$ 65/mês, vencimento dia 10 |
| Trans Empri | Walter Gomes | Condição especial | R$ 250 (paga) | R$ 200/ano |

> Esses dois são **clientes migrados** com preço especial. O preço padrão da Alive para clientes novos é **a partir de R$ 200/mês**.

Ajustes antigos de dados rodam uma única vez por navegador e são controlados por chaves no localStorage (`alive_seed_v2`, `alive_patch_impl_pago_v2`). Para aplicar um ajuste novo, crie uma chave nova em vez de reaproveitar uma existente.

### Funções do painel

- **Cards por cliente**, com links para o site, o repositório e o WhatsApp do cliente.
- **Lembrete de vencimento:** fica amarelo quando faltam até 7 dias e vermelho quando vence hoje ou já venceu. É calculado a partir do campo "Próximo vencimento".
- **⚡ Cobrança PIX:** gera um QR Code e o código "copia e cola" no padrão BR Code do Banco Central. A chave PIX fica salva no navegador (`alive_pix_key`).
  - **📎 Compartilhar arquivo:** gera uma imagem PNG com a cobrança. No celular, abre o menu de compartilhar.
  - **💬 WhatsApp:** abre a conversa com uma mensagem curta e o código copiável.
  - **Imprimir:** gera o documento de cobrança para impressão.
- O painel funciona no celular.

> **Confira a chave PIX** antes de mandar a primeira cobrança. Teste com um valor de centavos.

---

## 4. Portfólio do site

| Cliente | Endereço | Repositório |
|---|---|---|
| PS Corretor | https://lorddeadvader.github.io/ps-corretor/ | `ps-corretor` (prévia em imagem: `assets/ps-corretor-preview.png`) |
| Trans Empri | https://lorddeadvader.github.io/transempri/ | `transempri` |
| Primor Comunicação Visual | https://www.primorcomunicacao.com.br/ | `Site-Primor` |
| Van Hounten | logo e identidade visual (sem site) | — |

As prévias do portfólio são iframes em miniatura. Se algum site bloquear o iframe, troque por uma imagem estática, como já foi feito com o PS Corretor.

---

## 5. Materiais fora do git

Tudo isto fica no disco `Z:\Artes\Davi\Usos\Claude\alive\` e **não vai para o GitHub**, de propósito (o repositório é público).

| Pasta / arquivo | Conteúdo |
|---|---|
| `propostas/plano-primor.html` | Código-fonte do "Plano de Crescimento Digital" da Primor |
| `propostas/Plano_Crescimento_Primor_Alive.pdf` | PDF final do plano (10 páginas) |
| `propostas/primor-motion/` | Projeto do vídeo motion da Primor (seção 7) |
| `marketing/alive-anuncio-10s.mp4` | Anúncio de 10s para WhatsApp |

Para trabalhar nesses materiais em casa, copie a pasta (pen drive, Google Drive etc.). Outra opção é deixar o repositório **privado** no GitHub e então versionar tudo.

### Gerar o PDF de novo depois de editar o HTML

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --no-pdf-header-footer --allow-file-access-from-files --virtual-time-budget=15000 --print-to-pdf="Z:\Artes\Davi\Usos\Claude\alive\propostas\Plano_Crescimento_Primor_Alive.pdf" "file:///Z:/Artes/Davi/Usos/Claude/alive/propostas/plano-primor.html"
```

---

## 6. Anúncio de 10s da Alive

`marketing/render_ad.py` gera um vídeo vertical (1080x1920) com animação e trilha sintetizada. O preço e o telefone ficam no topo do arquivo (`PRICE`, `PHONE`).

```bash
python marketing/render_ad.py
python marketing/render_ad.py --preview previa.png
```

O primeiro comando gera o vídeo. O segundo gera só uma folha com quadros-chave para conferir o visual.

Requisitos: Python 3, Pillow e ffmpeg no PATH. Usa as fontes Montserrat instaladas no Windows.

---

## 7. Vídeo motion da Primor (`propostas/primor-motion/`)

Vídeo 16:9 de cerca de 2 minutos, em duas versões: **com narração** e **só com música**.

| Arquivo | Função |
|---|---|
| `motion.py` | Todas as cenas, transições e pós-produção |
| `audio.py` | Trilha original, efeitos sonoros e mixagem das duas versões |
| `tts.py` | Narração em PT-BR (voz neural Microsoft "Antônio") |
| `img/` | Fotos e logo da Primor, tiradas do site dela |
| `vo/` | Falas da narração já geradas |

### Preparar o ambiente (uma vez)

```bash
python -m venv venv
venv\Scripts\pip install numpy pillow edge-tts pymupdf
```

### Gerar de novo

Rode os comandos dentro de `propostas/primor-motion/`:

```bash
venv\Scripts\python tts.py pt-BR-AntonioNeural
venv\Scripts\python audio.py
venv\Scripts\python motion.py render video_raw.mp4
```

O primeiro gera a narração e só é necessário se você mudar o texto das falas (em `tts.py`). O segundo gera a trilha e as duas mixagens. O terceiro renderiza o vídeo e leva cerca de 15 a 20 minutos com 4 núcleos.

Depois, junte o vídeo com cada áudio:

```bash
ffmpeg -i video_raw.mp4 -i mix_narracao.wav -c:v copy -c:a aac -b:a 256k -shortest Primor_Motion_Narrado.mp4
ffmpeg -i video_raw.mp4 -i mix_musica.wav -c:v copy -c:a aac -b:a 256k -shortest Primor_Motion_Musica.mp4
```

Para conferir cenas sem renderizar tudo, gere uma folha de quadros nos segundos que quiser:

```bash
venv\Scripts\python motion.py sheet folha.png 10 35 60 100
```

**Ao mudar o tempo de uma fala**, ajuste junto o dicionário `VO` em `audio.py` e os tempos da cena correspondente em `motion.py`. A tabela `SCENES` no fim do arquivo mostra onde começa e termina cada cena.

---

## 8. Pendências e observações

- [ ] **Site da Primor:** no Google, a descrição aparece como *"Servidor acordando… Destaque 1"*. O Google está lendo a tela de carregamento. Corrigir é o primeiro ajuste de SEO.
- [ ] **Chave PIX:** confirmar que a chave padrão (celular) está cadastrada no banco.
- [ ] **Marca "Alive":** consultar o INPI nas classes 35 e 42 antes de investir pesado na marca.
- [ ] **Van Hounten:** se tiver site, adicionar a prévia no portfólio.
- [ ] **Login:** é proteção básica, feita no navegador. Para dados sensíveis, migrar para um backend.
